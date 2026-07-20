/* ═══════════════════════════════════════════════════════════════════════
   gmt-bugcatcher.js — الحارس 🐞 v3
   يُرفع بجانب كل صفحة ويُستدعى **أول شيء** بالرأس (قبل أي سكربت آخر).

   ما تغيّر عن v2 (وهو سبب أن أخطاءك عاشت شهوراً بلا دليل):
   ① 💾 يحفظ فعلاً — v2 كان يخزّن بالذاكرة فقط، فأي تحديث أو تعليق للصفحة
      يمسح التقرير. v3 يحفظ بـlocalStorage ويصمد عبر الجلسات.
   ② 🤫 وضع صامت — الكاشير لا يرى زر 🐞 ولا أي نافذة. يسجّل بالخلفية فقط.
   ③ 📡 يرسل للأدمن — كل خطأ يذهب لجدول gmt_telemetry، فتراه أنت بلوحة
      «صحة النظام» لحظياً من كل نقاط البيع، بلا أن يخبرك أحد.
   ④ 🧬 يكشف أعطالاً كان يفوّتها:
      • كتابتان على **نفس الصف** خلال ثانيتين (هذا بالضبط نمط مضاعفة فاتورة
        الشراء — لو كان موجوداً لَكُشِف من أول فاتورة).
      • عمود مفقود بالقاعدة (PGRST204 / 42703) — يترجمها لرسالة مفهومة.
      • تجميد الواجهة (Freeze) عبر نبض rAF.
      • كتابة نجحت شكلاً ولم تُعدّل أي صف.
      • زر بلا أثر · بطء · تكرار · مخزون لم يُخصم.

   التعريف بالمستخدم (سطر واحد بكل صفحة بعد تسجيل الدخول):
      GMTBug.identify({ user:'محمد', branch:'حلب', role:'cashier', page:'نقطة البيع', pageId:'pos' });
   فتح اللوحة يدوياً (للأدمن/الدعم): Ctrl+Shift+B  أو  ضغطة مطوّلة على اللوجو.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTBug && window.GMTBug.version >= 3) return;

  /* ─────────── الإعدادات ─────────── */
  const MAX_LOCAL = 400;
  const LS_KEY = 'gmt_bugs_v3';
  const SS_KEY = 'gmt_session_v3';
  const FLUSH_MS = 12000;
  const SEV_AR = { crit: '🔴 حرج', warn: '🟠 تحذير', info: '🔵 ملاحظة' };

  const t0 = Date.now();
  let queue = [];              // بانتظار الإرسال
  let errors = [];             // كل ما بهذا الجهاز (يصمد)
  let ident = { user: '', branch: '', role: '', page: document.title || '', pageId: '' };
  let silent = true;           // 🔒 صامت افتراضاً حتى يثبت أن المستخدم أدمن (كان false ⇒ الكاشير يرى الزر)

  /* ─────────── الجلسة ─────────── */
  const sid = (function () {
    try {
      let s = sessionStorage.getItem(SS_KEY);
      if (!s) { s = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); sessionStorage.setItem(SS_KEY, s); }
      return s;
    } catch (_) { return 'S' + Date.now().toString(36); }
  })();

  /* ─────────── التخزين الدائم ─────────── */
  function load() { try { errors = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { errors = []; } }
  function persist() {
    try {
      if (errors.length > MAX_LOCAL) errors = errors.slice(-MAX_LOCAL);
      localStorage.setItem(LS_KEY, JSON.stringify(errors));
    } catch (_) { /* الحصة ممتلئة — نُبقي الأحدث */ try { errors = errors.slice(-100); localStorage.setItem(LS_KEY, JSON.stringify(errors)); } catch (__) {} }
  }
  load();

  /* ─────────── إعدادات القاعدة (تكتشف نفسها من الصفحة) ─────────── */
  let sniffed = null;               // إعدادات مُلتقَطة من طلبات الصفحة نفسها
  function sb() {
    const url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL || window.SUPA_URL ||
                (window.CONFIG && (CONFIG.SUPABASE_URL || CONFIG.supabaseUrl)) || (sniffed && sniffed.url);
    const key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || window.SUPA_KEY ||
                (window.CONFIG && (CONFIG.SUPABASE_ANON_KEY || CONFIG.supabaseKey)) || (sniffed && sniffed.key);
    return (url && key) ? { url: String(url).replace(/\/$/, ''), key } : null;
  }
  /* 🔑 التقاط المفتاح من أي طلب تُرسله الصفحة نفسها لسوبابيس.
     السبب: 13 من 17 صفحة لا تستدعي gmt-config.js — المفاتيح مضمَّنة بداخلها.
     بدون هذا الالتقاط كان الحارس يحفظ محلياً و**لا يرسل شيئاً للوحة الأدمن أبداً**. */
  function sniff(url, init) {
    if (sniffed) return;
    try {
      const u = new URL(url, location.href);
      if (!/supabase\.co$/i.test(u.hostname) || !/\/rest\/v1\//.test(u.pathname)) return;
      let key = u.searchParams.get('apikey');
      const h = init && init.headers;
      if (!key && h) {
        if (typeof h.get === 'function') key = h.get('apikey');
        else key = h.apikey || h.Apikey || h.APIKEY;
      }
      if (key) { sniffed = { url: u.origin, key }; window.GMT_SB = sniffed; }
    } catch (_) {}
  }

  const redact = (u) => String(u || '').replace(/([?&](apikey|token|key|authorization)=)[^&]+/gi, '$1***');
  const now = () => new Date().toLocaleTimeString('ar-SY', { hour12: false });
  const training = () => !!(window.GMTSandbox && window.GMTSandbox.active);

  /* ─────────── تسجيل خطأ ─────────── */
  function add(sev, type, msg, detail, url) {
    const key = type + '|' + String(msg).slice(0, 60);
    const dup = errors.find((e) => e._k === key && Date.now() - e.ts < 60000);
    if (dup) { dup.count = (dup.count || 1) + 1; persist(); paint(); return; }

    const rec = {
      _k: key, ts: Date.now(), t: now(), sev, type,
      msg: String(msg || '').slice(0, 400),
      detail: String(detail || '').slice(0, 600),
      url: redact(url || ''), count: 1,
      page: ident.page, pageId: ident.pageId,
      user: ident.user, branch: ident.branch, role: ident.role,
      training: training(),
    };
    errors.push(rec);
    queue.push(rec);
    persist();
    paint();
    if (sev === 'crit') flush();          // الحرج يُرسل فوراً
  }

  /* ─────────── الإرسال للأدمن ─────────── */
  let flushing = false;
  async function flush(useBeacon) {
    if (!queue.length || flushing) return;
    const cfg = sb();
    if (!cfg) return;                      // لا إعدادات — نكتفي بالحفظ المحلي
    const batch = queue.splice(0, 25);
    const rows = batch.map((e) => ({
      kind: 'error', severity: e.sev, page: e.page, page_id: e.pageId,
      user_name: e.user || null, branch: e.branch || null, role: e.role || null,
      session_id: sid, err_type: e.type, message: e.msg, detail: e.detail,
      url: e.url, device: navigator.userAgent.slice(0, 120),
      count: e.count, training: e.training,
    }));
    const body = JSON.stringify(rows);
    const endpoint = cfg.url + '/rest/v1/gmt_telemetry';

    if (useBeacon && navigator.sendBeacon) {
      try { navigator.sendBeacon(endpoint + '?apikey=' + cfg.key, new Blob([body], { type: 'application/json' })); } catch (_) {}
      return;
    }
    flushing = true;
    try {
      await (window.__gmtRealFetch || fetch)(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: 'return=minimal' },
        body,
      });
    } catch (_) { queue = batch.concat(queue); }   // فشل الإرسال — نعيدها للطابور
    finally { flushing = false; }
  }
  setInterval(() => flush(), FLUSH_MS);
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });

  /* ═══════════ ① الأخطاء الصريحة ═══════════ */
  window.addEventListener('error', (e) => {
    if (e && e.message) {
      add('crit', 'JS', e.message, (e.filename ? redact(e.filename) + ':' + e.lineno : '') + (e.error && e.error.stack ? '\n' + String(e.error.stack).slice(0, 300) : ''));
    } else if (e && e.target && (e.target.src || e.target.href)) {
      add('warn', 'مورد', 'فشل تحميل ' + (e.target.tagName || '') + ': ' + String(e.target.src || e.target.href).split('/').pop(), redact(e.target.src || e.target.href));
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    add('crit', 'Promise', (r && (r.message || r)) || 'رفض غير معالج', r && r.stack ? String(r.stack).slice(0, 300) : '');
  });

  const _cerr = console.error.bind(console);
  console.error = function () {
    try { add('warn', 'console', Array.from(arguments).map((a) => { try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (_) { return String(a); } }).join(' ').slice(0, 300)); } catch (_) {}
    return _cerr.apply(console, arguments);
  };

  /* ═══════════ ② الشبكة + الأخطاء الصامتة ═══════════ */
  const REAL_FETCH = window.fetch.bind(window);
  window.__gmtRealFetch = REAL_FETCH;

  const net = { last: 0, stockOps: 0 };
  const recentWrites = new Map();   // توقيع الكتابة → وقتها
  const recentRows   = new Map();   // جدول+صف → وقت آخر كتابة (كشف المضاعفة)

  /* ترجمة أخطاء القاعدة لرسالة يفهمها الإنسان */
  function explainDb(body) {
    try {
      const j = JSON.parse(body);
      if (j.code === 'PGRST204') {
        const col = (j.message.match(/'([^']+)' column/) || [])[1];
        return `عمود «${col || '؟'}» غير موجود بالقاعدة — الكود يخاطب عموداً لا وجود له. (خطأ مخطّط، لا خطأ إدخال.)`;
      }
      if (j.code === '42703') return 'دالة/عمود غير موجود بالقاعدة (42703) — تعريف خاطئ بالقاعدة.';
      if (j.code === '23505') return 'قيمة مكرّرة — السجل موجود مسبقاً.';
      if (j.code === '23503') return 'ارتباط مفقود — السجل المرتبط غير موجود.';
      return j.message || body;
    } catch (_) { return body; }
  }

  /* استخراج «الصف» المستهدف من رابط PostgREST: /products?id=eq.55 */
  function rowKey(url) {
    try {
      const u = new URL(url, location.href);
      const table = (u.pathname.match(/\/rest\/v1\/([^/?]+)/) || [])[1];
      if (!table) return null;
      const idp = Array.from(u.searchParams.entries()).find(([k, v]) => /^(id|barcode|inv_number)$/.test(k) && /^eq\./.test(v));
      return idp ? table + '#' + idp[1] : null;
    } catch (_) { return null; }
  }

  /* ⏱️ مهلة عامة لكل طلب (UX-2 «تعليق/تجميد متكرر»)
     السبب الجذري: طلبات بلا مهلة ولا AbortController — إن لم يردّ السيرفر تبقى
     الصفحة تنتظر إلى الأبد وتبدو «معلّقة». الآن: أي طلب بلا signal يُقطع بعد 20ث
     ويُسجَّل خطأ مفهوم بدل تجميد صامت. */
  const REQ_TIMEOUT = 20000;
  function withTimeout(init) {
    if (init && init.signal) return { init, done: () => {} };
    let ctrl;
    try { ctrl = new AbortController(); } catch (_) { return { init, done: () => {} }; }
    const t = setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, REQ_TIMEOUT);
    return { init: Object.assign({}, init || {}, { signal: ctrl.signal }), done: () => clearTimeout(t) };
  }

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
    const isWrite = method !== 'GET' && method !== 'HEAD';
    const started = Date.now();
    net.last = started;
    if (!/gmt_telemetry/.test(url)) sniff(url, init);

    if (isWrite && !/gmt_telemetry/.test(url)) {
      const sig = method + ' ' + url.split('?')[0] + ' ' + String((init && init.body) || '').slice(0, 80);
      const prev = recentWrites.get(sig);
      if (prev && started - prev < 2000) add('warn', 'تكرار', 'نفس عملية الكتابة تكرّرت خلال ثانيتين — خطر ازدواج', method + ' ' + redact(url));
      recentWrites.set(sig, started);
      setTimeout(() => recentWrites.delete(sig), 4000);

      /* 🔴 كشف المضاعفة: كتابتان على نفس الصف خلال ثانيتين (ولو بقيمتين مختلفتين) */
      const rk = rowKey(url);
      if (rk) {
        const p = recentRows.get(rk);
        if (p && started - p < 2000) {
          add('crit', 'كتابة مزدوجة',
            `كُتب على نفس السجل (${rk}) مرتين خلال ثانيتين — هذا نمط المضاعفة: قد تُطبَّق الكمية أو المبلغ مرّتين.`,
            method + ' ' + redact(url));
        }
        recentRows.set(rk, started);
        setTimeout(() => recentRows.delete(rk), 4000);
      }

      if (/products|decrement_branch_stock|increment_branch_stock/i.test(url)) net.stockOps++;
      if (/\/invoices\b/i.test(url) && method === 'POST') checkStockAfterSale();
    }

    const T = withTimeout(init);
    try {
      const res = await REAL_FETCH(input, T.init);
      T.done();
      const took = Date.now() - started;
      if (took > 8000) add('warn', 'بطء', `الطلب استغرق ${(took / 1000).toFixed(1)} ثانية`, method + ' ' + redact(url));

      if (!res.ok && res.status !== 406) {
        let body = '';
        try { body = (await res.clone().text()).slice(0, 300); } catch (_) {}
        add('crit', 'HTTP ' + res.status, explainDb(body), method + ' ' + redact(url) + '\n' + body);
        return res;
      }
      if (isWrite && res.status === 200) {
        try {
          const txt = await res.clone().text();
          if (txt && txt.trim() === '[]') add('crit', 'كتابة بلا أثر', `${method} نجح لكنه لم يُعدّل أي صف — العملية لم تحدث فعلياً!`, redact(url));
        } catch (_) {}
      }
      return res;
    } catch (err) {
      T.done();
      const aborted = err && (err.name === 'AbortError' || /abort/i.test(err.message || ''));
      add('crit', 'شبكة', method + ' ' + redact(url),
        aborted ? `انقطع الطلب بعد ${REQ_TIMEOUT / 1000} ثانية (مهلة) — السيرفر لم يردّ. الصفحة لم تتجمّد.` : ((err && err.message) || 'فشل الاتصال'));
      throw err;
    }
  };

  function checkStockAfterSale() {
    const before = net.stockOps;
    setTimeout(() => {
      if (net.stockOps === before) add('crit', 'مخزون', 'حُفظت فاتورة بيع ولم يُرصد أي خصم من المخزون خلال 5 ثوانٍ!', 'راجع الفاتورة الأخيرة يدوياً.');
    }, 5000);
  }

  /* ═══════════ ③ زر بلا أثر ═══════════ */
  let domDirty = false;
  try { new MutationObserver(() => { domDirty = true; }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true }); } catch (_) {}

  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest && e.target.closest('button, [onclick], .btn, a[role="button"]');
    if (!el || el.disabled) return;
    const label = (el.textContent || el.title || el.id || 'زر').trim().slice(0, 40);
    if (/🐞|🔍|🎓|تقرير|إغلاق|نسخ|مسح|التالي|تخطّ/.test(label)) return;
    const before = net.last;
    domDirty = false;
    setTimeout(() => {
      if (net.last === before && !domDirty) {
        add('warn', 'زر بلا أثر', `ضغطت «${label}» ولم يحدث شيء (لا طلب شبكة ولا تغيّر بالواجهة)`, 'قد يكون الزر معطّلاً أو دالته مفقودة.');
      }
    }, 2000);
  }, true);

  /* ═══════════ ④ تجميد الواجهة ═══════════ */
  let hiddenSince = false;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenSince = true; });
  (function heartbeat() {
    let last = performance.now();
    function tick(t) {
      const gap = t - last;
      /* لا نُبلّغ إذا كان التبويب مخفياً — rAF يتوقف طبيعياً حينها (كان مصدر إنذارات كاذبة) */
      if (gap > 3000 && document.visibilityState === 'visible' && !hiddenSince) {
        add('warn', 'تجميد', `تجمّدت الواجهة ${(gap / 1000).toFixed(1)} ثانية`, 'عملية ثقيلة أو حلقة لا تنتهي.');
      }
      hiddenSince = false;
      last = t;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ═══════════ ⑤ فحوصات الصحة الحسابية ═══════════ */
  function check(name, ok, details) {
    if (ok) return true;
    add('crit', 'حساب', 'فحص فشل: ' + name, details || '');
    return false;
  }
  const invariants = {
    invoiceTotal(total, items) {
      const sum = (items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
      return check('إجمالي الفاتورة = مجموع البنود', Math.abs(sum - Number(total)) < 0.02, `الإجمالي: ${total} · مجموع البنود: ${sum.toFixed(2)}`);
    },
    stockNonNegative(name, qty) { return check('المخزون لا يكون سالباً', Number(qty) >= 0, `${name}: ${qty}`); },
    notBelowCost(price, cost, who) {
      return check('لا بيع تحت سعر التكلفة', Number(price) >= Number(cost), `السعر ${price} · التكلفة ${cost} · المستخدم ${who || '؟'}`);
    },
    commission(comm, price, wholesale) {
      const expect = (Number(price) - Number(wholesale)) / 2;
      return check('العمولة = نصف (البيع − الجملة)', Math.abs(expect - Number(comm)) < 0.02, `المتوقع ${expect.toFixed(2)} · المسجَّل ${comm}`);
    },
  };

  /* ═══════════ الواجهة (تظهر للأدمن فقط) ═══════════ */
  let btn = null, panel = null;

  function paint() {
    if (silent) { if (btn) btn.style.display = 'none'; return; }
    if (!document.body) { document.addEventListener('DOMContentLoaded', paint, { once: true }); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'gmt-bug-btn';
      btn.setAttribute('aria-label', 'تقرير الأخطاء');
      btn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483000;width:52px;height:52px;border-radius:50%;color:#fff;border:2px solid rgba(255,255,255,.2);font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-family:Cairo,Arial,sans-serif;';
      btn.onclick = openPanel;
      document.body.appendChild(btn);
    }
    const crit = errors.filter((e) => e.sev === 'crit').length;
    btn.style.background = crit ? '#C00012' : '#b45309';
    btn.innerHTML = '🐞<span style="position:absolute;top:-4px;left:-4px;background:#111;color:#fff;font-size:10px;font-weight:900;border-radius:99px;padding:2px 6px;">' + errors.length + '</span>';
    btn.style.display = errors.length ? 'flex' : 'none';
  }

  function buildReport() {
    const crit = errors.filter((e) => e.sev === 'crit');
    const head = [
      '═══ تقرير الحارس — GMT 🐞 v3 ═══',
      'الصفحة: ' + (ident.page || document.title),
      'المستخدم: ' + (ident.user || '—') + ' · الفرع: ' + (ident.branch || '—') + ' · الدور: ' + (ident.role || '—'),
      'الجلسة: ' + sid,
      'الرابط: ' + redact(location.href),
      'الوقت: ' + new Date().toLocaleString('ar-SY') + ' (بعد ' + Math.round((Date.now() - t0) / 1000) + 'ث من الفتح)',
      'الجهاز: ' + navigator.userAgent.slice(0, 110),
      'وضع تدريبي: ' + (training() ? 'نعم' : 'لا'),
      `الإجمالي: ${errors.length} (حرج: ${crit.length})`,
      '──────────────────────',
    ];
    const body = errors.map((e, i) =>
      `#${i + 1} [${e.t}] ${SEV_AR[e.sev]} — ${e.type}${e.count > 1 ? ` (تكرّر ${e.count}×)` : ''}\n${e.msg}${e.detail ? '\n↳ ' + e.detail : ''}`
    ).join('\n─────\n');
    return head.join('\n') + '\n' + body;
  }

  function openPanel() {
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,Arial,sans-serif;direction:rtl;';
    const crit = errors.filter((e) => e.sev === 'crit').length;
    panel.innerHTML =
      '<div style="background:#161a22;color:#e7e9ee;border:1px solid #2a3040;border-radius:16px;max-width:600px;width:100%;max-height:86vh;display:flex;flex-direction:column;padding:16px;">' +
      `<div style="font-weight:900;font-size:15px;margin-bottom:3px;">🐞 الحارس — ${errors.length} ملاحظة${crit ? ` (<span style="color:#f87171;">${crit} حرجة</span>)` : ''}</div>` +
      '<div style="font-size:11px;color:#9aa3b2;font-weight:700;margin-bottom:9px;line-height:1.7;">محفوظ على الجهاز ومُرسَل للوحة الأدمن. يراقب: البرمجة · الشبكة · <b>الصامت</b> (زر بلا أثر · كتابة مزدوجة · كتابة بلا نتيجة · مخزون لم يُخصم · تجميد · عمود مفقود).</div>' +
      '<textarea readonly id="gmt-bug-ta" style="flex:1;min-height:250px;background:#0e1117;color:#cdd3de;border:1px solid #2a3040;border-radius:10px;padding:10px;font-size:11px;line-height:1.7;direction:ltr;text-align:left;white-space:pre;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<button id="gmt-bug-copy" style="flex:1;background:#C00012;color:#fff;border:none;border-radius:10px;padding:11px;font-weight:900;font-family:inherit;cursor:pointer;">📋 نسخ التقرير</button>' +
      '<button id="gmt-bug-clear" style="background:#232936;color:#c6ccd8;border:none;border-radius:10px;padding:11px 14px;font-weight:800;font-family:inherit;cursor:pointer;">مسح</button>' +
      '<button id="gmt-bug-close" style="background:#232936;color:#c6ccd8;border:none;border-radius:10px;padding:11px 14px;font-weight:800;font-family:inherit;cursor:pointer;">إغلاق</button>' +
      '</div></div>';
    document.body.appendChild(panel);
    const ta = panel.querySelector('#gmt-bug-ta');
    ta.value = buildReport();
    panel.querySelector('#gmt-bug-close').onclick = () => { panel.remove(); panel = null; };
    panel.querySelector('#gmt-bug-clear').onclick = () => { errors = []; persist(); paint(); panel.remove(); panel = null; };
    panel.querySelector('#gmt-bug-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); try { document.execCommand('copy'); } catch (_) {} }
      panel.querySelector('#gmt-bug-copy').textContent = '✓ نُسخ — ألصقه بالرسالة';
    };
  }

  /* فتح سرّي للأدمن/الدعم حتى بالوضع الصامت */
  document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) openPanel(); });
  let holdT = null;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target && e.target.closest && e.target.closest('img[src*="logo"], .logo, #logo');
    if (!el) return;
    holdT = setTimeout(openPanel, 1800);
  });
  document.addEventListener('pointerup', () => { if (holdT) clearTimeout(holdT); });

  /* ─────────── الواجهة البرمجية ─────────── */
  /* ═══════════ ⑥ التعريف التلقائي (بلا تعديل أي صفحة) ═══════════
     الصفحات تستعمل متغيراً عاماً currentUser + branch — نقرأهما دورياً.
     الدور: سيادي (?sovereign=1) · أدمن (صفحات الإدارة) · كاشير (الباقي). */
  const PAGES = [
    [/02_|pos|نقطة/i,        { page: 'نقطة البيع', pageId: 'pos', admin: false }],
    [/03_|inventory|الجرد/i, { page: 'الجرد', pageId: 'inventory', admin: false }],
    [/04_|admin_pos|أدمن_نقاط/i, { page: 'أدمن نقاط البيع', pageId: 'admin_pos', admin: true }],
    [/05_|orders|الأوردرات/i,{ page: 'الأوردرات', pageId: 'orders', admin: false }],
    [/06_|purchase|المشتريات/i, { page: 'المشتريات', pageId: 'purchases', admin: true }],
    [/07_|bridge|الجسر/i,    { page: 'الجسر', pageId: 'bridge', admin: true }],
    [/08_|store|المتجر\.|المتجر\b/i, { page: 'المتجر', pageId: 'store', admin: false }],
    [/09_|أدمن_المتجر/i,     { page: 'أدمن المتجر', pageId: 'admin_store', admin: true }],
    [/10_|إنشاء_الكفالة/i,   { page: 'إنشاء الكفالة', pageId: 'warranty_new', admin: false }],
    [/11_|أدمن_الكفالة/i,    { page: 'أدمن الكفالة', pageId: 'warranty_admin', admin: true }],
    [/12_|بحث_الكفالة/i,     { page: 'بحث الكفالة', pageId: 'warranty_find', admin: false }],
    [/13_|sovereign|السيادي/i, { page: 'الأدمن السيادي', pageId: 'sovereign', admin: true }],
    [/14_|contract|العقود/i, { page: 'العقود', pageId: 'contracts', admin: false }],
    [/15b|أدمن_الموقع/i,     { page: 'أدمن الموقع', pageId: 'admin_site', admin: true }],
    [/15_|الموقع_الرئيسي/i,  { page: 'الموقع', pageId: 'site', admin: false }],
    [/16_|tracking|التتبع|الشحنة/i, { page: 'تتبع الشحنة', pageId: 'tracking', admin: false }],
    [/17_|backup|النسخ/i,    { page: 'النسخ الاحتياطي', pageId: 'backup', admin: true }],
  ];
  function autoIdentify() {
    const path = decodeURIComponent(location.pathname + location.search);
    const hit = (PAGES.find(([re]) => re.test(path)) || [])[1];
    const sov = /[?&]sovereign=1/.test(location.search) || (function () { try { return sessionStorage.getItem('gmt_sov_ok') === '1'; } catch (_) { return false; } })();
    const u = window.currentUser || null;
    const b = window.branch || null;
    const o = {
      page: (hit && hit.page) || document.title || '',
      pageId: (hit && hit.pageId) || '',
      user: (u && (u.display_name || u.username || u.name)) || ident.user || '',
      branch: (b && (b.name || b.key || b.branch_key)) || (u && u.branch_key) || ident.branch || '',
      role: sov ? 'sovereign' : (hit && hit.admin ? 'admin' : 'cashier'),
    };
    if (o.page !== ident.page || o.user !== ident.user || o.role !== ident.role || o.branch !== ident.branch) {
      window.GMTBug.identify(o);
    }
  }

  window.GMTBug = {
    version: 3.1,
    role: () => ident.role,
    config: sb,
    list: () => errors.slice(),
    report: buildReport,
    add, check, invariants,
    open: openPanel,
    flush,
    session: sid,
    identify(o) {
      ident = Object.assign(ident, o || {});
      /* الصمت التلقائي: أي دور غير الأدمن/السيادي = صامت */
      silent = !/admin|sovereign|owner/i.test(ident.role || '');
      if (o && typeof o.silent === 'boolean') silent = o.silent;
      paint();
    },
    setSilent(v) { silent = !!v; paint(); },
    clear() { errors = []; persist(); paint(); },
  };

  autoIdentify();
  setInterval(autoIdentify, 2000);
  paint();
})();
