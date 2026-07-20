/* ═══════════════════════════════════════════════════════════════════════
   gmt-draft.js — PUR-4 · مسودة محلية لفاتورة المشتريات   (2026-07-13)

   المشكلة: انقطاع النت أو إغلاق الصفحة بالخطأ = ضياع الفاتورة كاملةً.
   الحل   : حفظ تلقائي **بالجهاز فقط** (IndexedDB مع سقوط آمن على localStorage).
            ⚠️ لا يلمس القاعدة إطلاقاً — قاعدتك «لا كتابة قبل حفظ سحابياً» محفوظة.

   يعمل تلقائياً بمجرد تحميله بجانب صفحة المشتريات — بلا أي تعديل بالكود.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTDraft) return;

  var KEY = 'gmt_purchase_draft';
  var DB = 'gmt_drafts', STORE = 'drafts';
  var timer = null, lastJSON = '';

  /* ── تخزين: IndexedDB أولاً، وإلا localStorage ── */
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej();
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function put(v) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(v, KEY);
        tx.oncomplete = res; tx.onerror = res;
      });
    }).catch(function () {
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    });
  }
  function get() {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { res(null); };
      });
    }).catch(function () {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
    });
  }
  function del() {
    idb().then(function (db) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
    }).catch(function () {});
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ── التقاط حالة الفاتورة الحالية ── */
  var FIELDS = ['in-supplier', 'in-sup-inv', 'in-date', 'in-eta', 'in-ship', 'in-track',
                'in-notes', 'in-sup-phone', 'in-sup-address', 'in-sup-contact',
                'in-currency', 'in-sector', 'cost-transport', 'cost-shipping',
                'cost-customs', 'cost-local', 'in-cash-payment'];

  function snapshot() {
    if (typeof window.cart === 'undefined' || !Array.isArray(window.cart)) return null;
    if (!window.cart.length) return null;
    var form = {};
    FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) form[id] = el.value;
    });
    return {
      at: new Date().toISOString(),
      invType: window.invType || 'germany',
      editId: window.editId || null,
      cart: window.cart,
      form: form
    };
  }

  function save() {
    var s = snapshot();
    if (!s) return;
    var j = JSON.stringify(s.cart) + JSON.stringify(s.form);
    if (j === lastJSON) return;              // لا تغيير ⇒ لا كتابة
    lastJSON = j;
    put(s);
    badge('💾 مسودة محفوظة بجهازك · ' + new Date().toLocaleTimeString('ar-SY'));
  }

  /* ── شارة صغيرة تطمئنك أن المسودة محفوظة ── */
  function badge(txt) {
    var b = document.getElementById('gmt-draft-badge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'gmt-draft-badge';
      b.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:9998;background:#111;color:#fff;' +
        'padding:6px 12px;border-radius:12px;font:700 11px/1.4 Cairo,Arial;opacity:.85;pointer-events:none;';
      document.body.appendChild(b);
    }
    b.textContent = txt;
    b.style.display = 'block';
    clearTimeout(b._t);
    b._t = setTimeout(function () { b.style.display = 'none'; }, 2500);
  }

  /* ── الاستعادة عند فتح الصفحة ── */
  function offerRestore() {
    get().then(function (d) {
      if (!d || !d.cart || !d.cart.length) return;
      var when = new Date(d.at).toLocaleString('ar-SY');
      var ok = confirm(
        '💾 وُجدت مسودة فاتورة غير محفوظة سحابياً\n\n' +
        'التاريخ: ' + when + '\n' +
        'عدد الأصناف: ' + d.cart.length + '\n\n' +
        'هل تستعيدها؟\n(«إلغاء» = حذفها نهائياً)'
      );
      if (!ok) { del(); return; }
      try {
        window.cart = d.cart;
        window.invType = d.invType;
        if (d.editId) window.editId = d.editId;
        Object.keys(d.form || {}).forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.value = d.form[id];
        });
        if (typeof window.openAddModal === 'function') window.openAddModal();
        if (typeof window.renderCart === 'function') window.renderCart();
        else if (typeof window.render === 'function') window.render();
        badge('✅ استُعيدت المسودة');
      } catch (e) { console.warn('[gmt-draft] restore:', e); }
    });
  }

  /* ── امسح المسودة بعد نجاح الحفظ السحابي ── */
  function hookSave() {
    if (typeof window.saveShipment !== 'function') return false;
    var orig = window.saveShipment;
    window.saveShipment = async function () {
      var r = await orig.apply(this, arguments);
      del();                                  // نجح الحفظ السحابي ⇒ المسودة لم تعد لازمة
      lastJSON = '';
      return r;
    };
    return true;
  }

  window.GMTDraft = { save: save, clear: del, restore: offerRestore };

  document.addEventListener('DOMContentLoaded', function () {
    if (!/06_PURCHASES|المشتريات|purchases/i.test(location.pathname + document.title)) return;
    timer = setInterval(save, 4000);          // حفظ كل 4 ثوانٍ عند وجود تغيير
    document.addEventListener('input', function () { clearTimeout(save._d); save._d = setTimeout(save, 900); });
    var tries = 0;
    var h = setInterval(function () { if (hookSave() || ++tries > 20) clearInterval(h); }, 300);
    setTimeout(offerRestore, 1200);
  });

  window.addEventListener('beforeunload', save);
})();
