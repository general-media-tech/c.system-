/* ═══════════════════════════════════════════════════════════════════════════
   gmt-inspector.js — المفتّش (المراقب) · v3.0 · 2026-07-13
   ─────────────────────────────────────────────────────────────────────────
   BOT-3 (طلبك الحرفي: «توسّع فيهم بكثير»): الحارس القديم كان يلتقط الأخطاء
   **الصاخبة** فقط (استثناء / HTTP 4xx). أما الأخطاء **الصامتة** — وهي التي
   دمّرت مخزونك شهوراً — فكانت تمرّ بلا أثر:

     ① زر يُضغط ولا يحدث شيء            (dead click)
     ② كتابة تُرسل وتُقبل ولا تُطبَّق فعلاً  (silent write / RLS)
     ③ كتابتان متطابقتان على نفس الصف    (⚠️ بصمة المضاعفة PUR-1)
     ④ طلب بطيء جداً أو معلَّق            (تجميد الصفحة UX-2)
     ⑤ ميزة موعودة لم تُجرَّب أبداً        (تغطية الميزات)

   v3 يلتقط الخمسة كلها، **يحفظها بـlocalStorage** (يصمد بعد F5)، ويرسلها
   للقاعدة (`inspector_sessions`) ⇒ يصل الأدمن دليل حقيقي بدل التخمين.

   ⚠️ صامت تماماً للكاشير — لا زر ولا نافذة. يظهر للأدمن/السيادي فقط.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTInspect && window.GMTInspect.version >= 3) return;

  var VERSION = 3.0;
  var LS_KEY = 'gmt_inspect3_' + (location.pathname.split('/').filter(Boolean).pop() || 'page');
  var MAX = 400;

  var S = {
    session: 'I' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    started: Date.now(),
    steps: [],       // رحلة المستخدم
    writes: [],      // كل كتابة + نتيجة التحقّق
    silent: [],      // الأخطاء الصامتة المكتشفة
    slow: [],        // الطلبات البطيئة
    feats: []        // تغطية الميزات
  };

  /* ═══ الحفظ الدائم (كان يضيع مع كل F5 — BOT-1) ═══ */
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (o && o.session) S = o;
    } catch (e) {}
  }
  function save() {
    try {
      ['steps', 'writes', 'silent', 'slow'].forEach(function (k) {
        if (S[k].length > MAX) S[k] = S[k].slice(-MAX);
      });
      localStorage.setItem(LS_KEY, JSON.stringify(S));
    } catch (e) { /* الحصة ممتلئة */ }
  }
  load();

  S.feats = (window.GMT_FEATURES || []).map(function (f) {
    var old = (S.feats || []).filter(function (x) { return x.id === f.id; })[0];
    return { id: f.id, t: f.t, expect: f.expect, tried: old ? old.tried : false, ok: old ? old.ok : null };
  });

  function role() {
    return (window.GMTBug && typeof GMTBug.role === 'function' && GMTBug.role()) || window.__gmtRole || 'cashier';
  }
  function isAdmin() { return /admin|sovereign|owner/i.test(role()); }

  function step(icon, text, extra) {
    S.steps.push({ t: Date.now(), i: icon, x: text, e: extra || null });
    save();
    paint();
  }

  /* ═══════════════════════════════════════════════════════════════════
     ① الأخطاء الصامتة — زر بلا أثر (dead click)
     المبدأ: نسجّل بصمة الصفحة (طول DOM + عدد الطلبات + المسار + النوافذ
     المفتوحة) قبل الضغط، ونقارنها بعد 900ms. إن لم يتغيّر شيء البتّة
     ⇒ الزر لم يفعل شيئاً.
     ═══════════════════════════════════════════════════════════════════ */
  var netCount = 0;
  function fingerprint() {
    return {
      dom: document.body ? document.body.innerHTML.length : 0,
      net: netCount,
      url: location.href,
      modals: document.querySelectorAll('[class*=modal]:not(.hidden),[class*=overlay]:not(.hidden),dialog[open]').length,
      focus: document.activeElement ? document.activeElement.tagName : ''
    };
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button,[role=button],a[onclick],[onclick]');
    if (!b) return;
    if (b.closest('.gg4,.gg4-idx,#gmt-bug-panel,#gmt-inspect-panel')) return;
    if (b.disabled) return;

    var label = (b.textContent || b.title || b.id || '').trim().replace(/\s+/g, ' ').slice(0, 44) || '(زر بلا نص)';
    step('👆', 'ضغط: ' + label);

    // تغطية الميزات
    S.feats.forEach(function (f) {
      if (f.id && (b.id === f.id || (b.dataset && b.dataset.feat === f.id))) f.tried = true;
    });

    var before = fingerprint();
    setTimeout(function () {
      var after = fingerprint();
      var changed =
        Math.abs(after.dom - before.dom) > 12 ||
        after.net !== before.net ||
        after.url !== before.url ||
        after.modals !== before.modals ||
        after.focus !== before.focus;

      if (!changed) {
        var msg = 'زر بلا أثر: «' + label + '» — لا طلب، لا تغيّر بالشاشة، لا نافذة.';
        S.silent.push({ t: Date.now(), kind: 'dead_click', msg: msg, el: b.id || b.className || '' });
        save();
        if (window.GMTBug && GMTBug.log) GMTBug.log('silent', msg, { type: 'dead_click', button: label });
      }
    }, 900);
  }, true);

  /* ═══════════════════════════════════════════════════════════════════
     ②③④ اعتراض الشبكة — تحقّق الكتابة · كشف المضاعفة · كشف البطء
     ═══════════════════════════════════════════════════════════════════ */
  var RF = (window.__gmtRealFetch || window.fetch).bind(window);
  window.__gmtRealFetch = RF;

  var recentWrites = [];   // للكشف عن الكتابة المزدوجة

  window.fetch = async function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var isWrite = /POST|PATCH|PUT|DELETE/.test(method);
    var isRest = /\/rest\/v1\//.test(url);
    var t0 = performance.now();

    netCount++;

    var res;
    try {
      res = await RF(input, init);
    } catch (err) {
      S.silent.push({ t: Date.now(), kind: 'net_fail', msg: method + ' فشل شبكياً: ' + (err && err.message), url: url.slice(0, 160) });
      save();
      throw err;
    }

    var ms = Math.round(performance.now() - t0);

    /* ④ البطء / التعليق (UX-2) */
    if (ms > 4000) {
      S.slow.push({ t: Date.now(), ms: ms, method: method, url: url.slice(0, 160) });
      save();
      if (ms > 9000 && window.GMTBug && GMTBug.log) {
        GMTBug.log('slow', 'طلب بطيء جداً (' + ms + 'ms) — سبب محتمل للتجميد: ' + method + ' ' + url.slice(0, 90));
      }
    }

    if (!isWrite || !isRest) return res;

    /* ③ الكتابة المزدوجة — نفس (method+url+body) خلال 3 ثوانٍ */
    var bodyStr = '';
    try { bodyStr = typeof (init && init.body) === 'string' ? init.body : JSON.stringify((init && init.body) || ''); } catch (e) {}
    var sig = method + '|' + url + '|' + bodyStr.slice(0, 300);
    var now = Date.now();
    recentWrites = recentWrites.filter(function (w) { return now - w.t < 3000; });
    var dup = recentWrites.filter(function (w) { return w.sig === sig; }).length;
    recentWrites.push({ sig: sig, t: now });
    if (dup >= 1) {
      var dmsg = '⚠️ كتابة مزدوجة: نفس ' + method + ' على نفس الصف مرتين خلال 3 ثوانٍ — هذه بصمة المضاعفة (PUR-1).';
      S.silent.push({ t: now, kind: 'double_write', msg: dmsg, url: url.slice(0, 160) });
      save();
      if (window.GMTBug && GMTBug.log) GMTBug.log('silent', dmsg, { type: 'double_write', url: url.slice(0, 160) });
    }

    /* ② تحقّق الكتابة الفعلي — أعد القراءة وقارن (يكشف صمت RLS) */
    var rec = { t: now, method: method, url: url.slice(0, 160), status: res.status, ms: ms, verified: null, note: '' };

    if (!res.ok) {
      rec.verified = false;
      rec.note = 'HTTP ' + res.status;
      S.writes.push(rec); save();
      return res;
    }

    if (method === 'PATCH' || method === 'POST') {
      (async function () {
        try {
          var payload = null;
          try { payload = JSON.parse(bodyStr); } catch (e) { return; }
          if (!payload || Array.isArray(payload)) return;
          var keys = Object.keys(payload).filter(function (k) { return typeof payload[k] !== 'object'; });
          if (!keys.length) return;

          // نتحقّق فقط من PATCH بمرشّح واضح (?id=eq.X)
          if (method !== 'PATCH' || !/[?&]id=eq\./.test(url)) { rec.verified = 'skip'; save(); return; }

          var vurl = url.split('&select=')[0] + '&select=' + keys.slice(0, 6).join(',');
          var vr = await RF(vurl, { headers: (init && init.headers) || {} });
          if (!vr.ok) { rec.verified = 'skip'; save(); return; }
          var arr = await vr.json();
          var row = Array.isArray(arr) ? arr[0] : arr;
          if (!row) { rec.verified = false; rec.note = 'الصف غير موجود بعد الكتابة'; save(); return; }

          var bad = keys.filter(function (k) {
            if (payload[k] === null || payload[k] === undefined) return false;
            return String(row[k]) !== String(payload[k]);
          });
          if (bad.length) {
            rec.verified = false;
            rec.note = 'لم تُطبَّق فعلياً: ' + bad.join(', ');
            var smsg = '🔴 كتابة صامتة الفشل: الخادم قبِل ' + method + ' لكن القيم لم تتغيّر بالقاعدة (' +
                       bad.join(', ') + ') — راجع صلاحيات RLS.';
            S.silent.push({ t: Date.now(), kind: 'silent_write', msg: smsg, url: url.slice(0, 160) });
            if (window.GMTBug && GMTBug.log) GMTBug.log('silent', smsg, { type: 'silent_write', fields: bad });
          } else {
            rec.verified = true;
          }
          save();
        } catch (e) { /* التحقّق أفضل جهد — لا يعطّل العمل */ }
      }());
    }

    S.writes.push(rec);
    save();
    return res;
  };

  /* ═══ ⑤ تغطية الميزات ═══ */
  function coverage() {
    var tried = S.feats.filter(function (f) { return f.tried; }).length;
    return { tried: tried, total: S.feats.length };
  }

  /* ═══ التقرير ═══ */
  function report() {
    var mins = Math.round((Date.now() - S.started) / 60000);
    var cov = coverage();
    var bugs = (window.GMTBug && GMTBug.list && GMTBug.list().length) || 0;
    var L = [];
    L.push('═══ تقرير المفتّش v3 ═══');
    L.push('الجلسة: ' + S.session + ' · المدة: ' + mins + ' دقيقة');
    L.push('المستخدم: ' + ((window.GMTBug && GMTBug.who && GMTBug.who()) || '—') + ' · الدور: ' + role());
    L.push('الصفحة: ' + document.title);
    L.push('الوضع: ' + ((window.GMTSandbox && GMTSandbox.active) ? '🏋️ تدريبي' : 'إنتاج'));
    L.push('');
    L.push('── الأرقام ──');
    L.push('خطوات الرحلة: ' + S.steps.length);
    L.push('كتابات على القاعدة: ' + S.writes.length +
           ' (✅ متحقَّقة: ' + S.writes.filter(function (w) { return w.verified === true; }).length +
           ' · ❌ فاشلة: ' + S.writes.filter(function (w) { return w.verified === false; }).length + ')');
    L.push('🔴 أخطاء صامتة: ' + S.silent.length);
    L.push('🐌 طلبات بطيئة (>4ث): ' + S.slow.length);
    L.push('🐞 أخطاء الحارس: ' + bugs);
    L.push('تغطية الميزات: ' + cov.tried + '/' + cov.total);
    L.push('');
    if (S.silent.length) {
      L.push('── 🔴 الأخطاء الصامتة (الأهم) ──');
      S.silent.slice(-25).forEach(function (x) {
        L.push('• [' + x.kind + '] ' + x.msg + (x.url ? ' — ' + x.url : ''));
      });
      L.push('');
    }
    if (S.slow.length) {
      L.push('── 🐌 البطء ──');
      S.slow.slice(-10).forEach(function (x) { L.push('• ' + x.ms + 'ms ' + x.method + ' ' + x.url); });
      L.push('');
    }
    var untried = S.feats.filter(function (f) { return !f.tried; });
    if (untried.length) {
      L.push('── ⚪ ميزات لم تُجرَّب بعد ──');
      untried.forEach(function (f) { L.push('• ' + f.t + ' — المتوقّع: ' + f.expect); });
      L.push('');
    }
    L.push('── 🧭 الرحلة (آخر 40 خطوة) ──');
    S.steps.slice(-40).forEach(function (s) {
      L.push('  ' + new Date(s.t).toLocaleTimeString('ar-SY') + ' ' + s.i + ' ' + s.x);
    });
    return L.join('\n');
  }

  /* ═══ الإرسال للقاعدة ═══ */
  async function send() {
    try {
      var url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL || window.SB;
      var key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || window.KEY;
      if (!url || !key) return;
      await RF(url + '/rest/v1/inspector_sessions', {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        keepalive: true,
        body: JSON.stringify({
          session_id: S.session,
          user_name: (window.GMTBug && GMTBug.who && GMTBug.who()) || null,
          role: role(),
          page: document.title,
          duration_min: Math.round((Date.now() - S.started) / 60000),
          steps: S.steps.slice(-120),
          silent_errors: S.silent,
          slow_requests: S.slow,
          writes_total: S.writes.length,
          writes_failed: S.writes.filter(function (w) { return w.verified === false; }).length,
          coverage: coverage(),
          training: !!(window.GMTSandbox && GMTSandbox.active),
          report: report()
        })
      });
    } catch (e) { /* لا نُفشل الصفحة أبداً بسبب التقرير */ }
  }
  window.addEventListener('pagehide', send);
  window.addEventListener('beforeunload', send);
  setInterval(function () { if (S.silent.length) send(); }, 5 * 60 * 1000);   // إرسال دوري إن ظهر خطأ صامت

  /* ═══ الواجهة (للأدمن فقط — صامتة للكاشير) ═══ */
  function paint() {
    var btn = document.getElementById('gmt-inspect-fab');
    if (!isAdmin()) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'gmt-inspect-fab';
      btn.style.cssText = 'position:fixed;left:14px;bottom:76px;z-index:2147481000;width:46px;height:46px;border-radius:50%;' +
        'border:0;background:#0f172a;color:#fff;font-size:19px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35);';
      btn.title = 'المفتّش — تقرير الجلسة';
      btn.onclick = panel;
      document.body.appendChild(btn);
    }
    var n = S.silent.length;
    btn.textContent = n ? '🔍' : '🔍';
    btn.style.background = n ? ((window.GMTBrand && GMTBrand.red()) || '#C00012') : '#0f172a';
  }

  function panel() {
    var old = document.getElementById('gmt-inspect-panel');
    if (old) { old.remove(); return; }
    var d = document.createElement('div');
    d.id = 'gmt-inspect-panel';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147481500;background:rgba(4,6,10,.94);backdrop-filter:blur(8px);' +
      'padding:16px;overflow:auto;direction:rtl;font-family:var(--gg-font,Cairo,system-ui,sans-serif);';
    d.innerHTML =
      '<div style="max-width:900px;margin:0 auto;background:#0f131c;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;color:#fff">' +
        '<div style="padding:14px 16px;background:#171d2a;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<b style="font-size:15px">🔍 المفتّش — تقرير الجلسة</b>' +
          '<div style="display:flex;gap:6px">' +
            '<button id="gi-copy" style="background:var(--gg-red,#C00012);color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">📋 نسخ التقرير</button>' +
            '<button id="gi-clr" style="background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">🗑 مسح</button>' +
            '<button id="gi-x" style="background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">✕</button>' +
          '</div>' +
        '</div>' +
        '<pre style="margin:0;padding:16px;font-size:12px;line-height:1.85;white-space:pre-wrap;color:#c9d1dc;font-family:ui-monospace,monospace">' +
          report().replace(/</g, '&lt;') + '</pre>' +
      '</div>';
    document.body.appendChild(d);
    d.querySelector('#gi-x').onclick = function () { d.remove(); };
    d.querySelector('#gi-clr').onclick = function () {
      S.steps = []; S.writes = []; S.silent = []; S.slow = [];
      save(); d.remove(); paint();
    };
    d.querySelector('#gi-copy').onclick = function () {
      try { navigator.clipboard.writeText(report()); alert('✅ نُسخ التقرير — أرسله للمطوّر.'); }
      catch (e) { alert('انسخه يدوياً من الشاشة.'); }
    };
  }

  /* ═══ الواجهة العامة ═══ */
  window.GMTInspect = {
    version: VERSION,
    session: S.session,
    step: step,
    report: report,
    send: send,
    open: panel,
    silent: function () { return S.silent; },
    writes: function () { return S.writes; },
    coverage: coverage,
    feature: function (id, ok) {
      var f = S.feats.filter(function (x) { return x.id === id; })[0];
      if (f) { f.tried = true; f.ok = ok !== false; save(); }
    },
    reset: function () { S.steps = []; S.writes = []; S.silent = []; S.slow = []; save(); paint(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
  setTimeout(paint, 2500);   // بعد أن يعرف الحارس دور المستخدم

  step('🚀', 'فتح الصفحة: ' + document.title);
}());
