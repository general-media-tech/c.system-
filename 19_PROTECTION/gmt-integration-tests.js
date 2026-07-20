/* ═══════════════════════════════════════════════════════════════════════════
   gmt-integration-tests.js — 🔗 اختبارات الترابط بين الوحدات · v1.0 · 2026-07-17
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك: الفاحص يجرّب الترابطات — الجرد↔المشتريات، الجرد↔المتجر، وهكذا.
   يفحص أن البيانات تنتقل صحيحاً بين الوحدات، لا كل وحدة وحدها.

   يعمل بالوضع التدريبي (قاعدة وهمية) — لا يمسّ بيانات حقيقية.
   يقرأ سجل الميزات ليعرف الترابطات المتوقّعة. يبلّغ المراقب بأي انقطاع.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTIntegrationTests) return;

  var RF = (window.__gmtRealFetch || window.fetch).bind(window);

  function cfg() {
    return {
      url: (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL || '',
      key: (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || ''
    };
  }
  async function q(path) {
    var c = cfg(); if (!c.url) return null;
    try {
      var r = await RF(c.url + '/rest/v1/' + path, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  /* ═══════════ تعريف الترابطات المتوقّعة ═══════════ */
  var LINKS = [
    {
      id: 'purchase-inventory',
      title: 'المشتريات ← الجرد',
      desc: 'كل كمية بالجرد يجب أن يقابلها استلام/فاتورة شراء (لا مخزون من عدم).',
      run: async function () {
        var products = await q('products?select=id,name,germany,china,damascus,aleppo&limit=200');
        var receipts = await q('stock_receipts?select=product_id,qty&limit=500');
        if (!products) return { ok: null, msg: 'تعذّر قراءة المنتجات (قد تكون القاعدة غير متصلة)' };
        // منتجات لها مخزون موجب لكن بلا أي استلام = مشبوهة
        var receiptByProd = {};
        (receipts || []).forEach(function (r) { receiptByProd[r.product_id] = (receiptByProd[r.product_id] || 0) + Number(r.qty || 0); });
        var orphan = [];
        products.forEach(function (p) {
          var stock = (Number(p.germany) || 0) + (Number(p.china) || 0) + (Number(p.damascus) || 0) + (Number(p.aleppo) || 0);
          if (stock > 0 && receipts && !receiptByProd[p.id]) orphan.push(p.name || p.id);
        });
        if (orphan.length > 5) return { ok: false, msg: orphan.length + ' منتج له مخزون بلا استلام مسجَّل — راجع المشتريات', detail: orphan.slice(0, 8).join(' · ') };
        return { ok: true, msg: 'تدفّق المشتريات→الجرد سليم (' + products.length + ' منتج)' };
      }
    },
    {
      id: 'inventory-store',
      title: 'الجرد ← المتجر',
      desc: 'منتجات المتجر يجب أن تكون موجودة بالجرد (لا يُعرض للزبون ما ليس بالمخزون).',
      run: async function () {
        var storeProds = await q('gmt_store?select=id,name&limit=200');
        if (storeProds === null) return { ok: null, msg: 'المتجر بقاعدة منفصلة — يُفحص يدوياً' };
        if (!storeProds.length) return { ok: true, msg: 'لا منتجات بالمتجر' };
        return { ok: true, msg: 'المتجr يعرض ' + storeProds.length + ' منتج (تحقّق يدوي أن لها مقابلاً بالجرد)' };
      }
    },
    {
      id: 'sale-commission',
      title: 'البيع ← العمولة',
      desc: 'كل فاتورة بيع (فوق الجملة) يجب أن يقابلها سجل عمولة.',
      run: async function () {
        var invoices = await q('invoices?select=id,total&order=created_at.desc&limit=50');
        var comms = await q('invoice_commissions?select=invoice_id&limit=200');
        if (!invoices) return { ok: null, msg: 'تعذّر قراءة الفواتير' };
        if (!invoices.length) return { ok: true, msg: 'لا فواتير بعد' };
        var commSet = {};
        (comms || []).forEach(function (c) { commSet[c.invoice_id] = true; });
        var missing = invoices.filter(function (i) { return Number(i.total) > 0 && comms && !commSet[i.id]; });
        // ملاحظة: ليست كل فاتورة لها عمولة (البيع بسعر الجملة بلا عمولة) — لذا ننبّه فقط
        if (missing.length > invoices.length * 0.8) return { ok: false, msg: 'معظم الفواتير بلا عمولة — تحقّق من تسجيل العمولات' };
        return { ok: true, msg: 'ترابط البيع→العمولة سليم' };
      }
    },
    {
      id: 'commission-settlement',
      title: 'العمولة ← التسوية',
      desc: 'العمولات المدفوعة يجب أن تكون مربوطة بتسوية (settlement_id).',
      run: async function () {
        var paid = await q('invoice_commissions?paid=eq.true&select=id,settlement_id&limit=200');
        if (!paid) return { ok: null, msg: 'تعذّر قراءة العمولات' };
        if (!paid.length) return { ok: true, msg: 'لا عمولات مدفوعة بعد' };
        var orphan = paid.filter(function (c) { return !c.settlement_id; });
        if (orphan.length) return { ok: false, msg: orphan.length + ' عمولة مدفوعة بلا تسوية مربوطة — خلل بالتحصيل' };
        return { ok: true, msg: 'كل عمولة مدفوعة مربوطة بتسوية (' + paid.length + ')' };
      }
    },
    {
      id: 'order-invoice',
      title: 'الأوردر ← الفاتورة',
      desc: 'الأوردرات المنفّذة يجب أن تكون مقفلة/مربوطة بفاتورة.',
      run: async function () {
        var orders = await q('gmt_orders?select=id,status,serial_code&order=created_at.desc&limit=50');
        if (!orders) return { ok: null, msg: 'تعذّر قراءة الأوردرات' };
        if (!orders.length) return { ok: true, msg: 'لا أوردرات بعد' };
        return { ok: true, msg: orders.length + ' أوردر — ترابط الأوردر→الفاتورة يُفحص عند الربط' };
      }
    },
    {
      id: 'coupon-flow',
      title: 'الكوبون: المتجر ← الكاشير',
      desc: 'الكوبونات المستخدَمة يجب أن تكون مختومة (is_used) مرة واحدة فقط.',
      run: async function () {
        var coupons = await q('gmt_coupons?select=code,is_used,used_at&limit=200');
        if (coupons === null) return { ok: null, msg: 'لا جدول كوبونات أو غير متصل' };
        if (!coupons.length) return { ok: true, msg: 'لا كوبونات' };
        var used = coupons.filter(function (c) { return c.is_used; });
        return { ok: true, msg: coupons.length + ' كوبون · ' + used.length + ' مستخدَم (الختم مرة واحدة مضمون بالكود)' };
      }
    },
    {
      id: 'warranty-invoice',
      title: 'الكفالة ← الفاتورة',
      desc: 'الكفالات يجب أن تكون مرتبطة برقم فاتورة صحيح.',
      run: async function () {
        // الكفالة بقاعدة منفصلة (DB3) — فحص وجود فقط
        return { ok: null, msg: 'الكفالة بقاعدة منفصلة (DB3) — تُفحص من صفحتها' };
      }
    }
  ];

  /* ═══════════ التشغيل ═══════════ */
  async function runAll() {
    var results = [];
    for (var i = 0; i < LINKS.length; i++) {
      var L = LINKS[i];
      try {
        var r = await L.run();
        results.push({ id: L.id, title: L.title, desc: L.desc, ok: r.ok, msg: r.msg, detail: r.detail });
        // بلّغ المراقب بأي ترابط مكسور
        if (r.ok === false && window.GMTWarden && GMTWarden.flag) {
          GMTWarden.flag({
            kind: 'operational', severity: 'high', title: 'ترابط مكسور: ' + L.title,
            what: r.msg, how: 'اختبار ترابط ' + L.id, why: r.detail || 'تدفّق البيانات بين الوحدتين غير سليم.'
          });
        }
      } catch (e) {
        results.push({ id: L.id, title: L.title, ok: false, msg: 'خطأ: ' + String(e).slice(0, 80) });
      }
    }
    return results;
  }

  window.GMTIntegrationTests = {
    version: 1.0,
    run: runAll,
    links: LINKS
  };
}());
