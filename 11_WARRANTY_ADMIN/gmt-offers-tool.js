/**
 * gmt-offers-tool.js — أداة العروض الموحّدة لنظام GMT
 * ═══════════════════════════════════════════════════════
 * أداة واحدة تُحمَّل داخل: أدمن نقاط البيع + أدمن المتجر (نفس الملف بالمكانين).
 * السجل الرئيسي: gmt_offers (القاعدة الرئيسية).
 * عند الحفظ تنشر تلقائياً حسب الأهداف المختارة:
 *   • نقاط البيع/الجرد: يقرآن gmt_offers مباشرة (بلا تغيير)
 *   • المتجر: مرآة داخل gmt_store.offers (نفس البنية التي يعرضها المتجر)
 *   • الموقع الرئيسي: بطاقة في news_cards بوسم "عرض خاص"
 *   • بث تيليغرام (تلقائي) + زر مشاركة واتساب (يدوي بضغطة)
 *
 * الأنواع: single (سعري مفرد) · bundle (باقة) · announce (إعلاني بلا سعر)
 * ملاحظة: نقطة البيع تستثني announce بفلتر offer_type=neq.announce.
 *
 * الاستخدام من الملف المضيف:
 *   <script src="gmt-offers-tool.js"></script>
 *   GMTOffersTool.mount('حاوية-الـid');
 */
