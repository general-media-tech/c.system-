/* ═══════════════════════════════════════════════════════════════════════════
   gmt-warden.js — 🛡️ المراقب السيادي (نظام الحماية المركزي) · v1.0 · 2026-07-17
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك: البوتات تصير «نظاماً كاملاً» يفهم كل النظام وكل الميزات وطلبات
   المالك، وله «صلاحيات كبيرة واستقلالية كاملة»، يراقب ويكتب تقريراً فورياً عند
   أي خطأ (برمجي/تقني/عملي/حسابي) بكل تفاصيله: ماذا · متى · كيف · لماذا · القيمة.

   هذا العقل المركزي:
     • يقرأ gmt-features.js (ماذا يفترض أن يحدث) + gmt-owner-requests.js (قواعد المالك).
     • ينسّق البوتات (الحارس · المفتّش · الفاحص) تحت مظلة واحدة.
     • يكتب «تقرير حماية» موحّداً بكل حادثة، يُخزَّن محلياً + يُرسَل للقاعدة.
     • ⭐ الأخطاء الحسابية (خصم/إضافة مالية غير مبرّرة) تبقى مسجّلة حتى بعد الإصلاح
       (طلب المالك: «الشيء المنخصم ما يضيع»).
     • ⭐ يشغّل «اختبارات وهمية» بعد النشر لاكتشاف الأخطاء ذاتياً (probe mode).

   يظهر للأدمن/السيادي فقط عبر زر 🛡️ أو صفحة «بوتات الحماية» المستقلة.
   ملف منطق، لكنه **لا يعدّل أي بيانات إنتاجية** — يراقب ويسجّل فقط.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTWarden) return;

  var VERSION = 1.0;
  var LSK = 'gmt_warden_incidents';
  var LEDGER = 'gmt_warden_money_ledger';   // دفتر الفروقات المالية — لا يُمسح بالإصلاح
  var RF = (window.__gmtRealFetch || window.fetch).bind(window);

  var FEATURES = window.GMT_FEATURES || [];
  var RULES = window.GMT_OWNER_RULES || [];

  /* ═══════════ التخزين الدائم ═══════════ */
  function load(k, def) { try { return JSON.parse(localStorage.getItem(k) || 'null') || def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var incidents = load(LSK, []);
  var moneyLedger = load(LEDGER, []);

  function role() {
    return (window.GMTBug && GMTBug.role && GMTBug.role()) || window.__gmtRole || 'cashier';
  }
  function who() {
    return (window.GMTBug && GMTBug.who && GMTBug.who()) || 'غير معروف';
  }
  function branch() {
    try { return localStorage.getItem('gmt_branch') || '—'; } catch (e) { return '—'; }
  }

  /* ═══════════ كتابة تقرير حادثة (القلب) ═══════════
     كل تقرير يحوي: ماذا · متى · أين · من · كيف · لماذا · الخطورة · الصنف · القيمة المالية */
  function report(o) {
    var inc = {
      id: 'W' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      ts: Date.now(),
      when_human: new Date().toLocaleString('ar-SY'),
      kind: o.kind || 'unknown',              // programmatic | technical | operational | financial | rule_violation
      title: o.title || '',
      what: o.what || '',                      // ماذا حدث
      how: o.how || '',                        // كيف حدث
      why: o.why || '',                        // السبب المرجّح
      rule: o.rule || null,                    // أي قاعdة مالك خُولفت
      feature: o.feature || null,              // أي ميزة تأثّرت
      severity: o.severity || 'medium',
      page: document.title,
      url: location.href,
      user: who(),
      role: role(),
      branch: branch(),
      money_delta: (typeof o.money_delta === 'number') ? o.money_delta : null,  // القيمة المخصومة/المضافة
      evidence: o.evidence || null,            // دليل تقني (payload/response)
      resolved: false                          // يبقى false حتى يُصلَح — لكن الحادثة تبقى مسجّلة
    };
    incidents.push(inc);
    if (incidents.length > 500) incidents = incidents.slice(-500);
    save(LSK, incidents);

    // ⭐ الأخطاء الحسابية تُسجَّل بدفتر منفصل لا يُمسح أبداً (طلب المالك)
    if (inc.kind === 'financial' && inc.money_delta != null) {
      moneyLedger.push({
        id: inc.id, ts: inc.ts, when_human: inc.when_human,
        title: inc.title, money_delta: inc.money_delta,
        user: inc.user, branch: inc.branch, why: inc.why,
        recovered: false   // هل استُرجع المبلغ؟ يُحدَّث يدوياً، لكن السجل باقٍ
      });
      save(LEDGER, moneyLedger);
    }

    // أرسل للقاعدة عبر الحارس إن وُجد
    if (window.GMTBug && GMTBug.log) {
      GMTBug.log(inc.severity === 'critical' ? 'critical' : 'warn',
        '🛡️ ' + inc.title, { warden: true, kind: inc.kind, rule: inc.rule, money: inc.money_delta });
    }
    // أرسل نسخة كاملة لجدول المراقب
    sendIncident(inc);
    updateBadge();
    return inc;
  }

  async function sendIncident(inc) {
    try {
      var url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL;
      var key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY;
      if (!url || !key) return;
      await RF(url + '/rest/v1/warden_incidents', {
        method: 'POST', keepalive: true,
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          incident_id: inc.id, kind: inc.kind, title: inc.title, what: inc.what,
          how: inc.how, why: inc.why, rule_id: inc.rule, feature_id: inc.feature,
          severity: inc.severity, page: inc.page, user_name: inc.user, role: inc.role,
          branch: inc.branch, money_delta: inc.money_delta, evidence: inc.evidence,
          created_at: new Date(inc.ts).toISOString()
        })
      });
    } catch (e) { /* لا نُفشل الصفحة */ }
  }

  /* ═══════════ المراقبة الحيّة — ربط توقيعات المخالفات ═══════════ */

  // ① مراقبة الكتابات المالية (عمولات/أسعار) — كشف الخصم/الإضافة غير المبرّرة
  var RFetch = window.fetch;
  window.fetch = async function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var method = ((init && init.method) || 'GET').toUpperCase();
    var res = await RFetch.apply(this, arguments);

    try {
      if (/PATCH|POST/.test(method) && /\/rest\/v1\/(invoice_commissions|products|gmt_settlements)/.test(url)) {
        var body = '';
        try { body = typeof (init && init.body) === 'string' ? init.body : JSON.stringify((init && init.body) || {}); } catch (e) {}
        var payload = {};
        try { payload = JSON.parse(body); } catch (e) {}

        // خصم عمولة/سعر: سجّل بدفتر المال لو فيه قيمة
        if (/invoice_commissions/.test(url) && payload && ('amount' in payload)) {
          if (Number(payload.amount) === 0) {
            report({
              kind: 'financial', severity: 'high', feature: 'ADM-4', rule: 'OWN-MONEY-TRACE',
              title: 'تصفير عمولة', money_delta: -0,
              what: 'عمولة صُفّرت.', how: 'PATCH amount=0 على invoice_commissions.',
              why: payload.zeroed_reason || 'بلا سبب مسجَّل — راجع OWN-ACCOUNTABILITY.',
              evidence: body.slice(0, 200)
            });
          }
        }
        // بيع تحت التكلفة: يُكشف عبر مقارنة السعر بالتكلفة (يتطلب بيانات المنتج — يُسجَّل من نقطة البيع)
      }
    } catch (e) {}
    return res;
  };

  // ② فحص القواعد عند التحميل — أي ميزة بحالة conflict/partial تُبلَّغ للأدمن
  function auditFeaturesOnLoad() {
    if (!/admin|sovereign|owner/i.test(role())) return;
    var broken = FEATURES.filter(function (f) {
      return f.status === 'conflict' || (f.status === 'partial' && f.severity === 'critical');
    });
    broken.forEach(function (f) {
      // لا نُكرّر التبليغ أكثر من مرة يومياً
      var key = 'gmt_warden_seen_' + f.id + '_' + new Date().toDateString();
      if (localStorage.getItem(key)) return;
      try { localStorage.setItem(key, '1'); } catch (e) {}
      report({
        kind: 'rule_violation', severity: f.severity, feature: f.id,
        rule: f.note ? f.note : null,
        title: 'ميزة لا تعمل كما هو مطلوب: ' + f.title,
        what: f.what,
        how: 'الحالة: ' + f.status + '. ' + (f.built || ''),
        why: f.note || 'انظر سجل التدقيق.'
      });
    });
  }

  /* ═══════════ ⭐ الاختبارات الوهمية بعد النشر (Probe Mode) ═══════════
     طلب المالك: بوت يشغّل عمليات وهمية بعد النشر ليكشف الأخطاء ذاتياً.
     التنفيذ الآمن: يعمل فقط على «صف اختبار» يُنشأ ويُحذَف، ولا يمسّ بيانات حقيقية.
     يُشغَّل يدوياً من صفحة الحماية (لا تلقائياً — احتراماً لسلامة البيانات). */
  var probes = [
    {
      id: 'probe-db-write',
      title: 'اختبار الكتابة والقراءة',
      run: async function () {
        var url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL;
        var key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY;
        if (!url || !key) return { ok: false, msg: 'لا مفاتيح' };
        var probe = { session_id: 'PROBE-' + Date.now(), message: 'اختبار وهمي', severity: 'warn', err_type: 'probe', training: true };
        var r = await RF(url + '/rest/v1/error_log', {
          method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(probe)
        });
        if (!r.ok) return { ok: false, msg: 'الكتابة فشلت HTTP ' + r.status };
        var rows = await r.json();
        var id = rows && rows[0] && rows[0].id;
        if (!id) return { ok: false, msg: 'كُتب لكن لم يُقرأ (صمت RLS محتمل)' };
        await RF(url + '/rest/v1/error_log?id=eq.' + id, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + key } });
        return { ok: true, msg: 'الكتابة والقراءة والحذف تعمل' };
      }
    },
    {
      id: 'probe-counter',
      title: 'اختبار عدّاد الأوردرات (كشف SQL-1)',
      run: async function () {
        var url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL;
        var key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY;
        if (!url || !key) return { ok: false, msg: 'لا مفاتيح' };
        try {
          var r = await RF(url + '/rest/v1/rpc/increment_settings_counter', {
            method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_key: '__warden_probe__' })
          });
          if (!r.ok) return { ok: false, msg: 'دالة العدّاد تفشل HTTP ' + r.status + ' — راجع SQL-1' };
          return { ok: true, msg: 'دالة العدّاد تستجيب' };
        } catch (e) { return { ok: false, msg: String(e).slice(0, 80) }; }
      }
    }
  ];

  async function runProbes() {
    report({ kind: 'operational', severity: 'low', title: 'بدء الاختبارات الوهمية', what: 'المراقب يشغّل ' + probes.length + ' اختباراً ذاتياً.' });
    var results = [];
    for (var i = 0; i < probes.length; i++) {
      var p = probes[i];
      try {
        var r = await p.run();
        results.push({ id: p.id, title: p.title, ok: r.ok, msg: r.msg });
        if (!r.ok) {
          report({
            kind: 'technical', severity: 'high', title: 'فشل اختبار وهمي: ' + p.title,
            what: r.msg, how: 'probe ' + p.id, why: 'كُشف ذاتياً بعد النشر.'
          });
        }
      } catch (e) {
        results.push({ id: p.id, title: p.title, ok: false, msg: String(e).slice(0, 80) });
      }
    }
    return results;
  }

  /* ═══════════ التقرير الموحّد (للنسخ دفعة واحدة) ═══════════ */
  function fullReport() {
    var L = [];
    L.push('═══════ تقرير المراقب السيادي (نظام الحماية) ═══════');
    L.push('التاريخ: ' + new Date().toLocaleString('ar-SY'));
    L.push('المستخدم: ' + who() + ' · الدور: ' + role() + ' · الفرع: ' + branch());
    L.push('عدد الحوادث المسجّلة: ' + incidents.length);
    L.push('');

    var crit = incidents.filter(function (i) { return i.severity === 'critical'; });
    var fin = incidents.filter(function (i) { return i.kind === 'financial'; });

    L.push('── ملخّص حسب الصنف ──');
    ['programmatic', 'technical', 'operational', 'financial', 'rule_violation'].forEach(function (k) {
      var n = incidents.filter(function (i) { return i.kind === k; }).length;
      var ar = { programmatic: 'برمجي', technical: 'تقني', operational: 'عملي', financial: 'حسابي', rule_violation: 'مخالفة قاعدة' }[k];
      if (n) L.push('  ' + ar + ': ' + n);
    });
    L.push('');

    if (moneyLedger.length) {
      L.push('── ⭐ دفتر الفروقات المالية (لا يُمسح بالإصلاح) ──');
      var totalRecovered = 0, totalPending = 0;
      moneyLedger.forEach(function (m) {
        L.push('  ' + m.when_human + ' · ' + m.title + ' · ' + (m.money_delta || 0) +
               ' · ' + m.user + ' · ' + (m.recovered ? '✅ مسترجَع' : '⏳ معلّق') + (m.why ? ' · ' + m.why : ''));
        if (m.recovered) totalRecovered += Math.abs(m.money_delta || 0); else totalPending += Math.abs(m.money_delta || 0);
      });
      L.push('  المجموع المعلّق: ' + totalPending + ' · المسترجَع: ' + totalRecovered);
      L.push('');
    }

    if (crit.length) {
      L.push('── 🔴 الحوادث الحرجة ──');
      crit.slice(-30).forEach(function (i) {
        L.push('  [' + i.when_human + '] ' + i.title);
        L.push('     ماذا: ' + i.what);
        if (i.how) L.push('     كيف: ' + i.how);
        if (i.why) L.push('     لماذا: ' + i.why);
        if (i.rule) L.push('     قاعدة مُخالَفة: ' + i.rule);
        if (i.money_delta != null) L.push('     القيمة المالية: ' + i.money_delta);
        L.push('     من: ' + i.user + ' · الفرع: ' + i.branch);
        L.push('');
      });
    }

    L.push('── كل الحوادث (آخر 60) ──');
    incidents.slice(-60).forEach(function (i) {
      L.push('  [' + i.when_human + '] (' + i.severity + '/' + i.kind + ') ' + i.title +
             (i.money_delta != null ? ' · ' + i.money_delta : '') + ' · ' + i.user);
    });

    return L.join('\n');
  }

  /* ═══════════ الواجهة ═══════════ */
  function updateBadge() {
    var b = document.getElementById('gmt-warden-fab');
    if (!/admin|sovereign|owner/i.test(role())) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('button');
      b.id = 'gmt-warden-fab';
      b.title = 'المراقب السيادي — نظام الحماية';
      b.textContent = '🛡️';
      b.style.cssText = 'position:fixed;left:14px;bottom:200px;z-index:2147481000;width:46px;height:46px;border-radius:50%;' +
        'border:0;background:#7c2d12;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35);';
      b.onclick = openPanel;
      document.body.appendChild(b);
    }
    var crit = incidents.filter(function (i) { return i.severity === 'critical' && !i.resolved; }).length;
    b.style.background = crit ? '#dc2626' : '#7c2d12';
    b.textContent = crit ? '🛡️' : '🛡️';
  }

  function openPanel() {
    var old = document.getElementById('gmt-warden-panel');
    if (old) { old.remove(); return; }
    var d = document.createElement('div');
    d.id = 'gmt-warden-panel';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147481700;background:rgba(4,6,10,.95);backdrop-filter:blur(8px);' +
      'padding:16px;overflow:auto;direction:rtl;font-family:Cairo,system-ui,sans-serif;';
    d.innerHTML =
      '<div style="max-width:900px;margin:0 auto;background:#0f131c;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;color:#fff">' +
        '<div style="padding:15px 17px;background:#7c2d12;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<div><div style="font-weight:900;font-size:16px">🛡️ المراقب السيادي — نظام الحماية</div>' +
          '<div style="font-size:12px;opacity:.9;margin-top:2px">' + incidents.length + ' حادثة · ' + moneyLedger.length + ' قيد بدفتر المال</div></div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<button id="wd-probe" style="background:#16a34a;color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">🧪 اختبارات وهمية</button>' +
            '<button id="wd-copy" style="background:rgba(255,255,255,.2);color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">📋 نسخ التقرير</button>' +
            '<button id="wd-clr" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">🗑 مسح الحوادث</button>' +
            '<button id="wd-x" style="background:rgba(0,0,0,.3);color:#fff;border:0;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">✕</button>' +
          '</div>' +
        '</div>' +
        '<div id="wd-body" style="padding:16px"><pre style="margin:0;font-size:12px;line-height:1.8;white-space:pre-wrap;color:#c9d1dc;font-family:ui-monospace,monospace">' +
          fullReport().replace(/</g, '&lt;') + '</pre></div>' +
      '</div>';
    document.body.appendChild(d);
    d.querySelector('#wd-x').onclick = function () { d.remove(); };
    d.querySelector('#wd-clr').onclick = function () {
      if (confirm('مسح سجل الحوادث؟ (دفتر المال يبقى — لا يُمسح)')) { incidents = []; save(LSK, incidents); d.remove(); updateBadge(); }
    };
    d.querySelector('#wd-copy').onclick = function () {
      try { navigator.clipboard.writeText(fullReport()); alert('✅ نُسخ تقرير المراقب — الصقه بملف بوتات الحماية.'); }
      catch (e) { alert('انسخه يدوياً.'); }
    };
    d.querySelector('#wd-probe').onclick = async function () {
      this.textContent = '⏳ جارٍ...'; this.disabled = true;
      var results = await runProbes();
      var body = d.querySelector('#wd-body');
      body.innerHTML = '<div style="margin-bottom:12px">' + results.map(function (r) {
        return '<div style="background:' + (r.ok ? '#132018' : '#2a1215') + ';border:1px solid ' + (r.ok ? '#16a34a55' : '#dc262655') +
          ';border-radius:10px;padding:10px 12px;margin-bottom:6px"><b>' + (r.ok ? '✅' : '🔴') + ' ' + r.title + '</b><br>' +
          '<span style="font-size:12px;color:#aab3c4">' + r.msg + '</span></div>';
      }).join('') + '</div><pre style="margin:0;font-size:12px;line-height:1.8;white-space:pre-wrap;color:#c9d1dc;font-family:ui-monospace,monospace">' +
        fullReport().replace(/</g, '&lt;') + '</pre>';
    };
  }

  /* ═══════════ الواجهة العامة ═══════════ */
  window.GMTWarden = {
    version: VERSION,
    report: report,
    fullReport: fullReport,
    incidents: function () { return incidents; },
    moneyLedger: function () { return moneyLedger; },
    runProbes: runProbes,
    open: openPanel,
    // للبوتات الأخرى: أبلِغ عن حادثة
    flag: function (o) { return report(o); },
    feature: function (id) { return FEATURES.filter(function (f) { return f.id === id; })[0] || null; },
    rule: function (id) { return RULES.filter(function (r) { return r.id === id; })[0] || null; }
  };

  /* إقلاع */
  function boot() {
    updateBadge();
    setTimeout(function () { auditFeaturesOnLoad(); updateBadge(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
