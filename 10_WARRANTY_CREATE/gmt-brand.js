/* ═══════════════════════════════════════════════════════════════════════════
   gmt-brand.js — 🎨 محرّك الهوية البصرية · v1.0 · 2026-07-13
   ─────────────────────────────────────────────────────────────────────────
   طلبك الحرفي: «الواجهات والموشن والأزرار والأيقونات **تتعلّم من الهوية
   البصرية تبعيتي**».

   المشكلة: البوتات كانت تحمل الأحمر مثبّتاً بالكود (#C00012). لو غيّرت
   هويتك غداً ⇒ تبقى البوتات بلون قديم ⇒ تبدو غريبة عن نظامك.

   الحل: هذا الملف **يقرأ الهوية من الصفحة نفسها وقت التشغيل**:
     ① متغيّرات gmt-theme.css   (--gmt-red · --gmt-ink · --gmt-line …)
     ② أو <meta name="theme-color">
     ③ أو يستنبطها من ألوان الأزرار الفعلية بالصفحة
   ثم يُصدّرها لكل البوتات كمتغيّرات CSS (--gg-*) ⇒ **بوت واحد يتلوّن بلونك**.

   + يعالج **الصور المكسورة**: أي صورة 404 تُستبدل ببديل مرسوم بلونك
     (بدل أيقونة الصورة المكسورة القبيحة) — يغطّي canonlogo/mark/truck…

   يجب أن يُحمَّل **أولاً** قبل باقي البوتات.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTBrand) return;

  var DEFAULTS = {
    red:       '#C00012',
    redDark:   '#8E000D',
    redLight:  '#FEE2E2',
    ink:       '#111827',
    line:      '#E5E7EB',
    surface:   '#FFFFFF',
    ok:        '#16A34A',
    warn:      '#D97706',
    danger:    '#B91C1C',
    font:      'Cairo, system-ui, "Segoe UI", Tahoma, sans-serif',
    radius:    '14px',
    logo:      'logo.jpg',
    name:      'General Media Tech'
  };

  function cssVar(name) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v || '').trim() || null;
    } catch (e) { return null; }
  }

  /* ① من الثيم — المصدر الأول والأصحّ */
  function fromTheme() {
    return {
      red:      cssVar('--gmt-red'),
      redDark:  cssVar('--gmt-red-dark'),
      redLight: cssVar('--gmt-red-light'),
      ink:      cssVar('--gmt-ink'),
      line:     cssVar('--gmt-line'),
      surface:  cssVar('--gmt-surface'),
      ok:       cssVar('--gmt-ok'),
      warn:     cssVar('--gmt-warn'),
      danger:   cssVar('--gmt-danger'),
      radius:   cssVar('--gmt-radius'),
      font:     cssVar('--gmt-font')
    };
  }

  /* ② من meta theme-color */
  function fromMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    return m ? { red: m.getAttribute('content') } : {};
  }

  /* ③ استنباط: أكثر لون خلفية شيوعاً بين الأزرار البارزة */
  function fromButtons() {
    try {
      var counts = {};
      var els = document.querySelectorAll('button,.btn,[class*=primary]');
      for (var i = 0; i < Math.min(els.length, 90); i++) {
        var bg = getComputedStyle(els[i]).backgroundColor;
        var m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) continue;
        var r = +m[1], g = +m[2], b = +m[3];
        if (r + g + b > 690 || r + g + b < 40) continue;    // تجاهل الأبيض والأسود
        if (r < g || r < b) continue;                        // نبحث عن لون هوية دافئ/أحمر
        var hex = '#' + [r, g, b].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
        counts[hex] = (counts[hex] || 0) + 1;
      }
      var best = null, n = 0;
      Object.keys(counts).forEach(function (k) { if (counts[k] > n) { n = counts[k]; best = k; } });
      return n >= 2 ? { red: best } : {};
    } catch (e) { return {}; }
  }

  /* اللوجو: أول صورة تحمل اسماً يشبه اللوجو */
  function findLogo() {
    var el = document.querySelector('img[src*="logo" i], link[rel*="icon"]');
    if (!el) return null;
    return el.getAttribute('src') || el.getAttribute('href');
  }

  function build() {
    var b = {};
    var sources = [fromButtons(), fromMeta(), fromTheme()];   // الثيم آخِراً ⇒ أعلى أولوية
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = null;
      sources.forEach(function (s) { if (s && s[k]) v = s[k]; });
      b[k] = v || DEFAULTS[k];
    });
    b.logo = findLogo() || DEFAULTS.logo;
    b.source = cssVar('--gmt-red') ? 'gmt-theme.css' : (fromMeta().red ? 'meta theme-color' : (fromButtons().red ? 'استنباط من الأزرار' : 'افتراضي'));
    return b;
  }

  var B = build();

  /* ── صدّر الهوية لكل البوتات كمتغيّرات CSS موحّدة ── */
  function inject() {
    var s = document.getElementById('gmt-brand-vars') || document.createElement('style');
    s.id = 'gmt-brand-vars';
    s.textContent =
      ':root{' +
        '--gg-red:' + B.red + ';' +
        '--gg-red-dark:' + B.redDark + ';' +
        '--gg-red-light:' + B.redLight + ';' +
        '--gg-ink:' + B.ink + ';' +
        '--gg-line:' + B.line + ';' +
        '--gg-surface:' + B.surface + ';' +
        '--gg-ok:' + B.ok + ';' +
        '--gg-warn:' + B.warn + ';' +
        '--gg-danger:' + B.danger + ';' +
        '--gg-radius:' + B.radius + ';' +
        '--gg-font:' + B.font + ';' +
      '}';
      /* ملاحظة: لا نحقن أي نمط على عناصر تصميمك. المتغيّرات --gg-* للبوتات فقط،
         ولا تستعملها أي صفحة قديمة ⇒ تصميمك لا يتغيّر إطلاقاً. */
    if (!s.parentNode) document.head.appendChild(s);
  }

  /* ── الصور المكسورة (يغطّي canonlogo · mark · shamcash · truck …) ── */
  var broken = [];
  function guardImages() {
    function handle(img) {
      if (img.dataset.gmtGuarded) return;
      img.dataset.gmtGuarded = '1';
      img.addEventListener('error', function () {
        if (img.dataset.gmtFallen) return;
        img.dataset.gmtFallen = '1';
        var src = img.getAttribute('src') || '';
        var name = src.split('/').pop().split('?')[0];
        if (broken.indexOf(name) === -1) broken.push(name);

        // أبلِغ الحارس دائماً — لا تمرّ الصور المفقودة بصمت
        if (window.GMTBug && GMTBug.log) {
          GMTBug.log('warn', 'صورة مفقودة (404): ' + name, { type: 'missing_asset', file: name, page: document.title });
        }
        if (window.GMTInspect && GMTInspect.step) GMTInspect.step('🖼️', 'صورة مفقودة: ' + name);

        /* 🚫 قاعدة صارمة (طلبك): لا نمسح أي شعار ولا نرسم بديلاً «من عندنا».
           إن كانت الصورة المكسورة شعاراً/أيقونة، نحاول شعارك الحقيقي (logo.jpg)
           — لا نستبدله بمربّع مصمَّم. لو فشل هذا أيضاً، نُخفيها بهدوء ونترك
           تصميمك كما هو (لا عنصر غريب مكانها). */
        var looksLikeLogo = /logo|mark|brand|icon/i.test(name) ||
                            /logo|mark|brand|icon/i.test(img.className || '') ||
                            /شعار|لوغو|logo/i.test(img.alt || '');

        if (looksLikeLogo && B.logo && name.toLowerCase() !== (B.logo.split('/').pop() || '').toLowerCase()) {
          // بدّل المصدر إلى شعارك الفعلي مرّة واحدة فقط
          img.dataset.gmtFallen = '';        // اسمح بمحاولة أخيرة على logo.jpg
          img.dataset.gmtLogoTried = '1';
          img.src = B.logo;
          return;
        }

        // ليس شعاراً (أو حتى logo.jpg غير موجود): أخفِها بهدوء — لا نضع شيئاً من تصميمنا
        img.style.visibility = 'hidden';
      }, { once: false });
      // إن كانت قد فشلت مسبقاً
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
        img.dispatchEvent(new Event('error'));
      }
    }
    Array.prototype.forEach.call(document.images, handle);
    // راقب الصور المضافة لاحقاً
    try {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes || [], function (n) {
            if (n.tagName === 'IMG') handle(n);
            else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('img'), handle);
          });
        });
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  window.GMTBrand = {
    version: 1.0,
    get: function (k) { return k ? B[k] : B; },
    red: function () { return B.red; },
    css: function (k) { return 'var(--gg-' + k + ',' + (B[k] || '') + ')'; },
    brokenImages: function () { return broken.slice(); },
    refresh: function () { B = build(); inject(); return B; }
  };

  inject();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guardImages);
  else guardImages();
}());
