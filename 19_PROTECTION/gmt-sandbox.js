/* ═══════════════════════════════════════════════════════════════════════
   gmt-sandbox.js — الوضع التدريبي/التجريبي 🎓 v2 (2026-07-12)
   يُرفع بجانب كل صفحة ويُستدعى بالرأس **بعد** gmt-bugcatcher.js.

   ═══ ما تغيّر عن v1 — وهو خطير ═══
   📨 **تيليغرام يُرسل — لكن موسوماً**: قرار المالك أن الإشعار يصل الإدارة بختم
      «🎓 تجريبية — غير حقيقية» ليتدرّب الأدمن على الموافقة/التعديل أيضاً.
      v2 يحقن الوسم بأول كل رسالة تلقائياً (ولو نسي المستخدم).
      أما الويبهوكس والبريد وSMS ورفع الملفات ⇒ تُحتجَز (لا فائدة تدريبية منها).
   🔴 v1 كان يحاكي حتى إرسال أخطاء الحارس ⇒ **أخطاء التدريب لا تصل لوحتك أبداً**.
      v2 يمرّر التلمتري حقيقياً مع وسم training=true (تصلك ولا تلوّث تقاريرك).
   🆕 **مسجّل الجلسة**: كل خطوة تُسجَّل (بيع · مرتجع · خصم مخزون · إشعار مُحتجَز · خطأ)،
      ومنه تقرير نهاية جلسة قابل للنسخ/الإرسال — هذا هو «صندوق أسود» التدريب.
   🆕 **ختم مائي بالطباعة**: أي فاتورة تُطبع بالوضع التدريبي تحمل «نسخة تدريبية» —
      حتى لا تُخلط بفاتورة حقيقية.
   🆕 **الأخطاء تُعرض للمتدرّب** (عكس الإنتاج الصامت) — لأن الهدف تعليمه لا مراقبته.
   🆕 حماية النسيان: شريط دائم + إطار أحمر + خروج تلقائي بعد 3 ساعات.

   ─ التفعيل: `?training=1` · أو زر «وضع تدريبي» بالدليل 🎓 · أو GMTSandbox.enter()
   ─ المبدأ: القراءة حقيقية (منتجاتك وأسعارك كما هي) وكل كتابة تُحاكى بالذاكرة.
   ─ الخروج يمسح كل شيء (لم يُكتب أصلاً بالقاعدة).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SS_ON = 'gmt_training';
  const SS_DB = 'gmt_training_db';
  const SS_LOG = 'gmt_training_log';
  const SS_T0 = 'gmt_training_started';
  const MAX_HOURS = 3;

  const qs = new URLSearchParams(location.search).get('training') === '1';
  if (qs) { try { sessionStorage.setItem(SS_ON, '1'); if (!sessionStorage.getItem(SS_T0)) sessionStorage.setItem(SS_T0, String(Date.now())); } catch (_) {} }
  const isOn = () => { try { return sessionStorage.getItem(SS_ON) === '1'; } catch (_) { return false; } };

  /* دخول/خروج متاحان دائماً — حتى قبل التفعيل */
  function enter() {
    try { sessionStorage.setItem(SS_ON, '1'); sessionStorage.setItem(SS_T0, String(Date.now())); } catch (_) {}
    const u = new URL(location.href); u.searchParams.set('training', '1'); location.href = u.toString();
  }
  function exit(silent) {
    try { sessionStorage.removeItem(SS_ON); sessionStorage.removeItem(SS_DB); sessionStorage.removeItem(SS_LOG); sessionStorage.removeItem(SS_T0); } catch (_) {}
    if (silent) return;
    const u = new URL(location.href); u.searchParams.delete('training'); location.href = u.toString();
  }

  if (!isOn()) { window.GMTSandbox = { active: false, enter, exit }; return; }

  /* انتهت مهلة التدريب؟ (نسيان الوضع مفتوح = خطر) */
  try {
    const t0 = Number(sessionStorage.getItem(SS_T0) || Date.now());
    if (Date.now() - t0 > MAX_HOURS * 3600e3) { exit(true); location.reload(); return; }
  } catch (_) {}

  /* ══════════ المخزن ══════════ */
  let DB = { rows: {}, patches: {}, deleted: {}, seq: 0 };
  try { const s = sessionStorage.getItem(SS_DB); if (s) DB = JSON.parse(s); } catch (_) {}
  const save = () => { try { sessionStorage.setItem(SS_DB, JSON.stringify(DB)); } catch (_) {} };
  const nextId = () => { DB.seq += 1; return -(Date.now() * 100 + (DB.seq % 100)); }; // معرّفات سالبة = تدريبية

  /* ══════════ 🆕 مسجّل الجلسة (الصندوق الأسود) ══════════ */
  let LOG = [];
  try { LOG = JSON.parse(sessionStorage.getItem(SS_LOG) || '[]'); } catch (_) {}
  const stat = { writes: 0, blocked: 0, errors: 0, sent: 0 };
  LOG.forEach((e) => { if (e.k === 'write') stat.writes++; if (e.k === 'blocked') stat.blocked++; if (e.k === 'error') stat.errors++; if (e.k === 'sent') stat.sent++; });

  function rec(kind, title, detail) {
    LOG.push({ k: kind, t: new Date().toLocaleTimeString('ar-SY', { hour12: false }), ts: Date.now(), title: String(title || '').slice(0, 160), detail: String(detail || '').slice(0, 300) });
    if (LOG.length > 300) LOG = LOG.slice(-300);
    if (kind === 'write') stat.writes++;
    if (kind === 'blocked') stat.blocked++;
    if (kind === 'error') stat.errors++;
    if (kind === 'sent') stat.sent++;
    try { sessionStorage.setItem(SS_LOG, JSON.stringify(LOG)); } catch (_) {}
    paintBanner();
  }

  const REAL = window.__gmtRealFetch || window.fetch.bind(window);

  /* ══════════ 🔒 الآثار الخارجية الممنوعة ══════════
     أي نداء لهذه الجهات يُحتجَز ويُسجَّل — ولا يخرج من الجهاز. */
  const BLOCKED = [
    { re: /(wa\.me|whatsapp|graph\.facebook)/i,  name: 'رسالة واتساب' },
    { re: /(hooks?\.|webhook|zapier|make\.com|n8n)/i, name: 'ويبهوك خارجي' },
    { re: /(sendgrid|mailgun|smtp|resend\.com)/i, name: 'بريد إلكتروني' },
    { re: /(sms|twilio|vonage)/i,                name: 'رسالة SMS' },
  ];

  /* 📨 تيليغرام: يُرسل فعلاً لكن **موسوماً** (قرار المالك) — ليتدرّب الأدمن على الفواتير أيضاً */
  const TAG = '🎓 <b>رسالة تدريبية — غير حقيقية · لم تُحفظ بالقاعدة ولم يُخصم مخزون</b>\n━━━━━━━━━━━━━━━\n';
  const TAG_PLAIN = '🎓 رسالة تدريبية — غير حقيقية · لم تُحفظ بالقاعدة ولم يُخصم مخزون\n━━━━━━━━━━━━━━━\n';
  const isTelegram = (u) => /api\.telegram\.org/i.test(String(u || ''));

  /* يحقن الوسم بأي حقل نصّي بالرسالة (text / caption) مهما كانت صيغة الإرسال */
  function tagTelegram(init, input) {
    try {
      if (!init || init.body == null) return init;
      const b = init.body;
      if (typeof b === 'string') {
        try {
          const j = JSON.parse(b);
          if (j.text)    j.text    = TAG + String(j.text);
          if (j.caption) j.caption = TAG + String(j.caption);
          if (!j.parse_mode && (j.text || j.caption)) j.parse_mode = 'HTML';
          return Object.assign({}, init, { body: JSON.stringify(j) });
        } catch (_) {
          // urlencoded
          if (/text=|caption=/.test(b)) {
            const sp = new URLSearchParams(b);
            if (sp.get('text'))    sp.set('text', TAG_PLAIN + sp.get('text'));
            if (sp.get('caption')) sp.set('caption', TAG_PLAIN + sp.get('caption'));
            return Object.assign({}, init, { body: sp.toString() });
          }
          return init;
        }
      }
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        ['caption', 'text'].forEach((k) => { const v = b.get(k); if (v) b.set(k, TAG_PLAIN + v); });
        return init;
      }
    } catch (_) {}
    return init;
  }
  function blockedBy(url) {
    const u = String(url || '');
    for (const b of BLOCKED) if (b.re.test(u)) return b;
    return null;
  }

  /* ══════════ أدوات ══════════ */
  function parseUrl(url) {
    try {
      const u = new URL(url, location.href);
      if (!u.hostname.includes('supabase.co')) return { kind: 'other', u };
      if (u.pathname.startsWith('/storage/')) return { kind: 'storage', u };
      const m = u.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
      if (m) return { kind: 'rpc', fn: m[1], u };
      const t = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
      if (t) return { kind: 'table', table: decodeURIComponent(t[1]), u };
      return { kind: 'other-sb', u };
    } catch (_) { return { kind: 'other' }; }
  }
  function getHeader(init, input, name) {
    const pick = (h) => { if (!h) return null; if (typeof h.get === 'function') return h.get(name); const k = Object.keys(h).find((x) => x.toLowerCase() === name.toLowerCase()); return k ? h[k] : null; };
    return pick(init && init.headers) || (typeof input !== 'string' && input && pick(input.headers)) || null;
  }
  async function parseBody(input, init) {
    try {
      if (init && init.body != null) return typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      if (typeof input !== 'string' && input && typeof input.clone === 'function') return await input.clone().json();
    } catch (_) {}
    return null;
  }
  function parseFilters(u) {
    const f = [], ors = [];
    u.searchParams.forEach((v, k) => {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) return;
      if (k === 'or') {
        const inner = v.replace(/^\(|\)$/g, '').split(',');
        const g = [];
        inner.forEach((c) => { const m = c.match(/^([\w.]+)\.eq\.(.*)$/); if (m) g.push({ col: m[1], val: m[2] }); });
        if (g.length) ors.push(g);
        return;
      }
      let m = v.match(/^eq\.(.*)$/); if (m) { f.push({ col: k, op: 'eq', val: m[1] }); return; }
      m = v.match(/^in\.\((.*)\)$/); if (m) { f.push({ col: k, op: 'in', vals: m[1].split(',').map((x) => x.replace(/^"|"$/g, '')) }); }
    });
    return { ands: f, ors };
  }
  const same = (a, b) => String(a) === String(b);
  function rowMatches(row, F) {
    for (const c of F.ands) {
      if (c.op === 'eq' && !same(row[c.col], c.val)) return false;
      if (c.op === 'in' && !c.vals.some((v) => same(row[c.col], v))) return false;
    }
    for (const g of F.ors) { if (!g.some((c) => same(row[c.col], c.val))) return false; }
    return true;
  }
  function project(row, select) {
    if (!select || select === '*') return row;
    const out = {};
    select.split(',').forEach((c) => { const k = c.split(':').pop().split('(')[0].trim(); if (k && k !== '*') out[k] = row[k]; });
    return Object.keys(out).length ? out : row;
  }
  const J = (data, status = 200) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  /* أسماء عربية للجداول (لتقرير مفهوم) */
  const TBL_AR = {
    invoices: 'فاتورة', invoice_items: 'بنود فاتورة', invoice_commissions: 'عمولة',
    products: 'منتج', gmt_orders: 'أوردر', warranties: 'كفالة', contracts: 'عقد',
    purchases: 'فاتورة شراء', reservations: 'حجز', settlements: 'تسوية', stock_moves: 'حركة مخزون',
  };
  const arTbl = (t) => TBL_AR[t] || t;

  /* ══════════ محاكاة الكتابة ══════════ */
  async function simulate(p, method, input, init) {
    const table = p.table;
    const F = parseFilters(p.u);
    const prefer = String(getHeader(init, input, 'Prefer') || '');
    const wantRep = prefer.includes('return=representation');

    if (method === 'POST') {
      const body = await parseBody(input, init);
      const arr = Array.isArray(body) ? body : [body || {}];
      const made = arr.map((r) => {
        const row = Object.assign({ created_at: new Date().toISOString(), __training: true }, r);
        if (row.id == null) row.id = nextId();
        return row;
      });
      (DB.rows[table] = DB.rows[table] || []).push(...made);
      save();
      rec('write', `أُنشئ ${arTbl(table)} تدريبي (${made.length})`, made.map((m) => m.inv_number || m.name || m.id).join(' · ').slice(0, 120));
      return wantRep ? J(made, 201) : new Response(null, { status: 201 });
    }

    if (method === 'PATCH') {
      const body = (await parseBody(input, init)) || {};
      const local = DB.rows[table] || [];
      const hit = local.filter((r) => rowMatches(r, F));
      hit.forEach((r) => Object.assign(r, body));
      const idEq = F.ands.find((c) => c.col === 'id' && c.op === 'eq');
      if (idEq && !hit.length) {
        DB.patches[table] = DB.patches[table] || {};
        DB.patches[table][idEq.val] = Object.assign({}, DB.patches[table][idEq.val], body);
      }
      save();
      rec('write', `تعديل ${arTbl(table)}`, Object.keys(body).slice(0, 6).join(' · '));
      return wantRep ? J(hit.length ? hit : [Object.assign({ id: idEq ? idEq.val : null }, body)]) : new Response(null, { status: 204 });
    }

    if (method === 'DELETE') {
      const local = DB.rows[table] || [];
      DB.rows[table] = local.filter((r) => !rowMatches(r, F));
      const idEq = F.ands.find((c) => c.col === 'id' && c.op === 'eq');
      if (idEq) (DB.deleted[table] = DB.deleted[table] || []).push(String(idEq.val));
      save();
      rec('write', `حذف من ${arTbl(table)} (محاكاة)`, '');
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 204 });
  }

  /* ══════════ محاكاة RPC (خصم/زيادة المخزون) ══════════ */
  async function simulateRpc(p, input, init) {
    const body = (await parseBody(input, init)) || {};
    if (p.fn === 'decrement_branch_stock' || p.fn === 'increment_branch_stock') {
      const pid = String(body.p_product_id), br = body.p_branch_key, q = parseFloat(body.p_qty) || 0;
      let cur = 0;
      try {
        const over = DB.patches.products && DB.patches.products[pid];
        if (over && over[br] != null) cur = parseFloat(over[br]) || 0;
        else {
          const r = await REAL(p.u.origin + '/rest/v1/products?id=eq.' + encodeURIComponent(pid) + '&select=' + encodeURIComponent(br), { headers: (init && init.headers) || undefined });
          const rows = await r.json();
          cur = rows && rows[0] ? parseFloat(rows[0][br]) || 0 : 0;
        }
      } catch (_) {}
      const nv = p.fn.startsWith('dec') ? Math.max(0, cur - q) : cur + q;
      DB.patches.products = DB.patches.products || {};
      DB.patches.products[pid] = Object.assign({}, DB.patches.products[pid], { [br]: nv });
      save();
      rec('write', (p.fn.startsWith('dec') ? 'خصم' : 'زيادة') + ` مخزون (محاكاة): ${q} — الرصيد الوهمي ${nv}`, 'المنتج #' + pid + ' · الفرع ' + br);
      return J(nv);
    }
    rec('write', 'استدعاء دالة قاعدة (محاكاة): ' + p.fn, '');
    return J(null);
  }

  /* ══════════ دمج القراءة ══════════ */
  async function mergeGet(p, res) {
    const table = p.table;
    const hasLocal = (DB.rows[table] && DB.rows[table].length) || DB.patches[table] || (DB.deleted[table] && DB.deleted[table].length);
    if (!hasLocal) return res;
    let data;
    try { data = await res.clone().json(); } catch (_) { return res; }
    if (!Array.isArray(data)) return res;
    const F = parseFilters(p.u);
    const del = DB.deleted[table] || [];
    const pat = DB.patches[table] || {};
    let out = data
      .filter((r) => !del.some((d) => same(d, r.id)))
      .map((r) => (pat[String(r.id)] || pat[r.id]) ? Object.assign({}, r, pat[String(r.id)] || pat[r.id]) : r);
    const sel = p.u.searchParams.get('select');
    const locals = (DB.rows[table] || []).filter((r) => rowMatches(r, F)).map((r) => project(r, sel));
    if (locals.length) out = locals.concat(out);
    return J(out, res.status);
  }

  /* ══════════ اعتراض fetch ══════════ */
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();

    /* 🔒 (1) التلمتري يمرّ حقيقياً — أخطاء التدريب يجب أن تصلك (موسومة training) */
    if (/gmt_telemetry/.test(url)) return REAL(input, init);

    /* 📨 (2) تيليغرام: يمرّ فعلاً بعد وسمه «تدريبية» */
    if (isTelegram(url)) {
      rec('sent', '📨 أُرسل إشعار تيليغرام **موسوماً بـ«تدريبية»**', 'وصل الإدارة بختم واضح — لا يمثّل عملية حقيقية.');
      return REAL(input, tagTelegram(init, input));
    }

    /* 🔒 (3) باقي الآثار الخارجية تُحتجَز */
    const b = blockedBy(url);
    if (b) {
      rec('blocked', '🔒 حُجز ' + b.name + ' (لم يُرسل لأحد)', method + ' ' + String(url).split('?')[0].slice(0, 90));
      return J({ ok: true, training: true, blocked: b.name }, 200);
    }

    const p = parseUrl(url);
    if (p.kind === 'other') return REAL(input, init);
    if (p.kind === 'storage') {
      if (method === 'GET' || method === 'HEAD') return REAL(input, init);
      rec('blocked', '🔒 رفع ملف/صورة (محاكاة — لم يُرفع شيء)', '');
      return J({ Key: 'training/' + Date.now(), Id: 'training' });
    }
    if (p.kind === 'rpc') return method === 'GET' ? REAL(input, init) : simulateRpc(p, input, init);
    if (p.kind === 'table') {
      if (method === 'GET') { const res = await REAL(input, init); return mergeGet(p, res); }
      if (method === 'HEAD') return REAL(input, init);
      return simulate(p, method, input, init);
    }
    return REAL(input, init);
  };

  /* 🔒 (3) حجب المسارات القديمة: XHR + sendBeacon (بعض الصفحات تستعملها) */
  try {
    const XHR = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      const bb = isTelegram(u) ? null : blockedBy(u);
      if (bb) { rec('blocked', '🔒 حُجز ' + bb.name + ' (XHR)', String(u).slice(0, 80)); arguments[1] = 'data:application/json,{}'; }
      return XHR.apply(this, arguments);
    };
    const BEACON = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    if (BEACON) navigator.sendBeacon = function (u, d) {
      if (/gmt_telemetry/.test(String(u))) return BEACON(u, d);
      const bb = blockedBy(u);
      if (bb) { rec('blocked', '🔒 حُجز ' + bb.name + ' (Beacon)', ''); return true; }
      return BEACON(u, d);
    };
  } catch (_) {}

  /* ══════════ 🖨️ ختم مائي بالطباعة ══════════ */
  (function watermark() {
    const css = document.createElement('style');
    css.textContent = `
      @media print {
        body::before{
          content:"نسخة تدريبية — غير صالحة للتعامل";
          position:fixed; top:42%; left:0; right:0; text-align:center;
          font-size:44px; font-weight:900; color:rgba(192,0,18,.16);
          transform:rotate(-24deg); z-index:2147483647; pointer-events:none;
          font-family:Cairo,Arial,sans-serif; letter-spacing:2px;
        }
      }
      body{ outline:3px solid #d97706; outline-offset:-3px; }
    `;
    (document.head || document.documentElement).appendChild(css);
  })();

  /* ══════════ الشريط + تقرير الجلسة ══════════ */
  let bar = null;
  function paintBanner() {
    if (!bar) return;
    const c = bar.querySelector('#gts-counts');
    if (c) c.textContent = `عمليات: ${stat.writes} · إشعارات موسومة: ${stat.sent} · محتجزة: ${stat.blocked} · أخطاء: ${stat.errors}`;
  }
  function banner() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', banner, { once: true }); return; }
    if (document.getElementById('gmt-training-banner')) return;
    bar = document.createElement('div');
    bar.id = 'gmt-training-banner';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147482999;background:linear-gradient(90deg,#b45309,#d97706);color:#fff;font-family:Cairo,Arial,sans-serif;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:6px 10px;direction:rtl;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    bar.innerHTML =
      '<span>🎓 وضع تدريبي — لا شيء يُحفظ ولا يُرسل لأحد</span>' +
      '<span id="gts-counts" style="background:rgba(0,0,0,.22);border-radius:99px;padding:2px 10px;font-size:11px;"></span>' +
      '<button id="gts-report" style="background:#fff;color:#b45309;border:none;border-radius:99px;padding:4px 12px;font-weight:900;font-family:inherit;font-size:11px;cursor:pointer;">📋 تقرير الجلسة</button>' +
      '<button id="gts-reset" style="background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:99px;padding:4px 12px;font-weight:900;font-family:inherit;font-size:11px;cursor:pointer;">♻️ ابدأ من جديد</button>' +
      '<button id="gts-exit" style="background:#111;color:#fff;border:none;border-radius:99px;padding:4px 14px;font-weight:900;font-family:inherit;font-size:11px;cursor:pointer;">✖ خروج ومسح</button>';
    document.body.appendChild(bar);
    document.body.style.marginTop = (parseInt(getComputedStyle(document.body).marginTop) || 0) + 34 + 'px';
    bar.querySelector('#gts-exit').onclick = () => { if (confirm('إنهاء التدريب ومسح كل ما أنشأته؟ (لن يتأثر شيء بقاعدتك)')) exit(); };
    bar.querySelector('#gts-reset').onclick = () => {
      if (!confirm('مسح جلسة التدريب والبدء من جديد؟')) return;
      DB = { rows: {}, patches: {}, deleted: {}, seq: 0 }; LOG = []; stat.writes = stat.blocked = stat.errors = 0;
      save(); try { sessionStorage.removeItem(SS_LOG); } catch (_) {}
      location.reload();
    };
    bar.querySelector('#gts-report').onclick = openReport;
    paintBanner();
  }
  banner();

  function buildReport() {
    const t0 = Number((function () { try { return sessionStorage.getItem(SS_T0); } catch (_) { return 0; } })() || Date.now());
    const mins = Math.max(1, Math.round((Date.now() - t0) / 60000));
    const u = (window.GMTBug && GMTBug.list) ? '' : '';
    const head = [
      '═══ تقرير جلسة تدريبية — GMT 🎓 ═══',
      'الصفحة: ' + document.title,
      'المدة: ' + mins + ' دقيقة',
      `العمليات المُحاكاة: ${stat.writes} · إشعارات تيليغرام موسومة: ${stat.sent} · إشعارات محتجزة: ${stat.blocked} · الأخطاء: ${stat.errors}`,
      '⚠️ لم تُكتب أي بيانات بالقاعدة ولم يُخصم أي مخزون. رسائل تيليغرام أُرسلت بختم «تدريبية».',
      '──────────────────────',
    ].join('\n');
    const ICON = { blocked: '🔒', error: '🔴', sent: '📨', write: '✍️' };
    const body = LOG.map((e, i) => `#${i + 1} [${e.t}] ${ICON[e.k] || '•'} ${e.title}${e.detail ? '\n   ↳ ' + e.detail : ''}`).join('\n');
    const inspect = (window.GMTInspect && typeof GMTInspect.report === 'function') ? '\n\n═══ رحلة المتدرّب (المفتّش) ═══\n' + GMTInspect.report() : '';
    return head + '\n' + (body || 'لم تُنفَّذ أي عملية بعد.') + inspect + u;
  }

  function openReport() {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,Arial,sans-serif;direction:rtl;';
    ov.innerHTML =
      '<div style="background:#161a22;color:#e7e9ee;border:1px solid #2a3040;border-radius:16px;max-width:620px;width:100%;max-height:86vh;display:flex;flex-direction:column;padding:16px;">' +
      `<div style="font-weight:900;font-size:15px;margin-bottom:3px;">🎓 تقرير الجلسة التدريبية</div>` +
      `<div style="font-size:11px;color:#9aa3b2;font-weight:700;margin-bottom:9px;line-height:1.7;">محاكاة: <b>${stat.writes}</b> عملية · <b>${stat.sent}</b> إشعار موسوم · <b>${stat.blocked}</b> محتجَز · <b>${stat.errors}</b> خطأ. لا شيء وصل للقاعدة ولا نقص من المخزون · رسائل تيليغرام وصلت بختم «تدريبية».</div>` +
      '<textarea readonly id="gts-ta" style="flex:1;min-height:260px;background:#0e1117;color:#cdd3de;border:1px solid #2a3040;border-radius:10px;padding:10px;font-size:11px;line-height:1.7;direction:rtl;text-align:right;white-space:pre-wrap;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<button id="gts-copy" style="flex:1;background:#C00012;color:#fff;border:none;border-radius:10px;padding:11px;font-weight:900;font-family:inherit;cursor:pointer;">📋 نسخ التقرير</button>' +
      '<button id="gts-close" style="background:#232936;color:#c6ccd8;border:none;border-radius:10px;padding:11px 14px;font-weight:800;font-family:inherit;cursor:pointer;">إغلاق</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    const ta = ov.querySelector('#gts-ta');
    ta.value = buildReport();
    ov.querySelector('#gts-close').onclick = () => ov.remove();
    ov.querySelector('#gts-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); try { document.execCommand('copy'); } catch (_) {} }
      ov.querySelector('#gts-copy').textContent = '✓ نُسخ';
    };
  }

  /* ══════════ التقاط أخطاء المتدرّب وعرضها له (تعليمياً) ══════════ */
  window.addEventListener('error', (e) => { if (e && e.message) rec('error', 'خطأ برمجي: ' + e.message, ''); });
  window.addEventListener('unhandledrejection', (e) => { const r = e && e.reason; rec('error', 'خطأ: ' + ((r && (r.message || r)) || ''), ''); });
  /* بالوضع التدريبي المتدرّب يرى الحارس (عكس الإنتاج الصامت) — الهدف تعليمه لا مراقبته */
  setTimeout(() => { try { if (window.GMTBug && GMTBug.setSilent) GMTBug.setSilent(false); } catch (_) {} }, 1200);

  /* ══════════ الواجهة البرمجية ══════════ */
  window.GMTSandbox = {
    active: true,
    version: 2,
    db: DB,
    log: () => LOG.slice(),
    stats: () => Object.assign({}, stat),
    record: rec,
    report: buildReport,
    openReport,
    enter, exit,
    wipe() { DB = { rows: {}, patches: {}, deleted: {}, seq: 0 }; LOG = []; save(); try { sessionStorage.removeItem(SS_LOG); } catch (_) {} },
  };
  console.info('%c🎓 الوضع التدريبي v2 — كل كتابة محاكاة · تيليغرام موسوم بـتدريبية', 'background:#b45309;color:#fff;padding:2px 8px;border-radius:4px;');
})();
