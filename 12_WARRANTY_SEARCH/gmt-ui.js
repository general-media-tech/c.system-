/* ═══════════════════════════════════════════════════════════════════════
   gmt-ui.js — طبقة الواجهة الموحّدة 🎨 v1 (2026-07-12)
   يُرفع بجانب كل صفحة ويُستدعى بالرأس بعد gmt-bugcatcher.js.

   يحلّ ثلاث شكاوى متكرّرة من تجربتك الفعلية:

   ① 🔗 «كل ما أضغط زر يطلب مني رابطاً ويقول: يعرض موقع general-media-tech…»
      السبب: الصفحات تخزّن روابط الأدوات بـlocalStorage، وإن كانت فارغة تنادي
      `prompt()` — وكروم يضع اسم الدومين فوق النافذة فتبدو إنذاراً خارجياً.
      الحل: **الروابط تُزرع هنا مسبقاً** (مصدر حقيقة واحد) ⇒ لا يُسأل المستخدم أبداً.
      وتُعدَّل من الإعدادات فقط، لا أثناء العمل.

   ② 💬 «رسالة تعرض موقع…» بكل تنبيه — `alert()` الأصلي.
      الحل: نافذة بهويتنا (أحمر GMT + خط Cairo) تحلّ محلّ alert وprompt.
      (confirm يبقى أصلياً لأن الكود يعتمد على جوابه الفوري — يُهاجَر لاحقاً.)

   ③ 📤 «Failed to execute share: An earlier share has not yet completed»
      السبب: نداءان لـnavigator.share قبل انتهاء الأول.
      الحل: قفل + طابور + تراجع تلقائي (نسخ للحافظة أو تنزيل الصورة).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTUI) return;

  const RED = '#C00012';

  /* ═══════════ ① روابط النظام — مصدر الحقيقة الوحيد ═══════════
     ⚠️ عدّل هنا فقط عند تغيير أسماء المجلدات المنشورة. */
  const BASE = 'https://general-media-tech.github.io/System-/';
  const LINKS = {
    pos:            BASE + '02_POS/',
    inventory:      BASE + '03_INVENTORY/',
    admin_pos:      BASE + '04_ADMIN_POS/',
    orders:         BASE + '05_ORDERS/',
    purchases:      BASE + '06_PURCHASES/',
    bridge:         BASE + '07_BRIDGE/',
    store:          BASE + '08_STORE/',
    admin_store:    BASE + '09_ADMIN_STORE/',
    warranty_create:BASE + '10_WARRANTY_CREATE/',
    warranty_admin: BASE + '11_WARRANTY_ADMIN/',
    warranty_view:  BASE + '12_WARRANTY_SEARCH/',
    contracts:      BASE + '14_CONTRACTS/',
    site:           BASE + '15_SITE/',
    tracking:       BASE + '16_TRACKING/',
    backup:         BASE + '17_BACKUP/',
  };
  /* مفاتيح localStorage التي تقرأها الصفحات ⇒ نزرعها إن كانت فارغة (لا نكسر ما ضبطه المستخدم) */
  const SEED = {
    gmt_warranty_create_url: LINKS.warranty_create,
    warranty_view_url:       LINKS.warranty_view,
    gmt_store_preview_url:   LINKS.store,
    br_store_url:            LINKS.store,
    gmt_offers_store_url:    LINKS.store,
    admin_inventory_url:     LINKS.inventory,
    br_inv_url:              LINKS.inventory,
    inv_bridge_url:          LINKS.bridge,
  };
  (function seed() {
    try {
      Object.entries(SEED).forEach(([k, v]) => {
        const cur = localStorage.getItem(k);
        if (!cur || !/^https?:\/\//.test(cur)) localStorage.setItem(k, v);
      });
    } catch (_) {}
  })();

  /* ═══════════ الأنماط ═══════════ */
  (function styles() {
    const s = document.createElement('style');
    s.textContent = `
      .gu-ov{position:fixed;inset:0;z-index:2147483100;background:rgba(6,8,12,.72);display:flex;align-items:center;
        justify-content:center;padding:18px;font-family:Cairo,system-ui,Arial,sans-serif;direction:rtl;
        animation:gu-fade .16s ease-out;}
      @keyframes gu-fade{from{opacity:0}to{opacity:1}}
      @keyframes gu-up{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
      .gu-box{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:20px 18px 16px;
        box-shadow:0 24px 60px rgba(0,0,0,.4);animation:gu-up .2s ease-out;}
      .gu-ic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
        font-size:24px;margin-bottom:10px;background:#fef2f2;color:${RED};}
      .gu-t{font-size:16px;font-weight:900;color:#111;margin-bottom:5px;}
      .gu-m{font-size:13px;font-weight:700;color:#4b5563;line-height:1.85;white-space:pre-wrap;}
      .gu-in{width:100%;margin-top:10px;padding:11px;border:1.5px solid #e5e7eb;border-radius:11px;
        font-size:13px;font-family:inherit;}
      .gu-in:focus{outline:none;border-color:${RED};}
      .gu-btns{display:flex;gap:8px;margin-top:14px;}
      .gu-b{flex:1;border:none;border-radius:12px;padding:12px;font-weight:900;font-size:13.5px;
        font-family:inherit;cursor:pointer;}
      .gu-b.p{background:${RED};color:#fff;} .gu-b.g{background:#eef0f3;color:#374151;}
      .gu-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:2147483200;
        background:#111;color:#fff;padding:11px 18px;border-radius:14px;font-size:13px;font-weight:800;
        font-family:Cairo,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:92vw;direction:rtl;}
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  function modal({ icon = 'ℹ️', title = 'تنبيه', message = '', input = null, okText = 'حسناً', cancel = false }) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'gu-ov';
      ov.innerHTML = `<div class="gu-box">
        <div class="gu-ic">${icon}</div>
        <div class="gu-t">${title}</div>
        <div class="gu-m">${String(message).replace(/</g, '&lt;')}</div>
        ${input !== null ? `<input class="gu-in" id="gu-input" value="${String(input).replace(/"/g, '&quot;')}">` : ''}
        <div class="gu-btns">
          ${cancel ? '<button class="gu-b g" data-x="0">إلغاء</button>' : ''}
          <button class="gu-b p" data-x="1">${okText}</button>
        </div></div>`;
      document.body.appendChild(ov);
      const inp = ov.querySelector('#gu-input');
      if (inp) setTimeout(() => inp.focus(), 60);
      ov.addEventListener('click', (e) => {
        const b = e.target.closest('[data-x]');
        if (!b && e.target !== ov) return;
        const ok = b && b.dataset.x === '1';
        ov.remove();
        resolve(input !== null ? (ok ? (inp ? inp.value : '') : null) : !!ok);
      });
    });
  }

  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'gu-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2800);
  }

  /* ═══════════ ② استبدال alert / prompt الأصليين ═══════════ */
  const nativeAlert = window.alert.bind(window);
  window.alert = function (m) {
    if (!document.body) return nativeAlert(m);
    const s = String(m == null ? '' : m);
    const err = /خطأ|فشل|تعذّر|تعذر|لا يمكن|❌|🚫/.test(s);
    modal({ icon: err ? '⚠️' : 'ℹ️', title: err ? 'تنبيه' : 'رسالة', message: s });
  };
  const nativePrompt = window.prompt.bind(window);
  window.prompt = function (m, def) {
    /* أي طلب رابط أثناء العمل = خطأ تصميم؛ نُبلّغ الحارس ونعيد الرابط المزروع إن وُجد */
    const s = String(m || '');
    if (/رابط|url|link/i.test(s)) {
      if (window.GMTBug) GMTBug.add('warn', 'إعداد', 'الصفحة طلبت رابطاً أثناء العمل: ' + s.slice(0, 80), 'يجب أن يُضبط مسبقاً بـgmt-ui.js (LINKS).');
      const guess = LINKS.warranty_create;
      return def || guess;
    }
    return nativePrompt(m, def);
  };

  /* ═══════════ ③ المشاركة — قفل وطابور وتراجع ═══════════ */
  let sharing = false;
  async function share(data) {
    if (sharing) { toast('⏳ هناك مشاركة جارية — انتظر ثانية'); return false; }
    sharing = true;
    try {
      if (navigator.canShare && data.files && !navigator.canShare({ files: data.files })) delete data.files;
      if (navigator.share) { await navigator.share(data); return true; }
      throw new Error('المشاركة غير مدعومة بهذا المتصفح');
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (/abort|cancel/i.test(msg)) return false;            // المستخدم ألغى — ليس خطأ
      /* تراجع: نسخ النص أو تنزيل الصورة */
      try {
        if (data.files && data.files[0]) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(data.files[0]);
          a.download = data.files[0].name || 'gmt.png';
          a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          toast('📥 تعذّرت المشاركة — نُزّلت الصورة بدلاً منها');
        } else if (data.text || data.url) {
          await navigator.clipboard.writeText([data.text, data.url].filter(Boolean).join('\n'));
          toast('📋 تعذّرت المشاركة — نُسخ النص للحافظة');
        }
      } catch (_) { toast('تعذّرت المشاركة: ' + msg.slice(0, 60)); }
      if (window.GMTBug) GMTBug.add('warn', 'مشاركة', 'فشل navigator.share: ' + msg.slice(0, 90), 'فُعّل التراجع التلقائي (نسخ/تنزيل).');
      return false;
    } finally {
      setTimeout(() => { sharing = false; }, 700);   // يمنع «مشاركة سابقة لم تنتهِ»
    }
  }
  /* نلفّ navigator.share نفسه ليستفيد كل الكود القديم بلا تعديل */
  try {
    if (navigator.share) {
      const real = navigator.share.bind(navigator);
      navigator.share = function (d) {
        if (sharing) return Promise.reject(new Error('AbortError: مشاركة جارية'));
        sharing = true;
        return real(d).finally(() => setTimeout(() => { sharing = false; }, 700));
      };
    }
  } catch (_) {}

  window.GMTUI = { modal, toast, share, LINKS, alert: window.alert, confirm: (m) => modal({ icon: '❓', title: 'تأكيد', message: m, cancel: true, okText: 'نعم' }) };
})();
