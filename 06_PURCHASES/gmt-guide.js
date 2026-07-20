/* ═══════════════════════════════════════════════════════════════════════════
   gmt-guide.js — النظام التعليمي GMT · v4.0 (2026-07-13)
   ─────────────────────────────────────────────────────────────────────────
   يُلغي ويحلّ محلّ: gmt-tour.js · gmt-welcome.js (الجولة القديمة ماتت — TOUR-1)

   الجديد في v4 (طلبك الحرفي: «شاشات كبيرة · موشن جرافيك · شاشات ترحيبية»):
     • شاشة افتتاح بهويتنا: لوجو ينبض + شريط تحميل.
     • شاشات كاملة — لا نوافذ صغيرة، لا getBoundingClientRect ⇒ يستحيل أن تطير لمكان عشوائي.
     • موشن جرافيك: مشاهد SVG متحركة + جسيمات + تدرّج متحرك + دخول متتابع.
     • تقليب تلقائي + يدوي + إيقاف + شريط تقدّم + نقاط + لوحة مفاتيح + سحب باللمس.
     • تخطيطان حقيقيان: ديسكتوب (عمودان) وموبايل (عمود).
     • فهرس: 🔘 الأزرار زرّاً بزرّ · 🏋️ جلسات تدريب · 🆕 الجديد · 🎬 إعادة الشاشات.
     • «👆 أرِني» يومض على الزر الحقيقي.
     • يحترم prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTGuide && window.GMTGuide.version >= 4) return;

  var VERSION = 4.0;
  /* 🎨 اللون يُقرأ من هويتك (gmt-brand.js ← gmt-theme.css) — لا يُثبَّت بالكود.
     غيّر --gmt-red بالثيم ⇒ كل البوتات تتلوّن معك تلقائياً. */
  var RED = (window.GMTBrand && GMTBrand.red()) || '#C00012';
  var FONT = (window.GMTBrand && GMTBrand.get('font')) || 'Cairo, system-ui, "Segoe UI", Tahoma, sans-serif';
  var SPEC = {};
  var LS = function (k) { return 'gmt_guide4_' + k + '_' + (SPEC.id || 'page'); };
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ═══════════ 1) الأنماط + الموشن ═══════════ */
  function styles() {
    if (document.getElementById('gg4-css')) return;
    var s = document.createElement('style');
    s.id = 'gg4-css';
    s.textContent = [
      '@keyframes gg-in{from{opacity:0;transform:translateY(26px) scale(.97)}to{opacity:1;transform:none}}',
      '@keyframes gg-out{to{opacity:0;transform:translateY(-18px) scale(.98)}}',
      '@keyframes gg-pop{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:none}}',
      '@keyframes gg-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}',
      '@keyframes gg-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-11px)}}',
      '@keyframes gg-spin{to{transform:rotate(360deg)}}',
      '@keyframes gg-grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
      '@keyframes gg-rise{from{opacity:0;transform:translateY(30px)}to{opacity:.55;transform:translateY(-40px)}}',
      '@keyframes gg-blink{0%,100%{box-shadow:0 0 0 0 rgba(192,0,18,.75)}50%{box-shadow:0 0 0 14px rgba(192,0,18,0)}}',
      '@keyframes gg-bar{from{width:0}to{width:100%}}',

      '.gg4{position:fixed;inset:0;z-index:2147483000;direction:rtl;font-family:' + FONT + ';',
      'color:#fff;display:flex;flex-direction:column;overflow:hidden;',
      'background:linear-gradient(130deg,#0a0d14,#141a26,#0d1017,#1a1220);background-size:400% 400%;animation:gg-grad 18s ease infinite}',
      '.gg4 *{box-sizing:border-box}',
      '.gg4-orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.30;pointer-events:none}',
      '.gg4-p{position:absolute;bottom:-10px;width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.5);animation:gg-rise linear infinite;pointer-events:none}',

      '.gg4-splash{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:9;background:#080a10}',
      '.gg4-logo{width:132px;height:132px;border-radius:32px;object-fit:cover;animation:gg-pulse 2s ease-in-out infinite;box-shadow:0 24px 70px rgba(192,0,18,.4)}',
      '.gg4-logo-f{width:132px;height:132px;border-radius:32px;display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:900;',
      'background:linear-gradient(135deg,' + RED + ',#7a000c);animation:gg-pulse 2s ease-in-out infinite}',
      '.gg4-sbar{width:230px;height:5px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}',
      '.gg4-sbar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,' + RED + ',#ff5a6a);animation:gg-bar 1.5s ease forwards}',
      '.gg4-stxt{font-size:13px;font-weight:800;color:#8b93a7}',

      '.gg4-top{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px}',
      '.gg4-brand{display:flex;align-items:center;gap:9px;font-weight:900;font-size:14px}',
      '.gg4-dot{width:9px;height:9px;border-radius:50%;background:' + RED + ';box-shadow:0 0 12px ' + RED + '}',
      '.gg4-x{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:12px;',
      'padding:8px 15px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer;transition:.18s}',
      '.gg4-x:hover{background:rgba(255,255,255,.18)}',

      '.gg4-stage{position:relative;z-index:3;flex:1;display:flex;align-items:center;justify-content:center;padding:8px 22px 4px;overflow:hidden}',
      '.gg4-slide{width:100%;max-width:1180px;display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;animation:gg-in .55s cubic-bezier(.2,.8,.25,1) both}',
      '.gg4-slide.out{animation:gg-out .28s ease forwards}',
      '@media(max-width:900px){.gg4-slide{grid-template-columns:1fr;gap:18px;text-align:center}.gg4-art{order:-1;min-height:180px!important}}',

      '.gg4-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:99px;font-size:11px;font-weight:900;',
      'background:rgba(192,0,18,.16);border:1px solid rgba(192,0,18,.45);color:#ff8b96;margin-bottom:14px;animation:gg-pop .5s .1s both}',
      '.gg4-h{font-size:clamp(24px,4.1vw,42px);font-weight:900;line-height:1.28;margin:0 0 14px;animation:gg-pop .5s .18s both;',
      'background:linear-gradient(100deg,#fff 30%,#ffb3ba);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
      '.gg4-b{font-size:clamp(14px,1.6vw,17px);line-height:2;color:#c3cad8;margin:0 0 18px;animation:gg-pop .5s .26s both}',
      '.gg4-b b{color:#fff}',
      '.gg4-ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}',
      '.gg4-li{display:flex;gap:11px;align-items:flex-start;text-align:right;background:rgba(255,255,255,.045);',
      'border:1px solid rgba(255,255,255,.09);border-radius:15px;padding:12px 14px;font-size:13.5px;line-height:1.85;color:#dbe1ec;animation:gg-pop .5s both}',
      '.gg4-li i{font-style:normal;font-size:20px;flex-shrink:0}',
      '.gg4-li b{color:#fff}',
      '.gg4-warn{background:rgba(192,0,18,.13);border-color:rgba(192,0,18,.42)}',

      '.gg4-art{position:relative;display:flex;align-items:center;justify-content:center;min-height:270px;animation:gg-pop .6s .12s both}',
      '.gg4-art svg{width:100%;max-width:400px;height:auto;overflow:visible}',
      '.gg4-emoji{font-size:clamp(88px,15vw,164px);animation:gg-float 3.6s ease-in-out infinite}',
      '.gg4-ring{position:absolute;border:2px solid rgba(192,0,18,.28);border-radius:50%;animation:gg-spin 22s linear infinite}',

      '.gg4-bot{position:relative;z-index:3;padding:14px 18px 20px;display:flex;flex-direction:column;gap:11px}',
      '.gg4-prog{height:4px;border-radius:99px;background:rgba(255,255,255,.11);overflow:hidden}',
      '.gg4-prog i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,' + RED + ',#ff6b7a);transition:width .4s cubic-bezier(.2,.8,.25,1)}',
      '.gg4-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.gg4-dots{display:flex;gap:6px;flex-wrap:wrap}',
      '.gg4-d{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.24);cursor:pointer;transition:.25s;border:0;padding:0}',
      '.gg4-d.on{width:26px;border-radius:99px;background:' + RED + '}',
      '.gg4-btns{display:flex;gap:8px;flex-wrap:wrap}',
      '.gg4-btn{border:0;border-radius:13px;padding:11px 20px;font:inherit;font-weight:900;font-size:13px;cursor:pointer;transition:.18s}',
      '.gg4-btn:active{transform:scale(.96)}',
      '.gg4-primary{background:' + RED + ';color:#fff;box-shadow:0 10px 26px rgba(192,0,18,.35)}',
      '.gg4-ghost{background:rgba(255,255,255,.09);color:#e7ebf2;border:1px solid rgba(255,255,255,.16)}',

      '.gg4-idx{position:fixed;inset:0;z-index:2147483100;background:rgba(6,8,13,.96);backdrop-filter:blur(10px);overflow:auto;padding:16px;',
      'direction:rtl;font-family:' + FONT + ';color:#fff;animation:gg-in .3s ease both}',
      '.gg4-sheet{max-width:1080px;margin:0 auto;background:#0f131c;border:1px solid rgba(255,255,255,.1);border-radius:22px;overflow:hidden}',
      '.gg4-sh-h{padding:16px 18px;background:linear-gradient(135deg,#171d2a,#101520);border-bottom:1px solid rgba(255,255,255,.09);position:sticky;top:0;z-index:2}',
      '.gg4-tab{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#c3cad8;border-radius:11px;',
      'padding:8px 13px;font:inherit;font-weight:800;font-size:12px;cursor:pointer;transition:.16s}',
      '.gg4-tab.on{background:' + RED + ';color:#fff;border-color:transparent}',
      '.gg4-search{width:100%;margin-top:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);',
      'border-radius:13px;padding:11px 14px;color:#fff;font:inherit;font-size:13px}',
      '.gg4-search::placeholder{color:#6f7789}',
      '.gg4-grid{padding:16px 18px 26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}',
      '.gg4-card{background:#141a26;border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:14px 15px;animation:gg-pop .35s both}',
      '.gg4-card h4{margin:0 0 8px;font-size:14.5px;font-weight:900;color:#fff}',
      '.gg4-card p{margin:0 0 6px;font-size:12.5px;line-height:1.95;color:#aab3c4}',
      '.gg4-lbl{color:#ff8b96;font-weight:900}',
      '.gg4-show{margin-top:8px;background:rgba(192,0,18,.17);border:1px solid rgba(192,0,18,.45);color:#ff9aa4;',
      'border-radius:10px;padding:7px 12px;font:inherit;font-weight:800;font-size:11.5px;cursor:pointer}',

      '.gg4-hl{position:relative!important;z-index:2147483200!important;outline:3px solid ' + RED + '!important;',
      'border-radius:12px!important;animation:gg-blink 1.1s ease-in-out 3!important;scroll-margin:120px}',

      '.gg4-fab{position:fixed;left:14px;bottom:14px;z-index:2147482000;background:' + RED + ';color:#fff;border:0;',
      'border-radius:50%;width:52px;height:52px;font-size:22px;cursor:pointer;box-shadow:0 10px 28px rgba(192,0,18,.45);',
      'display:flex;align-items:center;justify-content:center;transition:.2s}',
      '.gg4-fab:hover{transform:scale(1.09)}',
      reduce ? '.gg4,.gg4 *{animation:none!important;transition:none!important}' : ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ═══════════ 2) مشاهد الموشن (SVG) ═══════════ */
  var ART = {
    sell: '<svg viewBox="0 0 300 220">' +
      '<rect x="60" y="80" width="120" height="90" rx="14" fill="' + RED + '" opacity=".9"/>' +
      '<path d="M85 80 L95 45 M155 80 L145 45" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/>' +
      '<rect x="185" y="40" width="76" height="104" rx="9" fill="#fff" opacity=".95">' +
      '<animate attributeName="y" values="40;30;40" dur="3s" repeatCount="indefinite"/></rect>' +
      '<g stroke="' + RED + '" stroke-width="4" stroke-linecap="round">' +
      '<line x1="197" y1="62" x2="249" y2="62"><animate attributeName="x2" values="197;249" dur="1.4s" repeatCount="indefinite"/></line>' +
      '<line x1="197" y1="80" x2="235" y2="80"><animate attributeName="x2" values="197;235" dur="1.7s" repeatCount="indefinite"/></line>' +
      '<line x1="197" y1="98" x2="249" y2="98"><animate attributeName="x2" values="197;249" dur="2s" repeatCount="indefinite"/></line></g>' +
      '<circle cx="90" cy="188" r="12" fill="#fff"/><circle cx="152" cy="188" r="12" fill="#fff"/></svg>',

    stock: '<svg viewBox="0 0 300 220"><g fill="' + RED + '" opacity=".92">' +
      '<rect x="40" y="140" width="66" height="60" rx="9"><animate attributeName="y" values="220;140" dur="1s" fill="freeze"/></rect>' +
      '<rect x="117" y="140" width="66" height="60" rx="9" opacity=".78"><animate attributeName="y" values="220;140" dur="1.2s" fill="freeze"/></rect>' +
      '<rect x="194" y="140" width="66" height="60" rx="9" opacity=".6"><animate attributeName="y" values="220;140" dur="1.4s" fill="freeze"/></rect>' +
      '<rect x="78" y="76" width="66" height="60" rx="9" opacity=".85"><animate attributeName="y" values="220;76" dur="1.7s" fill="freeze"/></rect>' +
      '<rect x="155" y="76" width="66" height="60" rx="9" opacity=".7"><animate attributeName="y" values="220;76" dur="2s" fill="freeze"/></rect></g></svg>',

    watch: '<svg viewBox="0 0 300 220"><g fill="none" stroke="' + RED + '" stroke-width="2.5">' +
      '<circle cx="150" cy="110" r="40" opacity=".9"/>' +
      '<circle cx="150" cy="110" r="60" opacity=".5"><animate attributeName="r" values="45;92" dur="2.6s" repeatCount="indefinite"/>' +
      '<animate attributeName="opacity" values=".65;0" dur="2.6s" repeatCount="indefinite"/></circle>' +
      '<circle cx="150" cy="110" r="60" opacity=".5"><animate attributeName="r" values="45;92" dur="2.6s" begin="1.3s" repeatCount="indefinite"/>' +
      '<animate attributeName="opacity" values=".65;0" dur="2.6s" begin="1.3s" repeatCount="indefinite"/></circle></g>' +
      '<path d="M96 110q54-46 108 0-54 46-108 0z" fill="#fff" opacity=".95"/>' +
      '<circle cx="150" cy="110" r="19" fill="' + RED + '"/><circle cx="150" cy="110" r="8" fill="#0a0d14"/>' +
      '<circle cx="157" cy="103" r="4" fill="#fff" opacity=".9"/></svg>',

    shield: '<svg viewBox="0 0 300 220">' +
      '<path d="M150 26 L228 58 v58c0 46-34 74-78 88-44-14-78-42-78-88V58z" fill="' + RED + '" opacity=".14"/>' +
      '<path d="M150 26 L228 58 v58c0 46-34 74-78 88-44-14-78-42-78-88V58z" fill="none" stroke="' + RED + '" stroke-width="6"' +
      ' stroke-dasharray="600" stroke-dashoffset="600"><animate attributeName="stroke-dashoffset" values="600;0" dur="2s" fill="freeze"/></path>' +
      '<path d="M115 112 l24 26 48-56" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"' +
      ' stroke-dasharray="130" stroke-dashoffset="130"><animate attributeName="stroke-dashoffset" values="130;0" dur="1s" begin="1.6s" fill="freeze"/></path></svg>',

    warn: '<svg viewBox="0 0 300 220">' +
      '<path d="M150 30 L262 196 H38 Z" fill="' + RED + '" opacity=".9"/>' +
      '<rect x="141" y="86" width="18" height="56" rx="9" fill="#fff"/><circle cx="150" cy="164" r="11" fill="#fff"/></svg>',

    ok: '<svg viewBox="0 0 300 220">' +
      '<circle cx="150" cy="110" r="72" fill="none" stroke="#16a34a" stroke-width="7" stroke-dasharray="460" stroke-dashoffset="460">' +
      '<animate attributeName="stroke-dashoffset" values="460;0" dur="1.2s" fill="freeze"/></circle>' +
      '<path d="M112 112 l26 28 52-60" fill="none" stroke="#16a34a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"' +
      ' stroke-dasharray="140" stroke-dashoffset="140"><animate attributeName="stroke-dashoffset" values="140;0" dur=".7s" begin="1s" fill="freeze"/></path></svg>',

    flow: '<svg viewBox="0 0 300 220">' +
      '<path id="ggpath" d="M30 180 C90 180 80 60 150 60 C220 60 210 180 270 180" fill="none" stroke="' + RED + '" stroke-width="4" opacity=".45" stroke-dasharray="8 8"/>' +
      '<rect x="8" y="164" width="44" height="34" rx="8" fill="#fff" opacity=".9"/>' +
      '<rect x="248" y="164" width="44" height="34" rx="8" fill="#fff" opacity=".9"/>' +
      '<rect x="128" y="40" width="44" height="38" rx="8" fill="#fff" opacity=".9"/>' +
      '<circle r="9" fill="' + RED + '"><animateMotion dur="3s" repeatCount="indefinite"><mpath href="#ggpath"/></animateMotion></circle>' +
      '<circle r="7" fill="#ff6b7a" opacity=".8"><animateMotion dur="3s" begin="1s" repeatCount="indefinite"><mpath href="#ggpath"/></animateMotion></circle>' +
      '<circle r="5" fill="#fff" opacity=".6"><animateMotion dur="3s" begin="2s" repeatCount="indefinite"><mpath href="#ggpath"/></animateMotion></circle></svg>'
  };

  function artFor(sl) {
    var rings = '<div class="gg4-ring" style="width:290px;height:290px"></div>' +
                '<div class="gg4-ring" style="width:360px;height:360px;animation-direction:reverse"></div>';
    if (sl.art && ART[sl.art]) return rings + ART[sl.art];
    return rings + '<div class="gg4-emoji">' + (sl.icon || '🎓') + '</div>';
  }

  /* ═══════════ 3) الحالة ═══════════ */
  var host = null, i = 0, timer = null, paused = false;

  function slides() {
    return (SPEC.slides && SPEC.slides.length) ? SPEC.slides : [{
      icon: '🎓', title: 'أهلاً بك',
      body: 'لم تُضف شاشات تعريفية لهذه الصفحة بعد. افتح <b>🔘 الأزرار</b> لتعرف ماذا يفعل كل زر.',
      ms: 9000
    }];
  }

  function bg() {
    var h = '<div class="gg4-orb" style="width:420px;height:420px;background:' + RED + ';top:-130px;right:-110px"></div>' +
            '<div class="gg4-orb" style="width:340px;height:340px;background:#2b4bff;bottom:-120px;left:-90px;opacity:.18"></div>';
    if (!reduce) {
      for (var k = 0; k < 16; k++) {
        h += '<div class="gg4-p" style="left:' + (5 + Math.random() * 90).toFixed(1) + '%;animation-duration:' +
             (5 + Math.random() * 7).toFixed(1) + 's;animation-delay:' + (Math.random() * 6).toFixed(1) + 's"></div>';
      }
    }
    return h;
  }

  /* ═══════════ 4) العرض ═══════════ */
  function render() {
    var L = slides(), sl = L[i], last = (i === L.length - 1);
    var stage = host.querySelector('.gg4-stage');
    var old = stage.querySelector('.gg4-slide');
    if (old) old.classList.add('out');

    var d = document.createElement('div');
    d.className = 'gg4-slide';
    d.innerHTML =
      '<div class="gg4-txt">' +
        (sl.badge ? '<div class="gg4-badge">✦ ' + sl.badge + '</div>' : '') +
        '<h2 class="gg4-h">' + (sl.title || '') + '</h2>' +
        (sl.body ? '<p class="gg4-b">' + sl.body + '</p>' : '') +
        (sl.bullets && sl.bullets.length
          ? '<ul class="gg4-ul">' + sl.bullets.map(function (b, k) {
              return '<li class="gg4-li' + (b.warn ? ' gg4-warn' : '') + '" style="animation-delay:' + (0.34 + k * 0.11) + 's">' +
                     '<i>' + (b.i || '•') + '</i><span>' + b.t + '</span></li>';
            }).join('') + '</ul>'
          : '') +
      '</div>' +
      '<div class="gg4-art">' + artFor(sl) + '</div>';

    setTimeout(function () { if (old) old.remove(); stage.appendChild(d); }, old ? 240 : 0);

    host.querySelector('.gg4-prog i').style.width = (((i + 1) / L.length) * 100) + '%';
    host.querySelector('.gg4-dots').innerHTML = L.map(function (_, k) {
      return '<button class="gg4-d' + (k === i ? ' on' : '') + '" data-go="' + k + '"></button>';
    }).join('');
    host.querySelector('[data-a=next]').textContent = last ? '🚀 ابدأ العمل' : 'التالي ←';
    host.querySelector('[data-a=prev]').style.visibility = i ? 'visible' : 'hidden';
    host.querySelector('.gg4-count').textContent = (i + 1) + ' / ' + L.length;

    auto(sl.ms || 9000);
  }

  function auto(ms) { clearTimeout(timer); if (!paused) timer = setTimeout(next, ms); }
  function next() { if (i < slides().length - 1) { i++; render(); } else close(true); }
  function prev() { if (i > 0) { i--; render(); } }
  function go(k) { i = k; render(); }

  function close(done) {
    clearTimeout(timer);
    if (host) {
      document.removeEventListener('keydown', host._key);
      host.remove(); host = null;
    }
    document.documentElement.style.overflow = '';
    try { localStorage.setItem(LS('seen'), '1'); } catch (e) {}
    if (window.GMTInspect && GMTInspect.step) GMTInspect.step('🎓', done ? 'أنهى الشاشات التعريفية' : 'أغلق الشاشات التعريفية');
  }

  /* ═══════════ 5) الإقلاع ═══════════ */
  function start(force) {
    if (host) return;
    styles();
    i = 0; paused = false;
    document.documentElement.style.overflow = 'hidden';

    host = document.createElement('div');
    host.className = 'gg4';
    host.innerHTML = bg() +
      '<div class="gg4-splash">' +
        (SPEC.logo
          ? '<img class="gg4-logo" src="' + SPEC.logo + '" alt="GMT" onerror="this.style.display=\'none\'">'
          : '<div class="gg4-logo-f">G</div>') +
        '<div style="font-size:19px;font-weight:900;letter-spacing:1px">General Media Tech</div>' +
        '<div class="gg4-sbar"><i></i></div>' +
        '<div class="gg4-stxt">جارٍ تجهيز دليل ' + (SPEC.page || 'الصفحة') + '…</div>' +
      '</div>' +
      '<div class="gg4-top">' +
        '<div class="gg4-brand"><span class="gg4-dot"></span> النظام التعليمي · ' + (SPEC.page || '') + '</div>' +
        '<div style="display:flex;gap:7px">' +
          '<button class="gg4-x" data-a="pause">⏸ إيقاف</button>' +
          '<button class="gg4-x" data-a="index">📖 الفهرس</button>' +
          '<button class="gg4-x" data-a="skip">✕ تخطّي</button>' +
        '</div>' +
      '</div>' +
      '<div class="gg4-stage"></div>' +
      '<div class="gg4-bot">' +
        '<div class="gg4-prog"><i style="width:0"></i></div>' +
        '<div class="gg4-nav">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<div class="gg4-dots"></div>' +
            '<span class="gg4-count" style="font-size:11.5px;font-weight:800;color:#7c8496"></span>' +
          '</div>' +
          '<div class="gg4-btns">' +
            '<button class="gg4-btn gg4-ghost" data-a="prev">→ السابق</button>' +
            '<button class="gg4-btn gg4-primary" data-a="next">التالي ←</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);

    var sp = host.querySelector('.gg4-splash');
    setTimeout(function () {
      sp.style.transition = 'opacity .45s'; sp.style.opacity = '0';
      setTimeout(function () { if (sp.parentNode) sp.remove(); }, 460);
      if (host) render();
    }, reduce ? 200 : 1700);

    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a],[data-go]');
      if (!b) return;
      if (b.dataset.go !== undefined) { go(+b.dataset.go); return; }
      var a = b.dataset.a;
      if (a === 'next') next();
      else if (a === 'prev') prev();
      else if (a === 'skip') close(false);
      else if (a === 'index') { close(false); index(); }
      else if (a === 'pause') {
        paused = !paused;
        b.textContent = paused ? '▶ متابعة' : '⏸ إيقاف';
        if (paused) clearTimeout(timer); else auto(3000);
      }
    });

    host._key = function (e) {
      if (e.key === 'ArrowLeft' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowRight') prev();
      else if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', host._key);

    var x0 = null;
    host.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    host.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (dx < -55) next(); else if (dx > 55) prev();
      x0 = null;
    }, { passive: true });

    if (window.GMTInspect && GMTInspect.step) GMTInspect.step('🎓', 'فتح الشاشات التعريفية');
  }

  /* ═══════════ 6) الفهرس الشامل ═══════════ */
  function index(tab) {
    styles();
    var prevIdx = document.getElementById('gg4-idx');
    if (prevIdx) prevIdx.remove();

    var btns = SPEC.buttons || [], sess = SPEC.sessions || [], news = SPEC.whatsNew || [];
    var inTr = !!(window.GMTSandbox && GMTSandbox.active);

    var wrap = document.createElement('div');
    wrap.className = 'gg4-idx'; wrap.id = 'gg4-idx';
    wrap.innerHTML =
      '<div class="gg4-sheet">' +
        '<div class="gg4-sh-h">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
            '<div style="font-weight:900;font-size:16px">🎓 دليل ' + (SPEC.page || '') + '</div>' +
            '<button class="gg4-tab" data-a="close">✕ إغلاق</button>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
            '<button class="gg4-tab on" data-t="btns">🔘 الأزرار (' + btns.length + ') · تغطية ' + coverage().pct + '%</button>' +
            '<button class="gg4-tab" data-t="sess">🏋️ جلسات تدريب (' + sess.length + ')</button>' +
            '<button class="gg4-tab" data-t="new">🆕 الجديد بهذا التحديث</button>' +
            '<button class="gg4-tab" data-t="tour">🎬 إعادة الشاشات</button>' +
            '<button class="gg4-tab" data-t="train" style="background:' + (inTr ? '#16a34a' : '#b45309') + ';color:#fff;border-color:transparent">' +
              (inTr ? '✅ أنت بالوضع التدريبي' : '🏋️ ابدأ الوضع التدريبي') + '</button>' +
          '</div>' +
          '<input class="gg4-search" placeholder="ابحث… (مرتجع · عمولة · باركود · ترحيل)">' +
        '</div>' +
        '<div class="gg4-grid" id="gg4-grid"></div>' +
      '</div>';
    document.body.appendChild(wrap);

    var grid = wrap.querySelector('#gg4-grid');
    var cur = tab || 'btns';

    function paint(q) {
      q = (q || '').trim();
      if (cur === 'btns') {
        var L = q ? btns.filter(function (b) {
          return ((b.label || '') + (b.what || '') + (b.when || '') + (b.effect || '')).indexOf(q) > -1;
        }) : btns;
        grid.innerHTML = L.length ? L.map(function (b, k) {
          return '<div class="gg4-card" style="animation-delay:' + (k * 0.02) + 's">' +
            '<h4>' + (b.icon || '•') + ' ' + b.label + '</h4>' +
            '<p><span class="gg4-lbl">ماذا يفعل:</span> ' + (b.what || '—') + '</p>' +
            (b.when ? '<p><span class="gg4-lbl">متى تستعمله:</span> ' + b.when + '</p>' : '') +
            (b.effect ? '<p><span class="gg4-lbl">أثره على باقي الأنظمة:</span> ' + b.effect + '</p>' : '') +
            (b.warn ? '<p style="color:#ff9aa4"><span class="gg4-lbl">⚠️ انتبه:</span> ' + b.warn + '</p>' : '') +
            (b.sel ? '<button class="gg4-show" data-show="' + encodeURIComponent(b.sel) + '">👆 أرِني هذا الزر</button>' : '') +
          '</div>';
        }).join('') + (q ? '' : undocCards()) : '<div class="gg4-card"><p>لا نتائج.</p></div>';
      } else if (cur === 'sess') {
        grid.innerHTML = sess.length ? sess.map(function (s) {
          return '<div class="gg4-card"><h4>' + (s.icon || '🎯') + ' ' + s.title + '</h4>' +
            '<p><span class="gg4-lbl">الهدف:</span> ' + s.goal + '</p>' +
            '<p><span class="gg4-lbl">الخطوات:</span></p>' +
            '<ol style="margin:4px 18px 0 0;font-size:12.5px;line-height:2;color:#aab3c4">' +
              (s.steps || []).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>' +
            (s.check ? '<p style="margin-top:8px"><span class="gg4-lbl">✅ تحقّق من النجاح:</span> ' + s.check + '</p>' : '') +
          '</div>';
        }).join('') : '<div class="gg4-card"><p>لا جلسات تدريب لهذه الصفحة بعد.</p></div>';
      } else if (cur === 'new') {
        grid.innerHTML = news.length ? news.map(function (n) {
          return '<div class="gg4-card"><h4>' + (n.tag || '🆕') + ' ' + n.title + '</h4>' +
            '<p>' + n.body + '</p>' +
            (n.test ? '<p><span class="gg4-lbl">🧪 اختبر هذا:</span> ' + n.test + '</p>' : '') +
          '</div>';
        }).join('') : '<div class="gg4-card"><p>لا جديد مسجَّل لهذه الصفحة.</p></div>';
      }
    }
    paint('');
    wrap.querySelector('.gg4-search').addEventListener('input', function (e) { paint(e.target.value); });

    wrap.addEventListener('click', function (e) {
      var t = e.target.closest('[data-t],[data-a],[data-show]');
      if (!t) return;
      if (t.dataset.show) { var sel = decodeURIComponent(t.dataset.show); wrap.remove(); highlight(sel); return; }
      if (t.dataset.a === 'close') { wrap.remove(); return; }
      var k = t.dataset.t;
      if (k === 'tour') { wrap.remove(); start(true); return; }
      if (k === 'train') {
        if (window.GMTSandbox && !GMTSandbox.active) { wrap.remove(); GMTSandbox.enter(); }
        else if (window.GMTSandbox) alert('أنت بالوضع التدريبي فعلاً. للخروج استعمل «✖ خروج ومسح» بالشريط البرتقالي.');
        else alert('الوضع التدريبي غير محمّل بهذه الصفحة (gmt-sandbox.js).');
        return;
      }
      cur = k;
      Array.prototype.forEach.call(wrap.querySelectorAll('.gg4-tab[data-t]'), function (x) {
        x.classList.toggle('on', x.dataset.t === k);
      });
      paint(wrap.querySelector('.gg4-search').value);
    });
  }

  function highlight(sel) {
    var el = null;
    try { el = document.querySelector(sel); } catch (e) {}
    if (!el) { alert('⚠️ لم أجد هذا الزر بالشاشة الحالية — قد يكون داخل نافذة أو تبويب آخر. افتحه ثم أعد المحاولة.'); return; }
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('gg4-hl');
    setTimeout(function () { el.classList.remove('gg4-hl'); }, 3600);
    if (window.GMTInspect && GMTInspect.step) GMTInspect.step('👆', 'أرِني: ' + sel);
  }

  function fab() {
    if (document.querySelector('.gg4-fab')) return;
    var b = document.createElement('button');
    b.className = 'gg4-fab';
    b.title = 'النظام التعليمي';
    b.textContent = '🎓';
    b.onclick = function () { index(); };
    document.body.appendChild(b);
  }

  /* ═══════════ التغطية الحيّة (2026-07-13) ═══════════
     المشكلة: الدليل كان يوثّق ما كتبناه يدوياً فقط. أي زر جديد يُضاف للصفحة
     يبقى **غير موثّق بصمت** ⇒ الدليل يتقادم ولا أحد يدري.
     الحل: عند كل فتح، نمسح **كل زر حقيقي بالصفحة**، ندمجه مع المواصفة اليدوية،
     ونُظهر غير الموثّق بوضوح (🚨) مع نسبة تغطية. والمفتّش يُبلّغ القاعدة عن
     أي زر غير موثّق **يُضغط فعلاً** ⇒ الدليل ينمو من الاستعمال الحقيقي. */

  var DISCOVERED = [];

  function norm(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  function selectorOf(el) {
    if (el.id) return '#' + el.id;
    var oc = el.getAttribute('onclick');
    if (oc) {
      var m = oc.match(/^\s*([\w$]+)\s*\(/);
      if (m) return '[onclick^="' + m[1] + '("]';
    }
    return null;
  }

  function scanLive() {
    var out = [], seen = {};
    Array.prototype.forEach.call(
      document.querySelectorAll('button,[role=button],a[onclick]'),
      function (el) {
        if (el.closest('.gg4,.gg4-idx,#gmt-inspect-panel,#gmt-bug-panel,#gmt-health-panel')) return;
        var t = norm(el.textContent).slice(0, 44);
        var oc = el.getAttribute('onclick') || '';
        var fn = (oc.match(/^\s*([\w$]+)\s*\(/) || [])[1] || '';
        var key = t || fn;
        if (!key || key.length < 2 || seen[key]) return;
        // تجاهل أزرار الإغلاق/التنقّل العامة — ليست ميزات
        if (/^(✕|×|✖|x|إغلاق|رجوع|إلغاء|تم|موافق|<|>|→|←)$/i.test(t)) return;
        seen[key] = 1;
        out.push({ label: t || fn, fn: fn, sel: selectorOf(el) });
      }
    );
    return out;
  }

  function coverage() {
    var doc = (SPEC.buttons || []).map(function (b) { return norm(b.label); });
    var live = DISCOVERED;
    var undoc = live.filter(function (l) {
      return !doc.some(function (d) {
        return d === norm(l.label) || d.indexOf(norm(l.label)) > -1 || norm(l.label).indexOf(d) > -1;
      });
    });
    return {
      documented: doc.length,
      live: live.length,
      undocumented: undoc,
      pct: live.length ? Math.round(((live.length - undoc.length) / live.length) * 100) : 100
    };
  }

  function autoScan() {
    DISCOVERED = scanLive();
    var cov = coverage();

    // أبلِغ المفتّش — كي تصل الإدارة قائمة ما ينقص التوثيق (تحديث مستمر)
    if (window.GMTInspect && GMTInspect.step && cov.undocumented.length) {
      GMTInspect.step('📋', 'تغطية التوثيق ' + cov.pct + '% — ' + cov.undocumented.length + ' زر غير موثّق', {
        page: SPEC.page,
        missing: cov.undocumented.slice(0, 40).map(function (u) { return u.label; })
      });
    }

    // إن لم توجد مواصفة يدوية إطلاقاً — ابنِ واحدة من المسح
    if (!SPEC.buttons || !SPEC.buttons.length) {
      SPEC.buttons = DISCOVERED.map(function (b) {
        return {
          icon: '🚨', label: b.label, sel: b.sel,
          what: 'لم يُوثَّق بعد.',
          warn: 'هذا الزر مكتشَف آلياً ولم يُكتب له شرح. أبلغ الإدارة ليُضاف — لا تستعمله على بيانات حقيقية قبل أن تفهم أثره.'
        };
      });
    }
  }

  /* بطاقات الأزرار غير الموثّقة — تُعرض بذيل تبويب «الأزرار» */
  function undocCards() {
    var cov = coverage();
    if (!cov.undocumented.length) return '';
    return '<div class="gg4-card" style="grid-column:1/-1;border-color:rgba(192,0,18,.5);background:rgba(192,0,18,.09)">' +
      '<h4>🚨 ' + cov.undocumented.length + ' زر بهذه الصفحة غير موثّق</h4>' +
      '<p>التغطية الحالية: <b>' + cov.pct + '%</b> (' + (cov.live - cov.undocumented.length) + ' من ' + cov.live + ').</p>' +
      '<p><span class="gg4-lbl">ماذا تفعل:</span> لا تستعمل هذه الأزرار على بيانات حقيقية قبل أن تفهم أثرها. ' +
      'جرّبها بـ<b>الوضع التدريبي</b> (لا حفظ · لا خصم مخزون)، أو أبلغ الإدارة لتُضاف للدليل.</p>' +
      '<p style="color:#8b93a7;font-size:11.5px;line-height:2">' +
        cov.undocumented.slice(0, 30).map(function (u) { return '• ' + u.label; }).join('<br>') +
        (cov.undocumented.length > 30 ? '<br>…و' + (cov.undocumented.length - 30) + ' غيرها' : '') +
      '</p></div>';
  }

  /* ═══════════ 7) الواجهة العامة ═══════════ */
  window.GMTGuide = {
    version: VERSION,
    init: function (spec, opt) {
      SPEC = spec || {};
      opt = opt || {};
      if (!SPEC.page) SPEC.page = document.title || 'الصفحة';
      if (!SPEC.logo) SPEC.logo = 'logo.jpg';
      styles();
      var mount = function () {
        autoScan();
        fab();
        var seen = false;
        try { seen = !!localStorage.getItem(LS('seen')); } catch (e) {}
        var forced = /[?&]guide=1/.test(location.search);
        if (forced || (!seen && opt.splash !== false)) start(!!forced);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
      else mount();
    },
    open: function () { index(); },
    index: function (t) { index(t); },        /* توافق: gmt-scenarios / gmt-training ينادونها */
    start: function () { start(true); },      /* توافق: gmt-welcome / gmt-tour ينادونها */
    tour: function () { start(true); },
    show: highlight,
    coverage: coverage,                        /* تغطية التوثيق الحيّة */
    reset: function () { try { localStorage.removeItem(LS('seen')); } catch (e) {} start(true); },
    spec: function () { return SPEC; }
  };

  /* ═══════════ 8) قتل الجولة القديمة (TOUR-1 · ADM-1) ═══════════ */
  window.GMTTour = function () { return { start: function () {}, restart: function () {} }; };
  window.restartTour = function () { index(); };
  window.startTour = function () { start(true); };
  window._gmtTour = { start: function () { start(true); }, restart: function () { start(true); } };

  /* ═══════════ 9) إقلاع تلقائي ═══════════ */
  (function boot() {
    function go() {
      if (window.GMTGuide._booted) return;
      window.GMTGuide._booted = true;
      var key = Object.keys(window).filter(function (k) { return k.indexOf('GMT_GUIDE_') === 0; })[0];
      window.GMTGuide.init(key ? window[key] : {}, { splash: !!key });
    }
    if (document.readyState === 'complete') setTimeout(go, 400);
    else window.addEventListener('load', function () { setTimeout(go, 400); });
  }());
}());