(function (global) {
  'use strict';

  /* ══════════ إعدادات قواعد البيانات الثلاث ══════════ */
  const DB = {
    main: {
      url: 'https://ysawzwtmodkqqbqoiojj.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYXd6d3Rtb2RrcXFicW9pb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI0OTUsImV4cCI6MjA5MjAzODQ5NX0.g-dBDpHzMsP_0IQAKFxzWkKzc_I13bGUMeYNgcUmrKQ',
    },
    store: {
      url: 'https://tupldwylzrkjzqtaiscv.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGxkd3lsenJranpxdGFpc2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTEzNTQsImV4cCI6MjA5MTA2NzM1NH0.RKsdAg4v7TcuMhBepztJtRdTtsR-f8cMcoDXKmnZXO0',
      table: 'gmt_store',
      bucket: 'gmt-images',
    },
    site: {
      url: 'https://znpakcaizvkwqzhosxvm.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucGFrY2FpenZrd3F6aG9zeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM0NTMsImV4cCI6MjA5NTkwOTQ1M30.YW3YuT-RRTpKw5WeFHkPeTUcXBBtaQFGCaCrBQWykks',
      table: 'news_cards',
    },
  };

  /* ══════════ REST helper (بلا مكتبات) ══════════ */
  async function rest(db, method, path, body, extra) {
    const h = { apikey: db.key, Authorization: 'Bearer ' + db.key, 'Content-Type': 'application/json', ...(extra || {}) };
    const r = await fetch(db.url + '/rest/v1/' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0, 140) : '')); }
    if (r.status === 204) return null;
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  /* رفع صورة إلى Storage المتجر (نفس دلو أدمن المتجر) */
  async function uploadImage(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const path = `${base}_${Date.now()}.${ext}`;
    const r = await fetch(`${DB.store.url}/storage/v1/object/${DB.store.bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: DB.store.key, Authorization: 'Bearer ' + DB.store.key, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
      body: file,
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('رفع الصورة فشل: HTTP ' + r.status + ' ' + t.slice(0, 100)); }
    return `${DB.store.url}/storage/v1/object/public/${DB.store.bucket}/${path}`;
  }

  /* ══════════ إعدادات البث (تُسأل مرة وتُحفظ) ══════════ */
  const CFG_KEYS = { tgBot: 'gmt_offers_tg_bot', tgChat: 'gmt_offers_tg_chat', storeUrl: 'gmt_offers_store_url' };
  const cfg = {
    get tgBot() { return localStorage.getItem(CFG_KEYS.tgBot) || ''; },
    get tgChat() { return localStorage.getItem(CFG_KEYS.tgChat) || ''; },
    get storeUrl() { return localStorage.getItem(CFG_KEYS.storeUrl) || ''; },
  };

  /* ══════════ الحالة ══════════ */
  let _root = null;          // حاوية الأداة
  let _offers = [];          // صفوف gmt_offers
  let _editing = null;       // العرض قيد التحرير (null = جديد)
  let _bundleItems = [];     // عناصر الباقة بالنموذج
  let _singleProd = null;    // منتج العرض المفرد المختار
  let _images = [];          // صور النموذج الحالية

  /* ══════════ أدوات صغيرة ══════════ */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt$ = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' $');
  function toast(msg, err) {
    let t = document.getElementById('gmtof-toast');
    if (!t) { t = document.createElement('div'); t.id = 'gmtof-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:24px;right:50%;transform:translateX(50%);z-index:100000;background:${err ? '#dc2626' : '#111'};color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:700;font-family:inherit;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:90vw;`;
    clearTimeout(t._h); t._h = setTimeout(() => t.remove(), err ? 5000 : 2600);
  }
  const endOfDayISO = (d) => (d ? d + 'T23:59:59' : null);        // يحل مشكلة "منتهي" قبل نهاية اليوم
  const isExpired = (o) => !!(o.ends_at && new Date(o.ends_at) < new Date());
  function targetsOf(o) { const t = o.targets || {}; return { store: !!t.store, site: !!t.site }; }

  /* ══════════ CSS يُحقن مرة ══════════ */
  function injectCSS() {
    if (document.getElementById('gmtof-css')) return;
    const s = document.createElement('style'); s.id = 'gmtof-css';
    s.textContent = `
      .gmtof{direction:rtl;font-size:14px;color:#111;}
      .gmtof *{box-sizing:border-box;}
      .gmtof-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
      .gmtof-head h2{font-size:17px;font-weight:900;margin:0;flex:1;}
      .gmtof-btn{border:none;border-radius:10px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px;}
      .gmtof-btn.p{background:#C00012;color:#fff;} .gmtof-btn.p:hover{background:#a00010;}
      .gmtof-btn.g{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;} .gmtof-btn.g:hover{background:#e5e7eb;}
      .gmtof-empty{text-align:center;color:#9ca3af;padding:44px 10px;font-size:13px;background:#fafafa;border:1.5px dashed #e5e7eb;border-radius:14px;}
      .gmtof-card{display:flex;gap:12px;background:#fff;border:1px solid #eee;border-radius:14px;padding:12px;margin-bottom:10px;align-items:center;}
      .gmtof-thumb{width:62px;height:62px;border-radius:10px;background:#f5f5f5;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:22px;color:#d1d5db;}
      .gmtof-thumb img{width:100%;height:100%;object-fit:cover;}
      .gmtof-mid{flex:1;min-width:0;}
      .gmtof-title{font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .gmtof-chip{font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap;}
      .c-single{background:#eff6ff;color:#2563eb;} .c-bundle{background:#f5f3ff;color:#7c3aed;} .c-announce{background:#fefce8;color:#a16207;}
      .c-on{background:#f0fdf4;color:#16a34a;} .c-off{background:#f3f4f6;color:#6b7280;} .c-exp{background:#fef2f2;color:#dc2626;}
      .c-t{background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;}
      .gmtof-sub{font-size:11.5px;color:#6b7280;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;}
      .gmtof-acts{display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;}
      .gmtof-ic{width:30px;height:30px;border-radius:9px;border:none;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;}
      .ic-b{background:#eff6ff;color:#2563eb;} .ic-r{background:#fef2f2;color:#dc2626;} .ic-g{background:#f0fdf4;color:#16a34a;} .ic-y{background:#fffbeb;color:#b45309;} .ic-n{background:#f3f4f6;color:#374151;}
      .gmtof-ov{position:fixed;inset:0;z-index:99000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;}
      @media(min-width:640px){.gmtof-ov{align-items:center;padding:20px;}}
      .gmtof-modal{background:#fff;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;border-radius:20px 20px 0 0;padding:18px 16px 22px;direction:rtl;}
      @media(min-width:640px){.gmtof-modal{border-radius:20px;}}
      .gmtof-modal h3{font-size:16px;font-weight:900;margin:0 0 14px;display:flex;justify-content:space-between;align-items:center;}
      .gmtof-x{background:#f3f4f6;border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:13px;}
      .gmtof-lbl{font-size:12px;font-weight:800;color:#374151;margin:12px 0 5px;display:block;}
      .gmtof-in,.gmtof-ta{width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:inherit;}
      .gmtof-in:focus,.gmtof-ta:focus{outline:none;border-color:#C00012;}
      .gmtof-ta{min-height:74px;resize:vertical;}
      .gmtof-seg{display:flex;gap:6px;flex-wrap:wrap;}
      .gmtof-seg button{flex:1;min-width:100px;border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:9px 6px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;color:#6b7280;}
      .gmtof-seg button.on{border-color:#C00012;background:#fff5f5;color:#C00012;}
      .gmtof-row{display:flex;gap:8px;} .gmtof-row>*{flex:1;}
      .gmtof-chk{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#374151;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:8px 10px;cursor:pointer;}
      .gmtof-chk input{width:16px;height:16px;accent-color:#C00012;}
      .gmtof-thumbs{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px;}
      .gmtof-thumbs .th{position:relative;width:58px;height:58px;border-radius:9px;overflow:hidden;border:1px solid #eee;}
      .gmtof-thumbs .th img{width:100%;height:100%;object-fit:cover;}
      .gmtof-thumbs .th button{position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;font-size:9px;cursor:pointer;line-height:1;}
      .gmtof-pk{position:relative;}
      .gmtof-pk-dd{position:absolute;top:100%;right:0;left:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.14);z-index:20;max-height:230px;overflow-y:auto;display:none;}
      .gmtof-pk-dd.open{display:block;}
      .gmtof-pk-dd .it{padding:9px 12px;font-size:12.5px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #f5f5f5;}
      .gmtof-pk-dd .it:hover{background:#fafafa;}
      .gmtof-sel{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 10px;font-size:12.5px;font-weight:700;color:#166534;display:flex;justify-content:space-between;align-items:center;margin-top:7px;}
      .gmtof-bi{display:flex;justify-content:space-between;align-items:center;background:#fafafa;border:1px solid #eee;border-radius:9px;padding:7px 10px;font-size:12.5px;margin-top:6px;}
      .gmtof-note{font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.6;}
    `;
    document.head.appendChild(s);
  }

  /* ══════════ التحميل والقائمة ══════════ */
  async function loadOffers() {
    _offers = await rest(DB.main, 'GET', 'gmt_offers?select=*&order=created_at.desc&limit=300') || [];
  }

  function renderList() {
    const list = _root.querySelector('#gmtof-list');
    if (!_offers.length) { list.innerHTML = `<div class="gmtof-empty">🎁 لا توجد عروض بعد — اضغط "عرض جديد"</div>`; return; }
    list.innerHTML = _offers.map((o) => {
      const t = targetsOf(o);
      const typeChip = o.offer_type === 'bundle' ? '<span class="gmtof-chip c-bundle">باقة</span>' : o.offer_type === 'announce' ? '<span class="gmtof-chip c-announce">إعلاني</span>' : '<span class="gmtof-chip c-single">مفرد</span>';
      const stChip = isExpired(o) ? '<span class="gmtof-chip c-exp">منتهي</span>' : o.is_active ? '<span class="gmtof-chip c-on">نشط</span>' : '<span class="gmtof-chip c-off">موقوف</span>';
      const tChips = [o.offer_type !== 'announce' ? '<span class="gmtof-chip c-t">نقاط البيع</span>' : '', t.store ? '<span class="gmtof-chip c-t">المتجر</span>' : '', t.site ? '<span class="gmtof-chip c-t">الموقع</span>' : ''].join('');
      const img = (o.images && o.images[0]) || o.image_url || '';
      const priceLine = o.offer_type === 'announce' ? '' : `<span>💲 ${fmt$(o.offer_price)}${o.original_price ? ' <s style="color:#bbb;">' + fmt$(o.original_price) + '</s>' : ''}</span>`;
      return `<div class="gmtof-card">
        <div class="gmtof-thumb">${img ? `<img src="${esc(img)}" loading="lazy">` : '🎁'}</div>
        <div class="gmtof-mid">
          <div class="gmtof-title">${esc(o.name || 'عرض')} ${typeChip} ${stChip}</div>
          <div class="gmtof-sub">${priceLine}${o.ends_at ? `<span>⏳ ${new Date(o.ends_at).toLocaleDateString('ar-SY')}</span>` : '<span>بلا انتهاء</span>'}${tChips}</div>
        </div>
        <div class="gmtof-acts">
          <button class="gmtof-ic ic-n" title="بث تيليغرام" onclick="GMTOffersTool._tg(${o.id})">📣</button>
          <button class="gmtof-ic ic-g" title="مشاركة واتساب" onclick="GMTOffersTool._wa(${o.id})">🟢</button>
          <button class="gmtof-ic ic-y" title="${o.is_active ? 'إيقاف' : 'تفعيل'}" onclick="GMTOffersTool._toggle(${o.id})">${o.is_active ? '⏸' : '▶'}</button>
          <button class="gmtof-ic ic-b" title="تعديل" onclick="GMTOffersTool._edit(${o.id})">✏️</button>
          <button class="gmtof-ic ic-r" title="حذف" onclick="GMTOffersTool._del(${o.id})">🗑</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ══════════ نموذج العرض ══════════ */
  function openForm(offer) {
    _editing = offer || null;
    _bundleItems = [];
    _singleProd = null;
    _images = offer ? (Array.isArray(offer.images) && offer.images.length ? [...offer.images] : (offer.image_url ? [offer.image_url] : [])) : [];
    const type = offer?.offer_type || 'single';
    if (offer?.offer_type === 'bundle' && offer.products) {
      try { const a = typeof offer.products === 'string' ? JSON.parse(offer.products) : offer.products; _bundleItems = (a || []).map((x) => ({ id: x.id, name: x.name, qty: Number(x.qty) || 1, price: Number(x.price) || 0 })); } catch (_) {}
    }
    if (offer?.offer_type === 'single' && offer.product_id) _singleProd = { id: offer.product_id, name: offer._pname || 'المنتج المرتبط', price: offer.original_price };

    const t = offer ? targetsOf(offer) : { store: true, site: true };
    const ov = document.createElement('div'); ov.className = 'gmtof-ov'; ov.id = 'gmtof-ov';
    ov.innerHTML = `<div class="gmtof-modal">
      <h3>${offer ? 'تعديل عرض' : 'عرض جديد'} <button class="gmtof-x" onclick="GMTOffersTool._close()">✕</button></h3>

      <label class="gmtof-lbl">نوع العرض</label>
      <div class="gmtof-seg" id="gmtof-type">
        <button data-t="single" class="${type === 'single' ? 'on' : ''}">💲 سعري مفرد</button>
        <button data-t="bundle" class="${type === 'bundle' ? 'on' : ''}">🎁 باقة</button>
        <button data-t="announce" class="${type === 'announce' ? 'on' : ''}">📢 إعلاني</button>
      </div>

      <label class="gmtof-lbl">عنوان العرض *</label>
      <input class="gmtof-in" id="gmtof-name" value="${esc(offer?.name || '')}" placeholder="مثال: خصم خاص على Canon R6">

      <label class="gmtof-lbl">الوصف</label>
      <textarea class="gmtof-ta" id="gmtof-desc" placeholder="تفاصيل العرض (يظهر بالمتجر والموقع والبث)">${esc(offer?.description || '')}</textarea>

      <div id="gmtof-single-wrap">
        <label class="gmtof-lbl">المنتج المرتبط (من الجرد) *</label>
        <div class="gmtof-pk">
          <input class="gmtof-in" id="gmtof-psearch" placeholder="🔍 ابحث بالاسم أو الباركود..." autocomplete="off">
          <div class="gmtof-pk-dd" id="gmtof-pdd"></div>
        </div>
        <div id="gmtof-psel"></div>
      </div>

      <div id="gmtof-bundle-wrap" style="display:none;">
        <label class="gmtof-lbl">منتجات الباقة *</label>
        <div class="gmtof-pk">
          <input class="gmtof-in" id="gmtof-bsearch" placeholder="🔍 أضف منتجاً بالاسم أو الباركود..." autocomplete="off">
          <div class="gmtof-pk-dd" id="gmtof-bdd"></div>
        </div>
        <div id="gmtof-blist"></div>
      </div>

      <div class="gmtof-row" id="gmtof-price-row">
        <div><label class="gmtof-lbl">سعر العرض *</label><input class="gmtof-in" id="gmtof-price" type="number" min="0" step="0.01" value="${offer?.offer_price ?? ''}"></div>
        <div><label class="gmtof-lbl">السعر الأصلي</label><input class="gmtof-in" id="gmtof-oprice" type="number" min="0" step="0.01" value="${offer?.original_price ?? ''}"></div>
      </div>

      <label class="gmtof-lbl">صور العرض</label>
      <div style="display:flex;gap:7px;">
        <button class="gmtof-btn g" type="button" onclick="GMTOffersTool._pick()">📤 رفع صور</button>
        <input class="gmtof-in" id="gmtof-imgurl" placeholder="أو الصق رابط صورة واضغط Enter" style="flex:1;">
      </div>
      <div class="gmtof-thumbs" id="gmtof-thumbs"></div>
      <div class="gmtof-note">الصورة الأولى هي الرئيسية (تظهر بنقاط البيع والموقع والبث).</div>

      <label class="gmtof-lbl">تاريخ انتهاء العرض</label>
      <input class="gmtof-in" id="gmtof-ends" type="date" value="${offer?.ends_at ? String(offer.ends_at).slice(0, 10) : ''}">

      <label class="gmtof-lbl">أهداف النشر</label>
      <div class="gmtof-row" style="flex-wrap:wrap;">
        <label class="gmtof-chk" id="gmtof-pos-chip" style="opacity:.9;"><input type="checkbox" checked disabled> نقاط البيع + الجرد <span style="font-size:10px;color:#9ca3af;">(تلقائي للسعري)</span></label>
        <label class="gmtof-chk"><input type="checkbox" id="gmtof-t-store" ${t.store ? 'checked' : ''}> المتجر الإلكتروني</label>
        <label class="gmtof-chk"><input type="checkbox" id="gmtof-t-site" ${t.site ? 'checked' : ''}> الموقع الرئيسي</label>
        <label class="gmtof-chk"><input type="checkbox" id="gmtof-t-tg" ${offer ? '' : 'checked'}> 📣 بث تيليغرام عند الحفظ</label>
      </div>

      <div style="display:flex;gap:8px;margin-top:18px;">
        <button class="gmtof-btn p" style="flex:2;justify-content:center;" onclick="GMTOffersTool._save()">💾 حفظ ونشر</button>
        <button class="gmtof-btn g" style="flex:1;justify-content:center;" onclick="GMTOffersTool._close()">إلغاء</button>
      </div>
      <div class="gmtof-note" id="gmtof-status" style="margin-top:10px;"></div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) closeForm(); });

    // نوع العرض
    ov.querySelectorAll('#gmtof-type button').forEach((b) => b.addEventListener('click', () => {
      ov.querySelectorAll('#gmtof-type button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); applyType();
    }));
    // رابط صورة يدوي
    ov.querySelector('#gmtof-imgurl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { _images.push(v); e.target.value = ''; renderThumbs(); } }
    });
    // منتقيا المنتجات
    wirePicker('gmtof-psearch', 'gmtof-pdd', (p) => { _singleProd = p; renderSingleSel(); const op = ov.querySelector('#gmtof-oprice'); if (op && !op.value) op.value = p.price ?? ''; });
    wirePicker('gmtof-bsearch', 'gmtof-bdd', (p) => { if (!_bundleItems.find((x) => x.id === p.id)) { _bundleItems.push({ id: p.id, name: p.name, qty: 1, price: Number(p.price) || 0 }); renderBundle(); } });

    applyType(); renderThumbs(); renderSingleSel(); renderBundle();
  }
  function closeForm() { document.getElementById('gmtof-ov')?.remove(); _editing = null; }

  function curType() { return document.querySelector('#gmtof-type button.on')?.dataset.t || 'single'; }
  function applyType() {
    const t = curType();
    const q = (id) => document.getElementById(id);
    q('gmtof-single-wrap').style.display = t === 'single' ? '' : 'none';
    q('gmtof-bundle-wrap').style.display = t === 'bundle' ? '' : 'none';
    q('gmtof-price-row').style.display = t === 'announce' ? 'none' : '';
    q('gmtof-pos-chip').style.display = t === 'announce' ? 'none' : '';
  }

  function renderThumbs() {
    const c = document.getElementById('gmtof-thumbs'); if (!c) return;
    c.innerHTML = _images.map((u, i) => `<div class="th"><img src="${esc(u)}"><button onclick="GMTOffersTool._rmImg(${i})">✕</button>${i === 0 ? '<div style="position:absolute;bottom:0;inset-inline:0;background:rgba(192,0,18,.85);color:#fff;font-size:8px;text-align:center;font-weight:800;">رئيسية</div>' : ''}</div>`).join('');
  }
  function renderSingleSel() {
    const c = document.getElementById('gmtof-psel'); if (!c) return;
    c.innerHTML = _singleProd ? `<div class="gmtof-sel"><span>✓ ${esc(_singleProd.name)}${_singleProd.price != null ? ' — ' + fmt$(_singleProd.price) : ''}</span><button class="gmtof-x" style="width:22px;height:22px;font-size:10px;" onclick="GMTOffersTool._clrSingle()">✕</button></div>` : '';
  }
  function renderBundle() {
    const c = document.getElementById('gmtof-blist'); if (!c) return;
    c.innerHTML = _bundleItems.map((it, i) => `<div class="gmtof-bi"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">${esc(it.name)}</span>
      <span style="display:flex;align-items:center;gap:5px;">× <input type="number" min="1" value="${it.qty}" style="width:52px;border:1px solid #e5e7eb;border-radius:7px;padding:4px 6px;font-family:inherit;" onchange="GMTOffersTool._bqty(${i},this.value)">
      <button class="gmtof-x" style="width:22px;height:22px;font-size:10px;" onclick="GMTOffersTool._brm(${i})">✕</button></span></div>`).join('');
    // السعر الأصلي = مجموع مكونات الباقة (إن لم يُعدَّل يدوياً)
    const op = document.getElementById('gmtof-oprice');
    if (op && curType() === 'bundle') { const sum = _bundleItems.reduce((s, x) => s + (x.price || 0) * (x.qty || 1), 0); if (sum) op.placeholder = 'تلقائي: ' + sum; }
  }

  /* منتقي منتجات القاعدة الرئيسية */
  function wirePicker(inputId, ddId, onPick) {
    const inp = document.getElementById(inputId), dd = document.getElementById(ddId);
    if (!inp || !dd) return;
    let h;
    inp.addEventListener('input', () => {
      clearTimeout(h);
      const q = inp.value.trim();
      if (q.length < 2) { dd.classList.remove('open'); return; }
      h = setTimeout(async () => {
        try {
          const enc = encodeURIComponent(`%${q}%`);
          const rows = await rest(DB.main, 'GET', `products?select=id,name,barcode,price&or=(name.ilike.${enc},barcode.ilike.${enc})&limit=12`);
          dd.innerHTML = (rows || []).length
            ? rows.map((p) => `<div class="it" data-p='${esc(JSON.stringify({ id: String(p.id), name: p.name, price: p.price }))}'><span>${esc(p.name)}</span><span style="color:#9ca3af;font-size:11px;">${fmt$(p.price)}</span></div>`).join('')
            : '<div class="it" style="color:#9ca3af;cursor:default;">لا نتائج</div>';
          dd.classList.add('open');
          dd.querySelectorAll('.it[data-p]').forEach((el) => el.addEventListener('click', () => { onPick(JSON.parse(el.dataset.p)); dd.classList.remove('open'); inp.value = ''; }));
        } catch (e) { toast('بحث المنتجات فشل: ' + e.message, true); }
      }, 300);
    });
    document.getElementById('gmtof-ov')?.addEventListener('click', (e) => { if (!dd.contains(e.target) && e.target !== inp) dd.classList.remove('open'); });
  }

  /* ══════════ الحفظ + النشر التلقائي ══════════ */
  async function save() {
    const q = (id) => document.getElementById(id);
    const type = curType();
    const name = q('gmtof-name').value.trim();
    if (!name) return toast('عنوان العرض مطلوب', true);
    const description = q('gmtof-desc').value.trim() || null;
    const endsDate = q('gmtof-ends').value;
    const ends_at = endOfDayISO(endsDate);
    let offer_price = null, original_price = null, product_id = null, products = null;

    if (type !== 'announce') {
      offer_price = parseFloat(q('gmtof-price').value);
      if (isNaN(offer_price) || offer_price < 0) return toast('سعر العرض غير صحيح', true);
      original_price = parseFloat(q('gmtof-oprice').value); if (isNaN(original_price)) original_price = null;
    }
    if (type === 'single') {
      if (!_singleProd) return toast('اختر المنتج المرتبط بالعرض المفرد', true);
      product_id = String(_singleProd.id);
      if (original_price == null && _singleProd.price != null) original_price = Number(_singleProd.price);
    }
    if (type === 'bundle') {
      if (!_bundleItems.length) return toast('أضف منتجاً واحداً على الأقل للباقة', true);
      products = JSON.stringify(_bundleItems.map((x) => ({ id: x.id, name: x.name, qty: x.qty })));
      if (original_price == null) { const s = _bundleItems.reduce((a, x) => a + (x.price || 0) * (x.qty || 1), 0); if (s) original_price = s; }
    }
    const targets = { store: q('gmtof-t-store').checked, site: q('gmtof-t-site').checked };
    const doTG = q('gmtof-t-tg').checked;

    const row = {
      name, description, offer_type: type,
      image_url: _images[0] || null, images: _images.length ? _images : null,
      offer_price, original_price, product_id, products,
      ends_at, is_active: _editing ? _editing.is_active : true, targets,
    };

    const st = q('gmtof-status'); const setSt = (m) => { if (st) st.textContent = m; };
    try {
      setSt('حفظ السجل الرئيسي...');
      let saved;
      if (_editing) {
        saved = (await rest(DB.main, 'PATCH', `gmt_offers?id=eq.${_editing.id}`, row, { Prefer: 'return=representation' }))?.[0];
      } else {
        saved = (await rest(DB.main, 'POST', 'gmt_offers', row, { Prefer: 'return=representation' }))?.[0];
      }
      if (!saved) throw new Error('لم يُرجَع السجل');

      const report = ['نقاط البيع ✓'];
      // ── مرآة المتجر ──
      setSt('نشر على المتجر...');
      try { saved = await syncStore(saved, targets.store); report.push(targets.store ? 'المتجر ✓' : 'المتجر —'); }
      catch (e) { report.push('المتجر ✗ (' + e.message.slice(0, 60) + ')'); }
      // ── بطاقة الموقع ──
      setSt('نشر على الموقع الرئيسي...');
      try { saved = await syncSite(saved, targets.site); report.push(targets.site ? 'الموقع ✓' : 'الموقع —'); }
      catch (e) { report.push('الموقع ✗ (' + e.message.slice(0, 60) + ')'); }
      // ── بث تيليغرام ──
      if (doTG) { setSt('بث تيليغرام...'); try { await broadcastTG(saved); report.push('تيليغرام ✓'); } catch (e) { report.push('تيليغرام ✗ (' + e.message.slice(0, 60) + ')'); } }

      closeForm();
      await refresh();
      toast('💾 ' + report.join(' · '), report.some((r) => r.includes('✗')));
    } catch (e) { setSt(''); toast('فشل الحفظ: ' + e.message, true); }
  }

  /* نص وصف موحّد للأسطح الترويجية (يضيف سطر السعر وكود المنتج تلقائياً) */
  function promoDesc(o) {
    let d = o.description || '';
    if (o.offer_type !== 'announce' && o.offer_price != null) {
      d += (d ? '\n' : '') + `السعر: ${fmt$(o.offer_price)}` + (o.original_price ? ` بدل ${fmt$(o.original_price)}` : '');
    }
    return d;
  }

  /* مزامنة مرآة المتجر داخل gmt_store.offers (إضافة/تحديث/إزالة) — يعيد الصف الرئيسي محدثاً */
  async function syncStore(o, wanted) {
    const rec = (await rest(DB.store, 'GET', `${DB.store.table}?select=id,offers&id=eq.1`))?.[0];
    if (!rec) throw new Error('سجل المتجر غير موجود');
    let arr = Array.isArray(rec.offers) ? rec.offers : [];
    const mid = o.store_offer_id;
    arr = arr.filter((x) => x.id !== mid); // أزل المرآة القديمة إن وُجدت
    let newMid = null;
    if (wanted && o.is_active) {
      newMid = mid || 'off' + Date.now();
      arr.unshift({
        id: newMid,
        title: o.name,
        description: promoDesc(o) || undefined,
        end_date: o.ends_at ? String(o.ends_at).slice(0, 10) : undefined,
        images: o.images || (o.image_url ? [o.image_url] : []),
        image: (o.images && o.images[0]) || o.image_url || undefined,
        created_at: o.created_at || new Date().toISOString(),
      });
    }
    await rest(DB.store, 'PATCH', `${DB.store.table}?id=eq.1`, { offers: arr });
    if ((newMid || null) !== (mid || null)) {
      const upd = (await rest(DB.main, 'PATCH', `gmt_offers?id=eq.${o.id}`, { store_offer_id: newMid }, { Prefer: 'return=representation' }))?.[0];
      return upd || { ...o, store_offer_id: newMid };
    }
    return o;
  }

  /* مزامنة بطاقة الموقع الرئيسي في news_cards — يعيد الصف الرئيسي محدثاً */
  async function syncSite(o, wanted) {
    const nid = o.site_news_id;
    let newNid = null;
    if (wanted && o.is_active) {
      const card = {
        title_ar: o.name,
        description_ar: promoDesc(o) || null,
        tag_ar: 'عرض خاص', tag_color: '#CC0000',
        image_url: (o.images && o.images[0]) || o.image_url || null,
        link_url: cfg.storeUrl || null,
        published_at: new Date().toISOString().slice(0, 10),
      };
      if (nid) { await rest(DB.site, 'PATCH', `${DB.site.table}?id=eq.${nid}`, card); newNid = nid; }
      else { const ins = (await rest(DB.site, 'POST', DB.site.table, card, { Prefer: 'return=representation' }))?.[0]; newNid = ins?.id != null ? String(ins.id) : null; }
    } else if (nid) {
      await rest(DB.site, 'DELETE', `${DB.site.table}?id=eq.${nid}`);
    }
    if ((newNid || null) !== (nid || null)) {
      const upd = (await rest(DB.main, 'PATCH', `gmt_offers?id=eq.${o.id}`, { site_news_id: newNid }, { Prefer: 'return=representation' }))?.[0];
      return upd || { ...o, site_news_id: newNid };
    }
    return o;
  }

  /* ══════════ البث ══════════ */
  function offerText(o) {
    const lines = ['🎁 ' + o.name];
    if (o.offer_type !== 'announce' && o.offer_price != null) lines.push('💲 ' + fmt$(o.offer_price) + (o.original_price ? ' بدل ' + fmt$(o.original_price) : ''));
    if (o.description) lines.push(o.description);
    if (o.ends_at) lines.push('⏳ العرض حتى ' + new Date(o.ends_at).toLocaleDateString('ar-SY'));
    if (cfg.storeUrl) lines.push('🛒 ' + cfg.storeUrl);
    return lines.join('\n');
  }
  async function broadcastTG(o) {
    if (!cfg.tgBot || !cfg.tgChat) { openSettings(); throw new Error('أكمل إعدادات تيليغرام أولاً'); }
    const img = (o.images && o.images[0]) || o.image_url;
    const text = offerText(o);
    const base = `https://api.telegram.org/bot${cfg.tgBot}`;
    const body = img
      ? { chat_id: cfg.tgChat, photo: img, caption: text }
      : { chat_id: cfg.tgChat, text };
    const r = await fetch(base + (img ? '/sendPhoto' : '/sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.description || 'فشل الإرسال');
  }
  function shareWA(o) {
    window.open('https://wa.me/?text=' + encodeURIComponent(offerText(o)), '_blank', 'noopener');
  }

  function openSettings() {
    const bot = prompt('توكن بوت تيليغرام (للبث على القناة):', cfg.tgBot || '');
    if (bot === null) return;
    localStorage.setItem(CFG_KEYS.tgBot, bot.trim());
    const chat = prompt('معرّف القناة/المحادثة (مثل @gmt_offers أو -100xxxx):', cfg.tgChat || '');
    if (chat !== null) localStorage.setItem(CFG_KEYS.tgChat, chat.trim());
    const su = prompt('رابط المتجر المنشور (يُرفق بالبث وبطاقة الموقع):', cfg.storeUrl || 'https://general-media-tech.github.io/');
    if (su !== null) localStorage.setItem(CFG_KEYS.storeUrl, su.trim());
    toast('حُفظت إعدادات البث ✓');
  }

  /* ══════════ إجراءات القائمة ══════════ */
  async function toggle(id) {
    const o = _offers.find((x) => x.id === id); if (!o) return;
    const to = !o.is_active;
    try {
      let saved = (await rest(DB.main, 'PATCH', `gmt_offers?id=eq.${id}`, { is_active: to }, { Prefer: 'return=representation' }))?.[0] || { ...o, is_active: to };
      const t = targetsOf(saved);
      try { saved = await syncStore(saved, t.store); } catch (_) {}
      try { saved = await syncSite(saved, t.site); } catch (_) {}
      await refresh();
      toast(to ? '▶ فُعّل العرض ونُشر' : '⏸ أُوقف العرض وسُحب من الأسطح');
    } catch (e) { toast('فشل: ' + e.message, true); }
  }

  async function del(id) {
    const o = _offers.find((x) => x.id === id); if (!o) return;
    if (!confirm(`حذف العرض "${o.name}" نهائياً من كل الأسطح؟`)) return;
    try {
      try { await syncStore({ ...o, is_active: false }, false); } catch (_) {}
      try { await syncSite({ ...o, is_active: false }, false); } catch (_) {}
      await rest(DB.main, 'DELETE', `gmt_offers?id=eq.${id}`);
      await refresh();
      toast('🗑 حُذف العرض من كل الأسطح');
    } catch (e) { toast('فشل الحذف: ' + e.message, true); }
  }

  async function refresh() { try { await loadOffers(); renderList(); } catch (e) { toast('تحميل العروض فشل: ' + e.message, true); } }

  /* ══════════ التركيب ══════════ */
  async function mount(containerId) {
    injectCSS();
    _root = document.getElementById(containerId);
    if (!_root) return;
    _root.classList.add('gmtof');
    _root.innerHTML = `
      <div class="gmtof-head">
        <h2>🎁 العروض الموحّدة</h2>
        <button class="gmtof-btn g" onclick="GMTOffersTool._settings()">⚙️ إعدادات البث</button>
        <button class="gmtof-btn p" onclick="GMTOffersTool._new()">＋ عرض جديد</button>
      </div>
      <div class="gmtof-note" style="margin-bottom:10px;">أداة واحدة لكل العروض: تُنشر تلقائياً على نقاط البيع، المتجر، والموقع الرئيسي حسب اختيارك — مع بث تيليغرام ومشاركة واتساب.</div>
      <div id="gmtof-list"><div class="gmtof-empty">جارٍ التحميل...</div></div>`;
    await refresh();
  }

  /* ══════════ الواجهة العامة ══════════ */
  global.GMTOffersTool = {
    mount,
    _new: () => openForm(null),
    _edit: (id) => { const o = _offers.find((x) => x.id === id); if (o) openForm(o); },
    _del: del,
    _toggle: toggle,
    _tg: async (id) => { const o = _offers.find((x) => x.id === id); if (!o) return; try { await broadcastTG(o); toast('📣 بُثّ على تيليغرام ✓'); } catch (e) { toast('تيليغرام: ' + e.message, true); } },
    _wa: (id) => { const o = _offers.find((x) => x.id === id); if (o) shareWA(o); },
    _save: save,
    _close: closeForm,
    _settings: openSettings,
    _rmImg: (i) => { _images.splice(i, 1); renderThumbs(); },
    _clrSingle: () => { _singleProd = null; renderSingleSel(); },
    _bqty: (i, v) => { if (_bundleItems[i]) _bundleItems[i].qty = Math.max(1, parseInt(v) || 1); renderBundle(); },
    _brm: (i) => { _bundleItems.splice(i, 1); renderBundle(); },
    _pick: () => {
      let inp = document.getElementById('gmtof-file');
      if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'gmtof-file'; inp.style.display = 'none'; document.body.appendChild(inp); }
      inp.value = '';
      inp.onchange = async () => {
        const files = Array.from(inp.files || []); if (!files.length) return;
        toast('جاري رفع ' + files.length + ' صورة...');
        for (const f of files) { try { _images.push(await uploadImage(f)); renderThumbs(); } catch (e) { toast(e.message, true); } }
        toast('اكتمل الرفع ✓');
      };
      inp.click();
    },
  };
})(window);
