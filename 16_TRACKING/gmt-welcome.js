/* ═══════════════════════════════════════════════════════════════════════
   gmt-welcome.js — 🪦 شاهدة توافق (إصدار 2026-07-12)
   شاشات الترحيب القديمة استُبدلت بشاشات gmt-guide.js الكاملة (موشن + هوية + تقليب).
   يبقى الملف لتوافق الصفحات القديمة: كل نداء يفتح النظام الجديد.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const jump = () => { if (window.GMTGuide) window.GMTGuide.start(); };
  ['showWelcomeSlides', 'showWelcomeSlidesForce', 'gmtWelcomeNext', 'gmtWelcomePrev',
   'gmtWelcomeGoTo', 'gmtWelcomeClose', 'gmtWelcomeDone', 'gmtWelcomeTouchStart', 'gmtWelcomeTouchEnd']
    .forEach((n) => { try { if (!Object.getOwnPropertyDescriptor(window, n)) window[n] = jump; } catch (_) {} });
})();
