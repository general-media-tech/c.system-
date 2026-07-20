/* ═══════════════════════════════════════════════════════
   gmt-cache.js — مكتبة التخزين المؤقت المحلي لأنظمة GMT (IndexedDB + وضع عدم الاتصال)
   استُخرجت حرفياً 2026-07-06 من النسخة المدمجة بملف الجرد.
   السبب: Bridge.html يستدعي هذا الملف خارجياً منذ البداية (باستدعاء محمي
   if(window.GMTCache)) لكن الملف لم يكن موجوداً قط — فكان تخزينه المحلي معطلاً بصمت.
   يُرفع جنب Bridge.html. الجرد والمشتريات يبقيان بنسختيهما المدمجتين (لا تعديل عليهما)
   حتى جلسة التوحيد.
   ═══════════════════════════════════════════════════════ */

/* ══ gmt-cache.js (embedded) ══ */
/**
 * gmt-cache.js — مكتبة التخزين المؤقت المحلي لـ GMT Systems
 * تستخدم IndexedDB لتخزين بيانات المنتجات والصور محلياً
 * تدعم وضع عدم الاتصال (Offline Mode)
 * الإصدار: 2.0
 */

(function () {
  'use strict';

  const DB_NAME    = 'gmt_cache_db';
  const DB_VERSION = 3;
  const STORE_DATA = 'gmt_collections';
  const STORE_IMG  = 'gmt_images';
  const STORE_META = 'gmt_meta';

  // ── فتح قاعدة البيانات (مع تخزين الاتصال — singleton) ──────────
  // مهم للأداء: كانت كل عملية قراءة/كتابة تفتح اتصال IndexedDB جديد وما تسكّره،
  // فتتراكم اتصالات مفتوحة وتبطّئ المتصفح تدريجياً لدرجة الحاجة للريفرش. الآن
  // نفتح اتصال واحد ونعيد استخدامه طول الجلسة.
  let _dbConn = null;
  let _dbConnPromise = null;
  function openDB() {
    if (_dbConn) return Promise.resolve(_dbConn);
    if (_dbConnPromise) return _dbConnPromise;
    _dbConnPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        _dbConnPromise = null;
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DATA)) {
          db.createObjectStore(STORE_DATA, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_IMG)) {
          db.createObjectStore(STORE_IMG, { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      req.onsuccess  = (e) => {
        _dbConn = e.target.result;
        // لو انغلق الاتصال لأي سبب (مثلاً ترقية من تبويب آخر)، نصفّر الكاش ليُعاد فتحه
        _dbConn.onclose = () => { _dbConn = null; _dbConnPromise = null; };
        _dbConn.onversionchange = () => { try { _dbConn.close(); } catch(e){} _dbConn = null; _dbConnPromise = null; };
        resolve(_dbConn);
      };
      req.onerror    = (e) => { _dbConnPromise = null; reject(e.target.error); };
      req.onblocked  = ()  => { _dbConnPromise = null; reject(new Error('IndexedDB blocked')); };
    });
    return _dbConnPromise;
  }

  // ── قراءة من مخزن ────────────────────────────────────────────
  async function dbGet(store, key) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => resolve(null);
      });
    } catch (e) { return null; }
  }

  // ── كتابة في مخزن ────────────────────────────────────────────
  async function dbPut(store, value) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(value);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  // ── حذف من مخزن ────────────────────────────────────────────
  async function dbDelete(store, key) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx  = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  // ── طلب Supabase مباشر ──────────────────────────────────────
  async function sbRequest(sbConfig, path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(sbConfig.url + path, {
        headers: {
          'apikey': sbConfig.key,
          'Authorization': 'Bearer ' + sbConfig.key,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ════════════════════════════════════════════════════════════
  // GMTCache — الكلاس الرئيسي
  // ════════════════════════════════════════════════════════════
  const GMTCache = {

    /**
     * syncCollection — المزامنة الذكية بين Supabase والكاش المحلي
     * @param {Object} opts
     *   name        — اسم المجموعة (مفتاح الكاش)
     *   table       — اسم جدول Supabase
     *   sbConfig    — { url, key }
     *   liveFields  — حقول تُحدَّث دائماً (الكميات)
     *   imageField  — اسم حقل الصورة
     *   idField     — المعرّف الفريد (افتراضي: 'id')
     * @returns { rows, fromCache, offline }
     */
    async syncCollection({ name, table, sbConfig, liveFields = [], imageField = 'image_url', idField = 'id' }) {
      const cacheKey  = 'col_' + name;
      const metaKey   = 'meta_' + name;
      const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

      // 1. حاول الجلب من الخادم
      let rows = null;
      let offline = false;

      try {
        // جلب كامل للبيانات من Supabase
        const path = `/rest/v1/${table}?order=${idField}.asc&limit=10000`;
        const fresh = await sbRequest(sbConfig, path);

        if (Array.isArray(fresh)) {
          rows = fresh;

          // حفظ في الكاش مع الطابع الزمني
          await dbPut(STORE_DATA, { key: cacheKey, rows, savedAt: Date.now() });
          await dbPut(STORE_META, { key: metaKey, count: rows.length, updatedAt: Date.now() });

          return { rows, fromCache: false, offline: false };
        }
      } catch (e) {
        // فشل الاتصال — جرّب الكاش
        offline = true;
        console.warn('[GMTCache] Supabase unreachable, using cache:', e.message);
      }

      // 2. إذا فشل الاتصال، استخدم الكاش المحلي
      const cached = await dbGet(STORE_DATA, cacheKey);
      if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
        return { rows: cached.rows, fromCache: true, offline: true };
      }

      // 3. لا اتصال ولا كاش
      return { rows: [], fromCache: false, offline: true };
    },

    /**
     * cacheImage — تخزين صورة محلياً كـ Base64 وإعادة Blob URL
     * @param {string} url — رابط الصورة الأصلي
     * @returns {string} — Blob URL محلي أو الرابط الأصلي عند الفشل
     */
    async cacheImage(url) {
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;

      // تحقق من الكاش أولاً
      const cached = await dbGet(STORE_IMG, url);
      if (cached && cached.dataUrl) {
        return cached.dataUrl;
      }

      // جلب الصورة وتحويلها
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return url;
        const blob   = await res.blob();
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        // حفظ في الكاش (مع حد حجم 2MB للصورة)
        if (dataUrl.length < 2 * 1024 * 1024) {
          await dbPut(STORE_IMG, { url, dataUrl, cachedAt: Date.now() });
        }

        return dataUrl;
      } catch (e) {
        return url; // إعادة الرابط الأصلي عند الفشل
      }
    },

    /**
     * bulkPut — تحديث مجموعة من السجلات في الكاش دفعةً
     * @param {string} name   — اسم المجموعة
     * @param {Array}  items  — السجلات المراد تحديثها
     */
    async bulkPut(name, items) {
      if (!items || !items.length) return;
      const cacheKey = 'col_' + name;

      const cached = await dbGet(STORE_DATA, cacheKey);
      let rows = (cached && Array.isArray(cached.rows)) ? [...cached.rows] : [];

      // دمج/تحديث السجلات
      items.forEach(item => {
        const idx = rows.findIndex(r => r.id === item.id);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...item };
        } else {
          rows.push(item);
        }
      });

      await dbPut(STORE_DATA, { key: cacheKey, rows, savedAt: Date.now() });
    },

    /**
     * invalidate — مسح كاش مجموعة معينة لإجبار إعادة التحميل
     * @param {string} name — اسم المجموعة
     */
    async invalidate(name) {
      await dbDelete(STORE_DATA, 'col_' + name);
      await dbDelete(STORE_META, 'meta_' + name);
    },

    /**
     * clearAll — مسح كل الكاش
     */
    async clearAll() {
      try {
        const db = await openDB();
        [STORE_DATA, STORE_IMG, STORE_META].forEach(store => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).clear();
        });
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * getStats — إحصائيات الكاش
     */
    async getStats() {
      try {
        const db = await openDB();
        const counts = {};
        for (const store of [STORE_DATA, STORE_IMG, STORE_META]) {
          counts[store] = await new Promise(resolve => {
            const tx  = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => resolve(0);
          });
        }
        return counts;
      } catch (e) {
        return {};
      }
    }
  };

  // ── تصدير عالمي ─────────────────────────────────────────────
  window.GMTCache = GMTCache;

  // ── تشخيص سريع عند التحميل ──────────────────────────────────
  (async function () {
    try {
      await openDB();
      console.log('[GMTCache] ✅ IndexedDB جاهز');
    } catch (e) {
      console.warn('[GMTCache] ⚠️ IndexedDB غير متاح — سيعمل النظام بدون تخزين محلي:', e.message);
      // Fallback: In-memory cache only
      const _memCache = {};
      window.GMTCache = {
        async syncCollection({ name, table, sbConfig }) {
          const cacheKey = 'col_' + name;
          try {
            const path = `/rest/v1/${table}?order=id.asc&limit=10000`;
            const rows = await sbRequest(sbConfig, path);
            if (Array.isArray(rows)) {
              _memCache[cacheKey] = rows;
              return { rows, fromCache: false, offline: false };
            }
          } catch (err) {
            if (_memCache[cacheKey]) {
              return { rows: _memCache[cacheKey], fromCache: true, offline: true };
            }
          }
          return { rows: [], fromCache: false, offline: true };
        },
        async cacheImage(url) { return url; },
        async bulkPut(name, items) {
          const key = 'col_' + name;
          if (!_memCache[key]) _memCache[key] = [];
          items.forEach(item => {
            const idx = _memCache[key].findIndex(r => r.id === item.id);
            if (idx >= 0) _memCache[key][idx] = { ..._memCache[key][idx], ...item };
            else _memCache[key].push(item);
          });
        },
        async invalidate(name) { delete _memCache['col_' + name]; },
        async clearAll() { Object.keys(_memCache).forEach(k => delete _memCache[k]); },
        async getStats() { return { memory: Object.keys(_memCache).length }; }
      };
    }
  })();

})();
