/* ══════════════════════════════════════════════════════════════════════
   gmt-health.js — فحص صحة القاعدة  ·  2026-07-12
   توصية المهندس المعتمدة: زر واحد بالأدمن يشغّل استعلامات تدقيق ويكشف
   التناقضات الصامتة **قبل** أن تتحوّل إلى خسارة مال.

   لماذا؟ لأن البيانات تفسد بهدوء: فاتورة بلا بنود · عمولة بلا فاتورة ·
   مخزون سالب · فاتورة مكرَّرة · طلب بلا زبون. لا شيء يصرخ — فقط الأرقام
   تصير خاطئة، وتكتشفها بعد شهر عند الجرد.

   الاستخدام: أضف <script src="gmt-health.js"></script> ثم:
       GMTHealth.open();            // يفتح اللوحة
       GMTHealth.mount('#somewhere'); // أو ضع زراً في مكان محدد

   يقرأ إعداداته من gmt-config.js (GMT_DB.MAIN). قراءة فقط — لا يكتب شيئاً.
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const DB = () => (global.GMT_DB && global.GMT_DB.MAIN) || null;

  /* كل فحص: عنوان · شرح بلغة المالك · استعلام · شدّة · ماذا تفعل */
  const CHECKS = [
    {
      id: 'inv_no_items',
      title: 'فواتير بلا بنود',
      why: 'فاتورة محفوظة ولا منتج فيها — غالباً انقطع الحفظ في المنتصف. تُحتسب بالمبيعات وهي فارغة.',
      sev: 'danger',
      fix: 'افتحها من تبويب الفواتير: إما أكملها أو احذفها.',
      path: '/rest/v1/invoices?select=id,invoice_number,branch_key,created_at,items_json&limit=500&order=created_at.desc',
      test: (rows) => rows.filter((r) => {
        try { const it = typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json;
              return !it || !it.length; } catch (_) { return true; }
      }),
      label: (r) => `فاتورة #${r.invoice_number || r.id} — ${r.branch_key || '؟'}`,
    },
    {
      id: 'comm_no_inv',
      title: 'عمولات بلا فاتورة',
      why: 'عمولة مسجَّلة على فاتورة لم تعد موجودة (حُذفت). تدفع عمولة على بيع لا وجود له.',
      sev: 'danger',
      fix: 'احذف العمولة اليتيمة، أو أعد الفاتورة إن حُذفت غلطاً.',
      path: '/rest/v1/invoice_commissions?select=id,invoice_id,amount,branch_key&limit=1000',
      needs: '/rest/v1/invoices?select=id&limit=5000',
      test: (rows, aux) => {
        const ids = new Set((aux || []).map((i) => String(i.id)));
        return rows.filter((c) => c.invoice_id && !ids.has(String(c.invoice_id)));
      },
      label: (r) => `عمولة ${Number(r.amount).toFixed(2)}$ — فاتورة مفقودة (${r.invoice_id})`,
    },
    {
      id: 'neg_stock',
      title: 'مخزون سالب',
      why: 'كمية أقل من صفر = بِعتَ قطعاً لا تملكها. إمّا الجرد غلط أو البيع تمّ مرتين.',
      sev: 'danger',
      fix: 'أعد جرد الصنف فعلياً وصحّح الكمية — ثم ابحث بسجل الحركة عن سبب النزول.',
      path: '/rest/v1/inventory?select=id,name,barcode,qty&qty=lt.0&limit=200',
      test: (rows) => rows,
      label: (r) => `${r.name || r.id} — الكمية ${r.qty}`,
    },
    {
      id: 'dup_barcode',
      title: 'باركود مكرَّر',
      why: 'نفس الباركود على صنفين. المسح يختار أحدهما عشوائياً → تخصم من الصنف الخطأ.',
      sev: 'warn',
      fix: 'وحّد الصنفين أو غيّر باركود أحدهما.',
      path: '/rest/v1/inventory?select=id,name,barcode&barcode=not.is.null&limit=5000',
      test: (rows) => {
        const seen = new Map(), dup = [];
        rows.forEach((r) => {
          const b = String(r.barcode).trim();
          if (!b) return;
          if (seen.has(b)) dup.push(r); else seen.set(b, r);
        });
        return dup;
      },
      label: (r) => `${r.name} — باركود ${r.barcode}`,
    },
    {
      id: 'dup_invoice_no',
      title: 'رقم فاتورة مكرَّر',
      why: 'رقمان متطابقان = فاتورة نزلت مرتين. تُحتسب المبيعات والعمولة مضاعفة.',
      sev: 'danger',
      fix: 'قارن البنود واحذف النسخة المكرّرة.',
      path: '/rest/v1/invoices?select=id,invoice_number,branch_key,total,created_at&limit=5000',
      test: (rows) => {
        const seen = new Map(), dup = [];
        rows.forEach((r) => {
          const k = `${r.branch_key}::${r.invoice_number}`;
          if (!r.invoice_number) return;
          if (seen.has(k)) dup.push(r); else seen.set(k, r);
        });
        return dup;
      },
      label: (r) => `#${r.invoice_number} — ${r.branch_key} — ${Number(r.total || 0).toFixed(2)}$`,
    },
    {
      id: 'comm_unapproved_old',
      title: 'عمولات مجمّدة منذ أكثر من 30 يوماً',
      why: 'عمولة لم تُوافق عليها منذ شهر — إمّا نسيتها، أو الكاشير ينتظر ماله وأنت لا تعلم.',
      sev: 'warn',
      fix: 'راجعها من تبويب الفواتير: وافق أو ارفض.',
      path: '/rest/v1/invoice_commissions?select=id,amount,branch_key,approved,created_at&approved=eq.false&limit=500',
      test: (rows) => {
        const cut = Date.now() - 30 * 864e5;
        return rows.filter((r) => r.created_at && new Date(r.created_at).getTime() < cut);
      },
      label: (r) => `${Number(r.amount).toFixed(2)}$ — ${r.branch_key} — منذ ${_days(r.created_at)} يوماً`,
    },
    {
      id: 'neg_comm',
      title: 'عمولات سالبة (بيع خاسر)',
      why: 'بيع بأقل من سعر الجملة. سلوك مسموح ومقصود — لكنه يجب أن يخضع لمتابعتك، لا أن يمرّ بصمت.',
      sev: 'info',
      fix: 'راجع كل واحدة: خصم مقصود؟ أم غلطة تسعير؟ عدّلها من بطاقة العمولة.',
      path: '/rest/v1/invoice_commissions?select=id,amount,branch_key,created_at&amount=lt.0&limit=300',
      test: (rows) => rows,
      label: (r) => `${Number(r.amount).toFixed(2)}$ — ${r.branch_key} — ${_d(r.created_at)}`,
    },
    {
      id: 'order_no_customer',
      title: 'طلبات بلا زبون أو هاتف',
      why: 'طلب بلا اسم أو رقم = لا تستطيع تسليمه ولا متابعته.',
      sev: 'warn',
      fix: 'أكمل بياناته أو احذفه.',
      path: '/rest/v1/gmt_orders?select=id,serial_code,name,phone,status&limit=1000',
      test: (rows) => rows.filter((o) => (!o.name || !String(o.name).trim()) || (!o.phone || !String(o.phone).trim())),
      label: (o) => `طلب ${o.serial_code || '#' + o.id} — ${!o.name ? 'بلا اسم' : 'بلا هاتف'}`,
    },
    {
      id: 'orders_stuck',
      title: 'طلبات عالقة منذ أكثر من 45 يوماً',
      why: 'طلب لم يتغيّر وضعه منذ شهر ونصف — إمّا نُسي، أو الزبون ينتظر ويظن أنك نصبت عليه.',
      sev: 'warn',
      fix: 'تابعه أو أغلقه.',
      path: '/rest/v1/gmt_orders?select=id,serial_code,name,status,created_at&limit=1000',
      test: (rows) => {
        const cut = Date.now() - 45 * 864e5;
        const done = ['تم التسليم', 'ملغي', 'مسلّم', 'delivered', 'cancelled'];
        return rows.filter((o) => o.created_at && new Date(o.created_at).getTime() < cut
                                 && !done.includes(String(o.status || '').trim()));
      },
      label: (o) => `${o.serial_code || '#' + o.id} — ${o.name || '؟'} — «${o.status || '؟'}» منذ ${_days(o.created_at)} يوماً`,
    },
    {
      id: 'zero_price',
      title: 'أصناف بسعر بيع صفر',
      why: 'صنف سعره صفر سيُباع مجاناً بضغطة زر — وتظهر عمولة سالبة ضخمة.',
      sev: 'danger',
      fix: 'صحّح السعر من الجرد فوراً.',
      path: '/rest/v1/inventory?select=id,name,barcode,price,qty&limit=5000',
      test: (rows) => rows.filter((r) => Number(r.price || 0) <= 0 && Number(r.qty || 0) > 0),
      label: (r) => `${r.name} — السعر ${r.price} — الكمية ${r.qty}`,
    },
    {
      id: 'price_below_cost',
      title: 'سعر البيع أقل من التكلفة',
      why: 'كل قطعة تُباع تخسر مالاً — والنظام لن يمنعك، سيسجّل الخسارة فقط.',
      sev: 'warn',
      fix: 'صحّح السعر أو أكّد أنها تصفية مقصودة.',
      path: '/rest/v1/inventory?select=id,name,price,cost,qty&limit=5000',
      test: (rows) => rows.filter((r) => Number(r.cost || 0) > 0 && Number(r.price || 0) > 0
                                        && Number(r.price) < Number(r.cost) && Number(r.qty || 0) > 0),
      label: (r) => `${r.name} — بيع ${r.price} / تكلفة ${r.cost}`,
    },
    {
      id: 'stock_no_ledger',
      title: 'سجل حركة المخزون غير مُفعَّل',
      why: 'بلا سجل الحركة لا يمكن إثبات كيف تغيّر أي رصيد. عند أول اختلاف بالجرد لن تعرف أين ضاعت القطعة.',
      sev: 'warn',
      fix: 'شغّل ملف GMT_ACCOUNTING_GUARDS.txt على القاعدة الرئيسية.',
      path: '/rest/v1/stock_moves?select=id&limit=1',
      test: (rows, _aux, failed) => (failed ? [{ id: 'x' }] : []),
      label: () => 'جدول stock_moves غير موجود — شغّل GMT_ACCOUNTING_GUARDS.txt',
    },
  ];

  const _d    = (s) => (s ? new Date(s).toLocaleDateString('ar-EG') : '—');
  const _days = (s) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 864e5) : 0);

  async function q(path) {
    const db = DB();
    if (!db) throw new Error('gmt-config.js غير محمَّل');
    const r = await fetch(db.url + path, { headers: global.GMT_DB.headers(db) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function runAll(onProgress) {
    const out = [];
    for (const c of CHECKS) {
      let rows = [], aux = null, failed = false;
      try {
        rows = await q(c.path);
        if (c.needs) aux = await q(c.needs);
      } catch (e) { failed = true; }
      let hits = [];
      try { hits = c.test(rows || [], aux, failed) || []; } catch (_) { hits = []; }
      out.push({ ...c, hits, failed });
      if (onProgress) onProgress(out.length, CHECKS.length);
    }
    return out;
  }

  /* ═══ اللوحة ═══ */
  function open() {
    let bg = document.getElementById('gmt-health-bg');
    if (bg) bg.remove();
    bg = document.createElement('div');
    bg.id = 'gmt-health-bg';
    bg.className = 'gmt-modal-bg';
    bg.innerHTML = `
      <div class="gmt-modal" style="max-width:660px;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--gmt-line,#E5E7EB);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div class="gmt-strong" style="font-size:15px;">🩺 فحص صحة القاعدة</div>
            <div class="gmt-muted" style="font-size:11px;font-weight:700;">قراءة فقط — لا يعدّل شيئاً</div>
          </div>
          <button class="gmt-btn gmt-btn--ghost" id="gh-x" style="padding:6px 11px;">✕</button>
        </div>
        <div id="gh-body" style="padding:16px;">
          <div class="gmt-empty"><div class="gmt-empty__icon">⏳</div>
            <div class="gmt-empty__title">جارٍ الفحص…</div>
            <div class="gmt-empty__text" id="gh-prog">0 / ${CHECKS.length}</div></div>
        </div>
      </div>`;
    document.body.appendChild(bg);
    bg.querySelector('#gh-x').onclick = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };

    runAll((i, n) => {
      const p = document.getElementById('gh-prog');
      if (p) p.textContent = `${i} / ${n}`;
    }).then(render).catch((e) => {
      document.getElementById('gh-body').innerHTML =
        `<div class="gmt-empty"><div class="gmt-empty__icon">⚠️</div>
         <div class="gmt-empty__title">تعذّر الفحص</div>
         <div class="gmt-empty__text">${e.message}<br>تأكد من تحميل gmt-config.js</div></div>`;
    });
  }

  function render(results) {
    const bad  = results.filter((r) => r.hits.length);
    const good = results.length - bad.length;
    const SEV  = { danger: ['🔴', 'danger'], warn: ['🟠', 'warn'], info: ['🔵', 'info'] };

    const body = document.getElementById('gh-body');
    if (!body) return;

    if (!bad.length) {
      body.innerHTML = `<div class="gmt-empty"><div class="gmt-empty__icon">✅</div>
        <div class="gmt-empty__title">القاعدة سليمة</div>
        <div class="gmt-empty__text">${results.length} فحصاً — صفر ملاحظات.</div></div>`;
      return;
    }

    bad.sort((a, b) => ({ danger: 0, warn: 1, info: 2 }[a.sev] - { danger: 0, warn: 1, info: 2 }[b.sev]));

    body.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <span class="gmt-badge gmt-badge--ok">✅ ${good} فحصاً سليماً</span>
        <span class="gmt-badge gmt-badge--danger">⚠️ ${bad.length} فيها ملاحظات</span>
      </div>
      ${bad.map((c) => {
        const [icon, cls] = SEV[c.sev] || SEV.info;
        const shown = c.hits.slice(0, 8);
        return `<div class="gmt-card gmt-card--accent" style="margin-bottom:11px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:15px;">${icon}</span>
            <span class="gmt-strong" style="font-size:13.5px;">${c.title}</span>
            <span class="gmt-badge gmt-badge--${cls}">${c.hits.length}</span>
          </div>
          <div class="gmt-muted" style="font-size:11.5px;font-weight:600;line-height:1.75;margin-bottom:8px;">${c.why}</div>
          <div style="background:var(--gmt-surface-2,#F9FAFB);border-radius:8px;padding:9px 11px;font-size:11.5px;font-weight:700;line-height:1.9;">
            ${shown.map((h) => `<div>• ${esc(c.label(h))}</div>`).join('')}
            ${c.hits.length > shown.length ? `<div class="gmt-muted">…و${c.hits.length - shown.length} غيرها</div>` : ''}
          </div>
          <div style="margin-top:8px;font-size:11.5px;font-weight:800;color:var(--gmt-red,#C00012);">🔧 ${c.fix}</div>
        </div>`;
      }).join('')}`;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ═══ زر عائم 🩺 — بموضع محسوب لا ثابت (نفس علّة زر 🎓 — انظر gmt-scenarios.js) ═══
     الأرقام الثابتة تتصادم مع أي زر عائم يُضاف لاحقاً، والأخطر أن الزر الأدنى
     z-index يُدفن تحت غيره فيصير **زراً ميتاً بصمت**. نحسب أول فتحة حرّة. ═══ */
  function freeSlot() {
    const H = 44, GAP = 10, taken = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (el.id === 'gmt-health-btn') return;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      if (r.width > 120 || r.height > 120 || !r.width) return;
      if (r.left >= 90) return;                       // الجهة اليسرى فقط
      taken.push([innerHeight - r.bottom, innerHeight - r.top]);
    });
    let y = 16;
    for (let g = 0; g < 20; g++) {
      if (!taken.some(([lo, hi]) => y < hi + GAP && y + H + GAP > lo)) return y;
      y += H + GAP;
    }
    return y;
  }

  function mount() {
    if (document.getElementById('gmt-health-btn')) return;
    const b = document.createElement('button');
    b.id = 'gmt-health-btn';
    b.textContent = '🩺';
    b.title = 'فحص صحة القاعدة';
    b.style.cssText = 'position:fixed;bottom:16px;left:14px;z-index:9600;width:44px;height:44px;'
      + 'border-radius:999px;border:1.5px solid #E5E7EB;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.14);'
      + 'font-size:19px;cursor:pointer;';
    b.onclick = open;
    document.body.appendChild(b);
    setTimeout(() => { b.style.bottom = freeSlot() + 'px'; }, 1100);   /* بعد زر 🎓 */
  }

  global.GMTHealth = { open, runAll, mount, CHECKS };
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})(window);
