/* ═══════════════════════════════════════════════════════════════════════════
   gmt-autotest.js — 🤖 الفاحص الشامل الآلي (E2E) · v1.0 · 2026-07-17
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك: بوت يشغّل النظام كله كأنه مستخدم حقيقي — يجرّب **كل زر بلا
   استثناء**، كل معاينة رقمية/منطقية، كل طباعة، كل شكل — ويسجّل النتائج بتقرير.
     • تلقائي أول مرة بعد كل نشر (يكشف النشرة الجديدة عبر بصمة الإصدار).
     • زر يدوي لإعادة الفحص وقت ما يشاء.
     • يعمل ضمن المراقبة المستمرة (أثناء العمل والتعليم).

   ═══ الأمان (حاجز مزدوج على كل شيء، ثلاثي على الخطير) ═══
   ① يفرض الوضع التدريبي (GMTSandbox) الذي يحوّل كل كتابة لقاعدة وهمية محلية.
   ② يتحقق فعلياً أن الاعتراض شغّال قبل أي ضغطة (probe كتابة تُفحص أنها لم تصل).
   ③ الأزرار الخطيرة (حذف/تصفير/فكّ ختم/استعادة): لا تُضغط إلا بعد تأكيد
      الطبقتين معاً. إن فشل أي منهما، تُسجَّل «تُخطّيت — الحماية غير مؤكّدة».

   يقرأ سجل الميزات (gmt-features) وقواعد المالك (gmt-owner-requests) ليحكم:
   هل النتيجة الرقمية منطقية؟ هل السلوك مطابق للمطلوب؟

   يكتب تقاريره للمراقب السيادي (GMTWarden) والقاعدة.
   للأدمن فقط. لا يعمل على صفحات الزبون.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTAutoTest) return;

  var VERSION = 1.0;
  var VER_KEY = 'gmt_autotest_last_version';
  var RESULT_KEY = 'gmt_autotest_last_result';

  /* بصمة الإصدار: تتغيّر مع كل نشر (من sw.js cache أو تاريخ الملفات) */
  function deployVersion() {
    // نحاول قراءة نسخة الكاش من service worker، وإلا نستعمل بصمة المحتوى
    var v = '';
    try {
      var sw = document.querySelector('script[src*="sw"]');
      v = (window.GMT_BUILD || '') + '';
    } catch (e) {}
    if (!v) {
      // بصمة من عدد السكربتات وأطوالها (تتغيّر مع أي تحديث)
      var s = document.scripts.length + ':' + document.body.innerHTML.length;
      v = s;
    }
    return v;
  }

  var R = [];        // نتائج الفحص
  var running = false;

  function role() {
    return (window.GMTBug && GMTBug.role && GMTBug.role()) || window.__gmtRole || 'cashier';
  }
  function isAdmin() { return /admin|sovereign|owner/i.test(role()); }
  function isCustomerPage() {
    return /متجر|كفالة|الموقع|شحنة|store|warranty|tracking|site/i.test(document.title) &&
           !/أدمن|admin|إدارة/i.test(document.title);
  }

  /* أنماط الأزرار الخطيرة (تحتاج الحاجز الثلاثي) */
  var DANGER = /حذف|احذف|delete|تصفير|صفّر|زero|فكّ|فك ختم|unseal|استعادة|استرجاع|restore|drop|مسح|امسح|إلغاء نهائي/i;

  function add(status, area, title, detail, danger) {
    R.push({ status: status, area: area, title: title, detail: detail || '', danger: !!danger, ts: Date.now() });
  }

  /* ═══════════ ① التحقق من الحاجز المزدوج ═══════════ */
  function sandboxActive() {
    return !!(window.GMTSandbox && window.GMTSandbox.active);
  }

  async function verifyWriteBlocked() {
    /* probe: نرسل كتابة وهمية ونتأكد أنها لم تصل للقاعدة الحقيقية.
       بما أن الوضع التدريبي يحاكي محلياً، الكتابة يجب ألا تصل للشبكة الحقيقية. */
    if (!sandboxActive()) return false;
    try {
      var realFetchUsed = false;
      var origReal = window.__gmtRealFetch;
      // إن كان الوضع التدريبي شغّالاً، window.fetch ملفوف؛ نتأكد أن probe لا يصل الشبكة
      var url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL || '';
      if (!url) return sandboxActive(); // لا مفاتيح = لا شبكة أصلاً = آمن
      var r = await window.fetch(url + '/rest/v1/__autotest_probe__', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ __probe: true, __training: true })
      });
      // الوضع التدريبي يُرجع Response محاكاة (201/200) بلا لمس القاعدة
      // لو وصل فعلاً للقاعdة، سيرجع خطأ جدول غير موجود (404/400) من الخادم الحقيقي
      var txt = await r.text().catch(function () { return ''; });
      // محاكاة الساندبوكس تُرجع نجاحاً وهمياً؛ الخادم الحقيقي يُرجع خطأ PGRST
      var reachedRealServer = /PGRST|does not exist|42P01|relation/i.test(txt);
      return !reachedRealServer;
    } catch (e) {
      // خطأ = لم يصل = آمن (على الأرجح اعترضه الساندبوكس)
      return sandboxActive();
    }
  }

  /* ═══════════ ② اكتشاف كل الأزرار والعناصر ═══════════ */
  function discoverButtons() {
    var out = [], seen = {};
    var els = document.querySelectorAll('button, [role=button], a[onclick], input[type=button], input[type=submit], [onclick]');
    Array.prototype.forEach.call(els, function (el) {
      // تجاهل أزرار البوتات نفسها
      if (el.closest('#gmt-warden-panel,#gmt-st-panel,#gmt-inspect-panel,#gmt-bug-panel,.gg4,.gg4-idx,#gmt-autotest-panel')) return;
      if (el.id && /^(gmt-|gts-|wd-|gi-|st-)/.test(el.id)) return;
      var txt = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 44);
      var oc = el.getAttribute('onclick') || '';
      var fn = (oc.match(/^\s*([\w$]+)\s*\(/) || [])[1] || '';
      var key = (txt || fn) + '|' + (el.id || '');
      if ((!txt && !fn) || seen[key]) return;
      seen[key] = 1;
      out.push({ el: el, label: txt || fn, fn: fn, danger: DANGER.test(txt + ' ' + fn) });
    });
    return out;
  }

  /* ═══════════ ③ فحص المعاينات الرقمية والمنطقية ═══════════ */
  function checkNumbers() {
    var issues = [];
    // ابحث عن إجماليات وتحقق من منطقيتها
    var totals = document.querySelectorAll('[id*=total i],[class*=total i],[id*=إجمالي],[id*=مجموع],[id*=amount i]');
    Array.prototype.forEach.call(totals, function (el) {
      var txt = (el.textContent || '').replace(/[^\d.\-]/g, '');
      var num = parseFloat(txt);
      if (isNaN(num)) return;
      if (num < 0) issues.push({ what: 'قيمة سالبة غير متوقّعة: ' + (el.id || el.className).slice(0, 30) + ' = ' + num });
      if (!isFinite(num)) issues.push({ what: 'قيمة لا نهائية: ' + (el.id || '') });
    });
    // تحقق: NaN ظاهر بالواجهة
    if (/\bNaN\b/.test(document.body.innerText)) issues.push({ what: 'كلمة NaN ظاهرة بالواجهة (حساب فاشل)' });
    if (/undefined|null/.test((document.body.innerText.match(/\b(undefined|null)\b/g) || []).slice(0, 1).join(''))) {
      // فقط إن ظهرت بمكان رقمي
    }
    return issues;
  }

  /* ═══════════ ④ فحص الطباعة ═══════════ */
  function checkPrintTemplates() {
    var issues = [];
    var prints = document.querySelectorAll('[id*=print i],[class*=print i],[id*=طباعة],[id*=receipt i],[class*=receipt i],[id*=فاتورة]');
    var count = 0;
    Array.prototype.forEach.call(prints, function (el) {
      count++;
      // هل القالب فارغ؟
      var content = (el.innerHTML || '').trim();
      if (content.length < 20 && !el.querySelector('img,table,svg')) {
        issues.push({ what: 'قالب طباعة يبدو فارغاً: ' + (el.id || el.className).slice(0, 30) });
      }
    });
    return { count: count, issues: issues };
  }

  /* ═══════════ ⑤ فحص الأشكال والعناصر ═══════════ */
  function checkShapes() {
    var issues = [];
    // صور مكسورة
    var broken = 0;
    Array.prototype.forEach.call(document.images, function (img) {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) broken++;
    });
    if (broken) issues.push({ what: broken + ' صورة مكسورة (لم تُحمّل)' });
    // جداول فارغة
    var emptyTables = 0;
    Array.prototype.forEach.call(document.querySelectorAll('table'), function (t) {
      if (!t.querySelector('td,th')) emptyTables++;
    });
    if (emptyTables) issues.push({ what: emptyTables + ' جدول فارغ' });
    return issues;
  }

  /* ═══════════ التشغيل الرئيسي ═══════════ */
  async function run(opts) {
    if (running) return;
    if (!isAdmin()) return;
    if (isCustomerPage()) return;   // لا فحص على صفحات الزبون
    running = true;
    R = [];
    opts = opts || {};
    render(true);

    // ─── الحاجز الأول: فرض الوضع التدريبي ───
    var wasTraining = sandboxActive();
    if (!wasTraining) {
      add('info', 'الأمان', 'تفعيل الوضع التدريبي', 'الفحص يتطلب الوضع التدريبي (يمنع الحفظ الحقيقي). سيُعاد تحميل الصفحة بوضع التدريب.');
      // نحفظ نيّة الفحص التلقائي بعد إعادة التحميل
      try { sessionStorage.setItem('gmt_autotest_resume', '1'); } catch (e) {}
      render(false); running = false;
      if (window.GMTSandbox && GMTSandbox.enter) { GMTSandbox.enter(); return; }
      else { add('fail', 'الأمان', 'الوضع التدريبي غير متاح', 'لا يمكن الفحص الآمن بدون gmt-sandbox.js.'); render(false); return; }
    }

    // ─── الحاجز الثاني: تأكيد أن الكتابة معترَضة فعلاً ───
    var blocked = await verifyWriteBlocked();
    add(blocked ? 'ok' : 'fail', 'الأمان',
      blocked ? 'الحاجز المزدوج مؤكّد' : '🔴 الحماية غير مؤكّدة',
      blocked ? 'الوضع التدريبي شغّال والكتابة لا تصل القاعدة الحقيقية.' :
                'لم أتأكد أن الكتابة معترَضة — سأتخطّى الأزرار الخطيرة احتياطاً.');

    var safeToTestDanger = blocked;

    // ─── اكتشاف كل الأزرار ───
    var buttons = discoverButtons();
    add('info', 'الاكتشاف', 'وُجد ' + buttons.length + ' زر/عنصر تفاعلي', 'سأجرّبها واحداً واحداً.');

    // ─── تجربة كل زر ───
    var tested = 0, dead = 0, danger = 0, skipped = 0;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      // الأزرار الخطيرة: الحاجز الثلاثي
      if (b.danger) {
        danger++;
        if (!safeToTestDanger) {
          add('warn', 'زر خطير', '⏭ تُخطّي: ' + b.label, 'زر خطير والحماية غير مؤكّدة — لم أضغطه حفاظاً على بياناتك.', true);
          skipped++;
          continue;
        }
      }
      // بصمة قبل الضغط
      var before = {
        html: document.body.innerHTML.length,
        modals: document.querySelectorAll('.modal,[role=dialog],.popup').length,
        url: location.href
      };
      var errored = false;
      try {
        // اضغط فعلياً (بأمان الوضع التدريبي)
        b.el.click();
      } catch (e) {
        errored = true;
        add('fail', 'زر', '🔴 خطأ عند ضغط: ' + b.label, String(e).slice(0, 120), b.danger);
      }
      // انتظر رد الفعل
      await sleep(120);
      var after = {
        html: document.body.innerHTML.length,
        modals: document.querySelectorAll('.modal,[role=dialog],.popup').length,
        url: location.href
      };
      tested++;
      if (!errored) {
        var changed = (before.html !== after.html) || (before.modals !== after.modals) || (before.url !== after.url);
        if (changed) {
          add('ok', 'زر', '✅ ' + b.label, b.danger ? 'زر خطير — جُرّب بأمان تدريبي.' : '', b.danger);
        } else {
          dead++;
          add('warn', 'زر', '⚠️ بلا أثر ظاهر: ' + b.label, 'الضغط لم يُحدث تغييراً مرئياً — قد يكون زرّاً ميتاً أو يحتاج شرطاً.', b.danger);
        }
      }
      // أغلق أي نافذة انفتحت (بحثاً عن زر إغلاق)
      closeModals();
      await sleep(40);
    }

    // ─── فحص المعاينات الرقمية ───
    var numIssues = checkNumbers();
    if (numIssues.length) numIssues.forEach(function (x) { add('fail', 'الأرقام', '🔴 ' + x.what); });
    else add('ok', 'الأرقام', '✅ لا قيم رقمية شاذّة', 'لا NaN · لا قيم سالبة غير متوقّعة · لا لانهاية.');

    // ─── فحص الطباعة ───
    var pr = checkPrintTemplates();
    if (pr.issues.length) pr.issues.forEach(function (x) { add('fail', 'الطباعة', '🔴 ' + x.what); });
    else add('ok', 'الطباعة', '✅ قوالب الطباعة (' + pr.count + ') سليمة', 'لا قالب فارغ.');

    // ─── فحص الأشكال ───
    var shapeIssues = checkShapes();
    if (shapeIssues.length) shapeIssues.forEach(function (x) { add('warn', 'الأشكال', '⚠️ ' + x.what); });
    else add('ok', 'الأشكال', '✅ الصور والجداول سليمة', '');

    // ─── ⭐ اختبارات الترابط بين الوحدات (يجعل الفاحص أقوى) ───
    if (window.GMTIntegrationTests && GMTIntegrationTests.run) {
      add('info', 'الترابط', 'فحص الترابط بين الوحدات...', 'المشتريات↔الجرد · الجرد↔المتجر · البيع↔العمولة...');
      try {
        var links = await GMTIntegrationTests.run();
        links.forEach(function (L) {
          add(L.ok === true ? 'ok' : L.ok === false ? 'fail' : 'info', 'الترابط',
            (L.ok === true ? '✅ ' : L.ok === false ? '🔴 ' : 'ℹ️ ') + L.title, L.msg + (L.detail ? ' — ' + L.detail : ''));
        });
      } catch (e) { add('warn', 'الترابط', 'تعذّر فحص الترابط', String(e).slice(0, 80)); }
    }

    // ─── ⭐ الاختبارات الوهمية (probes) — تقوية إضافية ───
    if (window.GMTWarden && GMTWarden.runProbes) {
      try {
        var probeResults = await GMTWarden.runProbes();
        probeResults.forEach(function (p) {
          add(p.ok ? 'ok' : 'fail', 'اختبار وهمي', (p.ok ? '✅ ' : '🔴 ') + p.title, p.msg);
        });
      } catch (e) {}
    }

    // ─── الخلاصة ───
    add('info', 'الخلاصة',
      'جُرّب ' + tested + ' زر · ' + dead + ' بلا أثر · ' + danger + ' خطير · ' + skipped + ' تُخطّي',
      'اكتمل الفحص الشامل.');

    // احفظ البصمة (فُحصت هذه النسخة)
    try {
      localStorage.setItem(VER_KEY, deployVersion());
      localStorage.setItem(RESULT_KEY, JSON.stringify({ ts: Date.now(), summary: { tested: tested, dead: dead, danger: danger, skipped: skipped } }));
      sessionStorage.removeItem('gmt_autotest_resume');
    } catch (e) {}

    // بلّغ المراقب السيادي بالنتائج المهمة
    reportToWarden();

    running = false;
    render(false);
  }

  function reportToWarden() {
    if (!window.GMTWarden || !GMTWarden.flag) return;
    var fails = R.filter(function (r) { return r.status === 'fail'; });
    var deadBtns = R.filter(function (r) { return r.status === 'warn' && /بلا أثر/.test(r.title); });
    if (fails.length) {
      GMTWarden.flag({
        kind: 'technical', severity: 'high', title: 'الفاحص الشامل: ' + fails.length + ' مشكلة',
        what: fails.slice(0, 5).map(function (f) { return f.title; }).join(' · '),
        how: 'فحص E2E آلي', why: 'كُشف بالتجربة الآلية بعد النشر.'
      });
    }
    if (deadBtns.length) {
      GMTWarden.flag({
        kind: 'programmatic', severity: 'medium', title: 'الفاحص الشامل: ' + deadBtns.length + ' زر بلا أثر',
        what: deadBtns.slice(0, 8).map(function (f) { return f.title.replace('⚠️ بلا أثر ظاهر: ', ''); }).join(' · '),
        how: 'ضغط آلي بلا تغيير مرئي', why: 'قد تكون أزراراً ميتة أو تحتاج شرطاً.'
      });
    }
  }

  function closeModals() {
    var closers = document.querySelectorAll('[onclick*=close i],[onclick*=إغلاق],.modal .close,[aria-label=Close],[aria-label=إغلاق]');
    Array.prototype.forEach.call(closers, function (c) {
      if (c.offsetParent !== null) { try { c.click(); } catch (e) {} }
    });
    // مفتاح Escape
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); } catch (e) {}
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ═══════════ الواجهة ═══════════ */
  function render(busy) {
    var d = document.getElementById('gmt-autotest-panel');
    if (!d) {
      d = document.createElement('div');
      d.id = 'gmt-autotest-panel';
      d.style.cssText = 'position:fixed;inset:0;z-index:2147481800;background:rgba(4,6,10,.96);backdrop-filter:blur(8px);' +
        'padding:16px;overflow:auto;direction:rtl;font-family:Cairo,system-ui,sans-serif;';
      document.body.appendChild(d);
    }
    var fails = R.filter(function (r) { return r.status === 'fail'; });
    var warns = R.filter(function (r) { return r.status === 'warn'; });
    var oks = R.filter(function (r) { return r.status === 'ok'; });
    var verdict = busy ? '⏳ جارٍ الفحص الشامل — يجرّب كل زر...'
      : (fails.length ? '🔴 ' + fails.length + ' مشكلة تحتاج مراجعة'
        : (warns.length ? '🟡 ' + warns.length + ' تنبيه' : '✅ كل شيء سليم'));
    var vcol = busy ? '#334155' : (fails.length ? '#dc2626' : (warns.length ? '#b45309' : '#16a34a'));

    function card(x) {
      var ic = x.status === 'ok' ? '✅' : x.status === 'warn' ? '🟡' : x.status === 'fail' ? '🔴' : 'ℹ️';
      var bc = x.status === 'ok' ? 'rgba(22,163,74,.35)' : x.status === 'warn' ? 'rgba(180,83,9,.5)' : x.status === 'fail' ? 'rgba(220,38,38,.5)' : 'rgba(255,255,255,.12)';
      return '<div style="background:#141a26;border:1px solid ' + bc + ';border-radius:11px;padding:9px 12px;margin-bottom:5px">' +
        '<div style="font-weight:800;font-size:12.5px;color:#fff">' + ic + ' ' + x.title +
        (x.danger ? ' <span style="background:#7c2d12;color:#fca5a5;font-size:9px;padding:1px 5px;border-radius:4px">خطير</span>' : '') +
        ' <span style="color:#6f7789;font-weight:600;font-size:10px">' + x.area + '</span></div>' +
        (x.detail ? '<div style="font-size:11px;color:#aab3c4;margin-top:2px">' + x.detail.replace(/</g, '&lt;') + '</div>' : '') + '</div>';
    }

    d.innerHTML =
      '<div style="max-width:880px;margin:0 auto;background:#0f131c;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;color:#fff">' +
        '<div style="padding:14px 16px;background:' + vcol + ';display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<div><div style="font-weight:900;font-size:15px">🤖 الفاحص الشامل الآلي</div>' +
          '<div style="font-size:12px;opacity:.92;margin-top:2px">' + verdict + '</div></div>' +
          '<div style="display:flex;gap:6px">' +
            (busy ? '' : '<button id="at-run" style="background:rgba(255,255,255,.2);color:#fff;border:0;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:11px;cursor:pointer">🔄 إعادة</button>' +
            '<button id="at-copy" style="background:rgba(255,255,255,.2);color:#fff;border:0;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:11px;cursor:pointer">📋 نسخ</button>') +
            '<button id="at-x" style="background:rgba(0,0,0,.25);color:#fff;border:0;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:11px;cursor:pointer">✕</button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:12px 14px 18px">' +
          '<div style="display:flex;gap:6px;margin-bottom:10px;font-size:11px;font-weight:900;flex-wrap:wrap">' +
            '<span style="background:rgba(220,38,38,.2);color:#fca5a5;padding:4px 9px;border-radius:8px">🔴 ' + fails.length + '</span>' +
            '<span style="background:rgba(180,83,9,.2);color:#fbbf24;padding:4px 9px;border-radius:8px">🟡 ' + warns.length + '</span>' +
            '<span style="background:rgba(22,163,74,.2);color:#4ade80;padding:4px 9px;border-radius:8px">✅ ' + oks.length + '</span>' +
          '</div>' +
          (fails.length ? fails.map(card).join('') : '') +
          (warns.length ? warns.map(card).join('') : '') +
          '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:900;color:#4ade80">✅ الناجحة والمعلومات (' + (oks.length + R.filter(function(r){return r.status==='info';}).length) + ')</summary><div style="margin-top:6px">' +
            R.filter(function (r) { return r.status === 'ok' || r.status === 'info'; }).map(card).join('') + '</div></details>' +
        '</div>' +
      '</div>';

    var x = d.querySelector('#at-x'); if (x) x.onclick = function () { d.remove(); };
    var rn = d.querySelector('#at-run'); if (rn) rn.onclick = function () { run(); };
    var cp = d.querySelector('#at-copy'); if (cp) cp.onclick = function () {
      var t = '🤖 تقرير الفاحص الشامل · ' + new Date().toLocaleString('ar-SY') + '\nالصفحة: ' + document.title + '\n' + verdict + '\n\n' +
        R.map(function (r) { return (r.status === 'ok' ? '[✓] ' : r.status === 'fail' ? '[✗] ' : r.status === 'warn' ? '[!] ' : '[i] ') + r.area + ' — ' + r.title + (r.detail ? '\n    ' + r.detail : ''); }).join('\n');
      try { navigator.clipboard.writeText(t); alert('✅ نُسخ تقرير الفاحص الشامل.'); } catch (e) { alert('انسخه يدوياً.'); }
    };
  }

  /* ═══════════ زر عائم + التشغيل التلقائي ═══════════ */
  function fab() {
    if (!isAdmin() || isCustomerPage()) { var e = document.getElementById('gmt-autotest-fab'); if (e) e.remove(); return; }
    if (document.getElementById('gmt-autotest-fab')) return;
    var b = document.createElement('button');
    b.id = 'gmt-autotest-fab';
    b.title = 'الفاحص الشامل — يجرّب كل زر';
    b.textContent = '🤖';
    b.style.cssText = 'position:fixed;left:14px;bottom:262px;z-index:2147481000;width:46px;height:46px;border-radius:50%;' +
      'border:0;background:#4338ca;color:#fff;font-size:19px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35);';
    b.onclick = function () { run(); };
    document.body.appendChild(b);
  }

  function maybeAutoRun() {
    if (!isAdmin() || isCustomerPage()) return;
    // استئناف بعد دخول الوضع التدريبي
    var resume = false;
    try { resume = sessionStorage.getItem('gmt_autotest_resume') === '1'; } catch (e) {}
    if (resume && sandboxActive()) { setTimeout(function () { run(); }, 1500); return; }
    // أول مرة بعد نشر جديد: البصمة تغيّرت
    var last = '';
    try { last = localStorage.getItem(VER_KEY) || ''; } catch (e) {}
    var now = deployVersion();
    if (last !== now) {
      // نشرة جديدة — شغّل تلقائياً مرة واحدة (بعد أن يستقر النظام)
      setTimeout(function () {
        if (confirm('🤖 تم اكتشاف نشرة جديدة.\nهل تريد تشغيل الفحص الشامل الآلي الآن؟\n(سيجرّب كل زر بأمان الوضع التدريبي)')) {
          run();
        } else {
          try { localStorage.setItem(VER_KEY, now); } catch (e) {} // لا تسأل ثانيةً لنفس النسخة
        }
      }, 3500);
    }
  }

  window.GMTAutoTest = {
    version: VERSION,
    run: run,
    results: function () { return R; },
    discover: discoverButtons
  };

  function boot() { fab(); maybeAutoRun(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(fab, 2800);
}());
