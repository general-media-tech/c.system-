/* ═══════════════════════════════════════════════════════
   gmt-integrity.js — تدقيق الربط بين المشتريات والجرد 🔗
   (يُرفع جنب purchases_standalone.html و index_inventory.html)

   المشكلة التي يحلها (واقعة حقيقية 2026-07-11):
   فواتير أوروبية أُدخلت أكثر من مرة → حُذفت قطعها من الجرد → بقيت الفواتير
   «يتيمة»: موجودة بالمشتريات وقطعها غير موجودة بالمخزون، وترحيلها يذهب سُدى.

   القاعدة التي يفرضها:
   • كل قطعة بالجرد لها فاتورة (مستوردة أو شراء فوري، واصلة أو في الطريق).
   • كل بند فاتورة له قطعة بالجرد (وإلا فهو بند يتيم).
   • لا فاتورتان بنفس الرقم (كشف التكرار).

   ثلاث طبقات:
   ١) 🔗 لوحة التدقيق (زر عائم) — تكشف وتُصلح بضغطة.
   ٢) 🛡️ حارس الحذف (بالجرد) — يمنع حذف قطعة مرتبطة بفاتورة.
   ٣) 🚦 حارس الترحيل والتكرار (بالمشتريات).
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DB = {
    url: 'https://ysawzwtmodkqqbqoiojj.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYXd6d3Rtb2RrcXFicW9pb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI0OTUsImV4cCI6MjA5MjAzODQ5NX0.g-dBDpHzMsP_0IQAKFxzWkKzc_I13bGUMeYNgcUmrKQ',
  };
  const H = () => ({ apikey: DB.key, Authorization: 'Bearer ' + DB.key, 'Content-Type': 'application/json' });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (b) => String(b ?? '').trim().toLowerCase();

  async function rest(method, path, body, extra) {
    const r = await fetch(DB.url + '/rest/v1/' + path, {
      method, headers: { ...H(), ...(extra || {}) }, body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + (await r.text().catch(() => '')).slice(0, 120));
    if (r.status === 204) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  /* ══ استخراج بنود الفاتورة (البنية تختلف قليلاً بين الأنواع) ══ */
  function invItems(inv) {
    let raw = inv.items_snapshot;   /* INV-1: الاسم الحقيقي بالقاعدة (كان `items` ⇒ HTTP 400) */
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = []; } }
    if (!Array.isArray(raw)) raw = [];
    return raw.map((i) => ({
      name: i.name || i.product_name || '',
      barcode: i.barcode || (i.product && i.product.barcode) || '',
      qty: Number(i.qty || i.quantity || 0),
      unitPrice: Number(i.unit_price ?? i.unitPrice ?? 0),
      salePrice: Number(i.sale_price ?? i.salePrice ?? 0),
      wholePrice: Number(i.whole_price ?? i.wholePrice ?? 0),
      minPrice: Number(i.min_price ?? i.minPrice ?? 0),
      image_url: i.image_url || '',
    }));
  }

  /* ══════════ المحرّك: التدقيق ══════════ */
  const S = { invoices: [], products: [], report: null, busy: false };

  async function audit() {
    const brCols = await branchKeys().catch(() => []);
    const prodSel = ['id','name','barcode','created_at'].concat(brCols).join(',');
    const [invs, prods] = await Promise.all([
      rest('GET', 'import_log?select=*&order=created_at.desc&limit=1000'),
      rest('GET', 'products?select=' + prodSel + '&limit=5000'),
    ]);
    S.invoices = invs || [];
    S.products = prods || [];

    const byBarcode = new Map();
    S.products.forEach((p) => { const b = norm(p.barcode); if (b) byBarcode.set(b, p); });

    const invoicedBarcodes = new Set();
    const orphanItems = [];   // بنود فواتير بلا قطعة بالجرد
    const dupInvoices = [];   // فواتير برقم مكرر

    const seenNo = new Map();
    S.invoices.forEach((inv) => {
      const no = String(inv.inv_number || '').trim();
      if (no) {
        if (seenNo.has(no)) dupInvoices.push({ inv, first: seenNo.get(no) });
        else seenNo.set(no, inv);
      }
      invItems(inv).forEach((it) => {
        const b = norm(it.barcode);
        if (b) invoicedBarcodes.add(b);
        if (!b) return; // بند بلا باركود — لا يمكن ربطه (يُبلَّغ بالملخص)
        if (!byBarcode.has(b)) orphanItems.push({ inv, item: it });
      });
    });

    // قطع بالجرد بلا أي فاتورة
    const orphanProducts = S.products.filter((p) => {
      const b = norm(p.barcode);
      return !b || !invoicedBarcodes.has(b);
    });

    /* ════ INV-9 (2026-07-13) — ثلاثة فحوص جديدة ════ */
    const byId = new Map(S.products.map((p) => [String(p.id), p]));
    const isTransit = (k) => k === 'germany' || k === 'china';
    const stockCols = brCols.length ? brCols : ['germany','china','haleb'];

    // ① فواتير مختومة «مُرحَّلة» وكمياتها لم تصل فعلياً (transfer_moved أقل من المطلوب)
    const sealedNotMoved = [];
    // ② فواتير «بالطريق» لكن رصيد العبور لا يغطّيها (الكمية اختفت من مخزون العبور)
    const transitMissing = [];
    S.invoices.forEach((inv) => {
      let mv = inv.transfer_moved;
      if (typeof mv === 'string') { try { mv = JSON.parse(mv); } catch (_) { mv = {}; } }
      mv = mv || {};
      const raw = (typeof inv.items_snapshot === 'string')
        ? (() => { try { return JSON.parse(inv.items_snapshot) || []; } catch (_) { return []; } })()
        : (Array.isArray(inv.items_snapshot) ? inv.items_snapshot : []);
      if (!raw.length) return;

      if (inv.transferred) {
        const short = raw.filter((i) => Number(mv[i.id] || 0) < Number(i.qty || 0));
        if (short.length) {
          sealedNotMoved.push({
            inv,
            missing: short.map((i) => ({
              name: i.name || i.id,
              expected: Number(i.qty || 0),
              moved: Number(mv[i.id] || 0),
            })),
          });
        }
      } else if (String(inv.status || '') === 'transit') {
        const src = inv.source_branch || (inv.inv_type === 'germany' ? 'germany' : 'china');
        const gap = [];
        raw.forEach((i) => {
          const p = byId.get(String(i.id));
          if (!p) return;
          const remain = Number(i.qty || 0) - Number(mv[i.id] || 0);
          const have = Number(p[src] || 0);
          if (remain > 0 && have < remain) gap.push({ name: i.name || i.id, need: remain, have });
        });
        if (gap.length) transitMissing.push({ inv, gap });
      }
    });

    // ③ فرق مجموع الفواتير عن المخزون الفعلي (لكل قطعة)
    const expectedById = new Map();   // كم قطعة دخلت النظام حسب الفواتير
    S.invoices.forEach((inv) => {
      const raw = (typeof inv.items_snapshot === 'string')
        ? (() => { try { return JSON.parse(inv.items_snapshot) || []; } catch (_) { return []; } })()
        : (Array.isArray(inv.items_snapshot) ? inv.items_snapshot : []);
      raw.forEach((i) => {
        const k = String(i.id || '');
        if (!k) return;
        expectedById.set(k, (expectedById.get(k) || 0) + Number(i.qty || 0));
      });
    });
    const stockGaps = [];
    expectedById.forEach((expected, id) => {
      const p = byId.get(id);
      if (!p) return;
      const actual = stockCols.reduce((n, c) => n + (Number(p[c]) || 0), 0);
      const diff = actual - expected;   // موجب = زيادة غير مبرَّرة · سالب = نقص (بيع/فقد)
      if (Math.abs(diff) > 0) {
        stockGaps.push({ id, name: p.name, expected, actual, diff, transit: stockCols.filter(isTransit).reduce((n, c) => n + (Number(p[c]) || 0), 0) });
      }
    });
    // الأخطر أولاً: الزيادة غير المبرَّرة (بصمة المضاعفة PUR-1)
    stockGaps.sort((a, b) => b.diff - a.diff);

    S.report = {
      invoices: S.invoices.length,
      products: S.products.length,
      orphanItems, orphanProducts, dupInvoices,
      sealedNotMoved, transitMissing, stockGaps,          /* INV-9 */
      surplus: stockGaps.filter((g) => g.diff > 0).length, /* مؤشّر المضاعفة */
      noBarcodeItems: S.invoices.reduce((n, inv) => n + invItems(inv).filter((i) => !norm(i.barcode)).length, 0),
      at: new Date(),
    };
    return S.report;
  }

  /* ══════════ الإصلاحات ══════════ */
  // (أ) إعادة إنشاء قطعة محذوفة من بيانات فاتورتها
  async function recreateProduct(entry) {
    const it = entry.item;
    const branchCols = await branchKeys();
    const np = {
      name: it.name || 'قطعة من فاتورة ' + (entry.inv.inv_number || ''),
      barcode: it.barcode,
      price: it.salePrice || 0,
      wholesale_price: it.wholePrice || 0,
      net_cost: it.unitPrice || 0,
      image_url: it.image_url || null,
    };
    branchCols.forEach((k) => { np[k] = 0; });   // تُرحَّل الكميات بالترحيل لا هنا
    const res = await rest('POST', 'products', np, { Prefer: 'return=representation' });
    return Array.isArray(res) ? res[0] : res;
  }

  // (ب) إنشاء «فاتورة شراء فوري» لقطع يتيمة بالجرد (لتصبح كل قطعة ذات فاتورة)
  async function invoiceOrphanProducts(list) {
    const items = list.map((p) => ({
      name: p.name, barcode: p.barcode || '', qty: 0,
      unit_price: 0, sale_price: 0, whole_price: 0, min_price: 0, image_url: '',
      notes: 'أُنشئ بأداة التدقيق — قطعة كانت بالجرد بلا فاتورة',
    }));
    const entry = {
      inv_number: 'AUDIT-' + Date.now().toString().slice(-8),
      inv_type: 'شراء فوري',
      supplier: 'تسوية تدقيق (بلا مورّد)',
      status: 'arrived',
      items: JSON.stringify(items),
      notes: 'فاتورة تسوية أنشأتها أداة التدقيق لربط قطع كانت بالجرد بلا فاتورة. راجعها وعدّل بياناتها.',
      created_at: new Date().toISOString(),
    };
    return rest('POST', 'import_log', entry, { Prefer: 'return=representation' });
  }

  let _branchCache = null;
  async function branchKeys() {
    if (_branchCache) return _branchCache;
    try {
      const rows = await rest('GET', 'inv_columns?is_branch=eq.true&select=key_name');
      _branchCache = (rows || []).map((r) => r.key_name);
    } catch (_) { _branchCache = []; }
    return _branchCache;
  }

  /* ══════════ اللوحة ══════════ */
  function open() {
    let ov = document.getElementById('intg-ov');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'intg-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto;';
    ov.innerHTML = `<div style="background:#fff;border-radius:18px;max-width:780px;width:100%;margin:auto;font-family:'Cairo',sans-serif;direction:rtl;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1a1a1a,#2a1215);color:#fff;padding:14px 18px;border-bottom:3px solid #C00012;display:flex;align-items:center;gap:10px;">
        <div style="flex:1;"><div style="font-size:16px;font-weight:900;">🔗 تدقيق الفواتير والجرد</div>
        <div style="font-size:11px;color:#cbd5e1;">كل قطعة بالجرد لها فاتورة · كل بند فاتورة له قطعة · لا فواتير مكررة</div></div>
        <button onclick="document.getElementById('intg-ov').remove()" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:9px;padding:7px 12px;font-weight:800;font-family:inherit;cursor:pointer;">إغلاق</button>
      </div>
      <div id="intg-body" style="padding:18px;"><div style="text-align:center;padding:30px;color:#6b7280;font-weight:800;font-size:13px;">⏳ جارٍ الفحص…</div></div>
    </div>`;
    document.body.appendChild(ov);
    audit().then(render).catch((e) => {
      document.getElementById('intg-body').innerHTML = `<div style="color:#dc2626;font-weight:800;font-size:13px;">تعذّر الفحص: ${esc(e.message)}</div>`;
    });
  }

  function render() {
    const r = S.report;
    const body = document.getElementById('intg-body');
    if (!body) return;
    const clean = !r.orphanItems.length && !r.orphanProducts.length && !r.dupInvoices.length;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin-bottom:16px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;">${r.invoices}</div><div style="font-size:10px;color:#64748b;font-weight:700;">فاتورة</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;">${r.products}</div><div style="font-size:10px;color:#64748b;font-weight:700;">قطعة بالجرد</div></div>
        <div style="background:${r.orphanItems.length ? '#fef2f2' : '#f0fdf4'};border:1px solid ${r.orphanItems.length ? '#fecaca' : '#bbf7d0'};border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:${r.orphanItems.length ? '#dc2626' : '#16a34a'};">${r.orphanItems.length}</div>
          <div style="font-size:10px;color:#64748b;font-weight:700;">بند فاتورة يتيم</div></div>
        <div style="background:${r.orphanProducts.length ? '#fffbeb' : '#f0fdf4'};border:1px solid ${r.orphanProducts.length ? '#fde68a' : '#bbf7d0'};border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:${r.orphanProducts.length ? '#b45309' : '#16a34a'};">${r.orphanProducts.length}</div>
          <div style="font-size:10px;color:#64748b;font-weight:700;">قطعة بلا فاتورة</div></div>
        <div style="background:${r.dupInvoices.length ? '#fdf4ff' : '#f0fdf4'};border:1px solid ${r.dupInvoices.length ? '#f0abfc' : '#bbf7d0'};border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:${r.dupInvoices.length ? '#a21caf' : '#16a34a'};">${r.dupInvoices.length}</div>
          <div style="font-size:10px;color:#64748b;font-weight:700;">فاتورة مكررة</div></div>
      </div>

      ${clean ? `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:20px;text-align:center;color:#166534;font-weight:900;font-size:14px;">
        ✅ الربط سليم تماماً — كل قطعة لها فاتورة، وكل بند فاتورة له قطعة بالجرد.</div>` : ''}

      ${r.orphanItems.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:900;color:#dc2626;margin-bottom:4px;">🚨 بنود فواتير يتيمة (قطعها محذوفة من الجرد)</div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;line-height:1.8;margin-bottom:8px;">
          هذه بالضبط مشكلتك: الفاتورة موجودة والقطعة غير موجودة — فترحيلها يذهب سُدى.
          «إعادة الإنشاء» تُعيد القطعة للجرد بكميات صفر وببيانات فاتورتها، فيعمل الترحيل بشكل صحيح.
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:12px;max-height:200px;overflow:auto;">
          ${r.orphanItems.map((e, i) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid #f3f4f6;font-size:11.5px;">
            <div style="flex:1;">
              <div style="font-weight:800;">${esc(e.item.name) || '(بلا اسم)'}</div>
              <div style="color:#9ca3af;font-weight:700;font-size:10px;">فاتورة ${esc(e.inv.inv_number || '—')} · ${esc(e.inv.status === 'transit' ? '🚢 في الطريق' : '📦 واصلة')} · باركود <span dir="ltr">${esc(e.item.barcode)}</span></div>
            </div>
            <button onclick="GMTIntegrity.fixItem(${i})" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:6px 10px;font-family:inherit;font-size:10.5px;font-weight:800;cursor:pointer;white-space:nowrap;">↩︎ إعادة الإنشاء بالجرد</button>
          </div>`).join('')}
        </div>
        <button onclick="GMTIntegrity.fixAllItems()" style="width:100%;margin-top:8px;background:#dc2626;color:#fff;border:none;border-radius:10px;padding:11px;font-family:inherit;font-weight:900;font-size:12.5px;cursor:pointer;">
          ↩︎ إعادة إنشاء الكل (${r.orphanItems.length} قطعة) بالجرد
        </button>
      </div>` : ''}

      ${r.orphanProducts.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:900;color:#b45309;margin-bottom:4px;">⚠️ قطع بالجرد بلا فاتورة</div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;line-height:1.8;margin-bottom:8px;">
          قطع دخلت الجرد يدوياً أو قبل النظام. القاعدة: كل قطعة لها فاتورة —
          الزر أدناه يُنشئ لها «فاتورة تسوية (شراء فوري)» واحدة تجمعها، عدّل بياناتها لاحقاً.
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:12px;max-height:160px;overflow:auto;">
          ${r.orphanProducts.slice(0, 60).map((p) => `<div style="padding:8px 11px;border-bottom:1px solid #f3f4f6;font-size:11.5px;">
            <span style="font-weight:800;">${esc(p.name)}</span>
            <span style="color:#9ca3af;font-size:10px;font-weight:700;" dir="ltr">${esc(p.barcode) || '(بلا باركود)'}</span>
          </div>`).join('')}
          ${r.orphanProducts.length > 60 ? `<div style="padding:8px;text-align:center;color:#9ca3af;font-size:10.5px;font-weight:700;">…و${r.orphanProducts.length - 60} أخرى</div>` : ''}
        </div>
        <button onclick="GMTIntegrity.fixOrphanProducts()" style="width:100%;margin-top:8px;background:#b45309;color:#fff;border:none;border-radius:10px;padding:11px;font-family:inherit;font-weight:900;font-size:12.5px;cursor:pointer;">
          🧾 إنشاء فاتورة تسوية لها (${r.orphanProducts.length} قطعة)
        </button>
      </div>` : ''}

      ${r.dupInvoices.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:900;color:#a21caf;margin-bottom:4px;">🔁 فواتير برقم مكرر</div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:8px;">راجعها بنفسك — الحذف يدوي عمداً (قد يكون التكرار مقصوداً).</div>
        <div style="border:1px solid #e5e7eb;border-radius:12px;max-height:150px;overflow:auto;">
          ${r.dupInvoices.map((d) => `<div style="padding:9px 11px;border-bottom:1px solid #f3f4f6;font-size:11.5px;">
            <span style="font-weight:900;">${esc(d.inv.inv_number)}</span>
            <span style="color:#9ca3af;font-weight:700;font-size:10px;"> — مكررة (${esc(d.inv.supplier || '')} · ${new Date(d.inv.created_at).toLocaleDateString('ar-SY')})</span>
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${(r.stockGaps && r.stockGaps.filter((g) => g.diff > 0).length) ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:900;color:#dc2626;margin-bottom:4px;">🔴 زيادة غير مبرَّرة بالمخزون (بصمة المضاعفة)</div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:8px;">المخزون الفعلي <b>أكبر</b> من مجموع الفواتير — لا يمكن أن يزيد إلا بمضاعفة كتابة أو تعديل يدوي. راجعها فوراً.</div>
        <div style="border:1px solid #fecaca;border-radius:12px;max-height:190px;overflow:auto;">
          ${r.stockGaps.filter((g) => g.diff > 0).slice(0, 40).map((g) => `<div style="padding:9px 11px;border-bottom:1px solid #fee2e2;font-size:11.5px;display:flex;justify-content:space-between;gap:6px;">
            <span style="font-weight:800;">${esc(g.name || '')}</span>
            <span style="font-weight:900;color:#dc2626;white-space:nowrap;">+${g.diff} <span style="color:#9ca3af;font-weight:700;">(فواتير ${g.expected} · مخزون ${g.actual})</span></span>
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${(r.sealedNotMoved && r.sealedNotMoved.length) ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:900;color:#b91c1c;margin-bottom:4px;">⛔ فواتير مختومة «واصلة» وكمياتها لم تصل</div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:8px;">هذه هي الفواتير التي خُتمت كناجحة والبضاعة لم تدخل فعلياً. استخدم «🔓 فكّ ختم» بالمشتريات ثم أعد الترحيل.</div>
        <div style="border:1px solid #fecaca;border-radius:12px;max-height:190px;overflow:auto;">
          ${r.sealedNotMoved.slice(0, 30).map((d) => `<div style="padding:9px 11px;border-bottom:1px solid #fee2e2;font-size:11.5px;">
            <div style="font-weight:900;">${esc(d.inv.inv_number || '')}</div>
            ${d.missing.slice(0, 5).map((m) => `<div style="color:#6b7280;font-weight:700;font-size:10.5px;">• ${esc(m.name)} — وصل ${m.moved} من ${m.expected}</div>`).join('')}
            ${d.missing.length > 5 ? `<div style="color:#9ca3af;font-size:10px;font-weight:700;">…و${d.missing.length - 5} صنف آخر</div>` : ''}
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${(r.transitMissing && r.transitMissing.length) ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:900;color:#c2410c;margin-bottom:4px;">🟠 فواتير «بالطريق» بلا رصيد كافٍ بمخزون العبور</div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:8px;">لو رحّلتها الآن لن تصل كل القطع. عالجها قبل الترحيل.</div>
        <div style="border:1px solid #fed7aa;border-radius:12px;max-height:170px;overflow:auto;">
          ${r.transitMissing.slice(0, 30).map((d) => `<div style="padding:9px 11px;border-bottom:1px solid #ffedd5;font-size:11.5px;">
            <div style="font-weight:900;">${esc(d.inv.inv_number || '')}</div>
            ${d.gap.slice(0, 5).map((g) => `<div style="color:#6b7280;font-weight:700;font-size:10.5px;">• ${esc(g.name)} — مطلوب ${g.need} · متوفر ${g.have}</div>`).join('')}
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${r.noBarcodeItems ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:10px;font-size:11px;color:#475569;font-weight:700;line-height:1.8;">
        ℹ️ ${r.noBarcodeItems} بند فاتورة بلا باركود — لا يمكن ربطه آلياً. أضف له باركوداً بالفاتورة ليدخل التدقيق.
      </div>` : ''}

      <div style="margin-top:14px;font-size:10.5px;color:#9ca3af;font-weight:700;text-align:center;">آخر فحص: ${r.at.toLocaleString('ar-SY')}</div>`;
  }

  /* ══════════ الأوامر العامة ══════════ */
  const API = {
    open, audit,
    async fixItem(i) {
      if (S.busy) return; S.busy = true;
      const e = S.report.orphanItems[i];
      try {
        await recreateProduct(e);
        alert('✅ أُعيدت القطعة «' + (e.item.name || '') + '» للجرد (بكميات صفر) — أعد الترحيل الآن ليُضاف مخزونها.');
        await audit(); render();
      } catch (err) { alert('تعذّرت الإعادة: ' + err.message); }
      finally { S.busy = false; }
    },
    async fixAllItems() {
      const list = S.report.orphanItems;
      if (!confirm(`إعادة إنشاء ${list.length} قطعة بالجرد من بيانات فواتيرها؟\n(الكميات صفر — تُضاف عند الترحيل)`)) return;
      if (S.busy) return; S.busy = true;
      let ok = 0;
      for (const e of list) { try { await recreateProduct(e); ok++; } catch (_) {} }
      S.busy = false;
      alert(`✅ أُعيد ${ok} من ${list.length} — أعد ترحيل الشحنات لتُضاف كمياتها.`);
      await audit(); render();
    },
    async fixOrphanProducts() {
      const list = S.report.orphanProducts;
      if (!confirm(`إنشاء «فاتورة تسوية» تجمع ${list.length} قطعة ليصبح لكل قطعة فاتورة؟`)) return;
      if (S.busy) return; S.busy = true;
      try {
        await invoiceOrphanProducts(list);
        alert('✅ أُنشئت فاتورة التسوية — راجعها من قائمة الفواتير وعدّل بياناتها.');
        await audit(); render();
      } catch (err) { alert('تعذّر الإنشاء: ' + err.message); }
      finally { S.busy = false; }
    },

    /* ══ حارس الحذف (يُنادى من الجرد قبل حذف أي منتج) ══ */
    async guardDelete(productId) {
      try {
        const p = (window.allProducts || []).find((x) => String(x.id) === String(productId));
        const bc = norm(p && p.barcode);
        if (!bc) return true;   // بلا باركود — لا يمكن التحقق، نسمح
        const invs = await rest('GET', 'import_log?select=inv_number,status,items_snapshot&limit=1000'  /* INV-1 */);
        const hit = (invs || []).find((inv) => invItems(inv).some((it) => norm(it.barcode) === bc));
        if (!hit) return true;
        const where = hit.status === 'transit' ? '🚢 شحنة «في الطريق» لم تُرحَّل بعد!' : '📦 فاتورة واصلة';
        return confirm(
          `⚠️ تحذير: هذه القطعة مرتبطة بفاتورة!\n\n` +
          `الفاتورة: ${hit.inv_number || '—'}\nالحالة: ${where}\n\n` +
          `حذفها من الجرد سيجعل بند الفاتورة «يتيماً»، وترحيل الشحنة لن يجد القطعة (هذا ما حدث سابقاً).\n\n` +
          `الأفضل: صفّر كمياتها بدل حذفها، أو احذف بندها من الفاتورة أولاً.\n\n` +
          `هل تريد الحذف رغم ذلك؟`
        );
      } catch (_) { return true; }   // فشل التحقق لا يعطّل الحذف
    },

    /* ══ حارس التكرار (يُنادى من المشتريات قبل حفظ فاتورة) ══ */
    async guardDuplicateInvoice(invNumber) {
      const no = String(invNumber || '').trim();
      if (!no) return true;
      try {
        const rows = await rest('GET', `import_log?inv_number=eq.${encodeURIComponent(no)}&select=id,supplier,created_at,status`);
        if (!rows || !rows.length) return true;
        const r0 = rows[0];
        return confirm(
          `🔁 تنبيه تكرار: توجد فاتورة بنفس الرقم «${no}»!\n\n` +
          `المورّد: ${r0.supplier || '—'}\nأُدخلت: ${new Date(r0.created_at).toLocaleDateString('ar-SY')}\n` +
          `الحالة: ${r0.status === 'transit' ? 'في الطريق' : 'واصلة'}\n\n` +
          `إدخالها مرتين يُضاعف المخزون ويسبب فوضى (حدث سابقاً).\n\nهل تريد المتابعة رغم ذلك؟`
        );
      } catch (_) { return true; }
    },

    /* ══ حارس الترحيل (يُنادى قبل ترحيل شحنة للمخزون) ══ */
    async guardTransfer(inv) {
      try {
        const items = invItems(inv);
        const bcs = items.map((i) => norm(i.barcode)).filter(Boolean);
        if (!bcs.length) return true;
        const prods = await rest('GET', 'products?select=barcode&limit=5000');
        const have = new Set((prods || []).map((p) => norm(p.barcode)));
        const missing = items.filter((i) => norm(i.barcode) && !have.has(norm(i.barcode)));
        if (!missing.length) return true;
        const ok = confirm(
          `🚨 لا يمكن الترحيل بأمان!\n\n${missing.length} من قطع هذه الفاتورة غير موجودة بالجرد` +
          ` (محذوفة على الأرجح):\n${missing.slice(0, 5).map((m) => '• ' + m.name).join('\n')}` +
          `${missing.length > 5 ? `\n…و${missing.length - 5} أخرى` : ''}\n\n` +
          `الترحيل الآن لن يضيف مخزونها (ستضيع الكميات).\n\n` +
          `اضغط «موافق» لإعادة إنشائها تلقائياً الآن ثم الترحيل، أو «إلغاء» للتوقف.`
        );
        if (!ok) return false;
        for (const m of missing) { try { await recreateProduct({ inv, item: m }); } catch (_) {} }
        alert('✅ أُعيدت ' + missing.length + ' قطعة للجرد — يمكنك الترحيل الآن.');
        return true;
      } catch (_) { return true; }
    },
  };
  window.GMTIntegrity = API;

  /* ══════════ الزر العائم ══════════ */
  function mount() {
    if (document.getElementById('intg-btn')) return;
    const b = document.createElement('button');
    b.id = 'intg-btn';
    b.textContent = '🔗 تدقيق الفواتير والجرد';
    b.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:800;background:linear-gradient(135deg,#C00012,#8a000d);color:#fff;border:none;border-radius:12px;padding:11px 15px;font-family:Cairo,Arial,sans-serif;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(192,0,18,.32);';
    b.onclick = open;
    document.body.appendChild(b);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
