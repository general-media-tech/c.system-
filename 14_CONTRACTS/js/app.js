/* ═══════════════════════════════════════════════════════
   أداة العقود — GMT | js/app.js (المحرّك)
   ─ سجل قوالب قابل للتوسع: أي ملف عقد جديد يستدعي GMTContracts.register(...)
   ─ دخول gmt_users (نفس نمط الكفالة) + تجاوز سيادي ?sovereign=1
   ─ ترقيم من سجل العقود (قاعدة الكفالة) مع رقم محلي احتياطي
   ─ تعبئة تلقائية من الكفالة أو يدوية · تحرير حر قبل الطباعة · طباعة · تصدير Word
   ═══════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const APP_VERSION = 'contracts-v2.0 (2026-07-12)';

  /* ══ قواعد البيانات ══ */
  const DB = {
    main: { // gmt_users لتسجيل الدخول
      url: 'https://ysawzwtmodkqqbqoiojj.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYXd6d3Rtb2RrcXFicW9pb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI0OTUsImV4cCI6MjA5MjAzODQ5NX0.g-dBDpHzMsP_0IQAKFxzWkKzc_I13bGUMeYNgcUmrKQ',
    },
    warranty: { // جلب الكفالة + جدول سجل العقود contracts
      url: 'https://abppuwylukzpqckazegk.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFicHB1d3lsdWt6cHFja2F6ZWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTQ4NzYsImV4cCI6MjA5ODczMDg3Nn0.Dx6WCUfXD4T8D_tJclB9VuMUS3B0YSwejexrRrYhnqo',
    },
  };

  async function rest(db, method, path, body, extra) {
    const r = await fetch(db.url + '/rest/v1/' + path, {
      method,
      headers: { apikey: db.key, Authorization: 'Bearer ' + db.key, 'Content-Type': 'application/json', ...(extra || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0, 120) : '')); }
    if (r.status === 204) return null;
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  /* ══ سجل القوالب (نقطة التوسع) ══ */
  const registry = [];
  global.GMTContracts = {
    register(t) { registry.push(t); },
    get types() { return registry; },
  };

  /* ══ أدوات ══ */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => (d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' }) : '____ / ____ / ______');
  function toast(msg, err) {
    let t = $('gct-toast');
    if (!t) { t = document.createElement('div'); t.id = 'gct-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:20px;right:50%;transform:translateX(50%);z-index:99999;background:${err ? '#dc2626' : '#111'};color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:800;font-family:inherit;box-shadow:0 8px 28px rgba(0,0,0,.35);max-width:92vw;`;
    clearTimeout(t._h); t._h = setTimeout(() => t.remove(), err ? 5200 : 2600);
  }
  // يختار أول قيمة موجودة من مرشحين (تعامل دفاعي مع أسماء الأعمدة)
  const pick = (row, keys) => { for (const k of keys) { if (row && row[k] != null && row[k] !== '') return row[k]; } return ''; };

  /* ══ الحالة ══ */
  const state = {
    user: null,          // {username, display_name}
    type: null,          // قالب العقد الحالي
    data: {},            // قيم الحقول
    contractNo: null,    // بعد الاعتماد
    barcode: null,       // dataURL
    manualEdit: false,   // وضع التحرير الحر (يجمّد إعادة الرسم)
    registered: false,
  };

  /* ══════════ الدخول (نفس نمط الكفالة: gmt_users) ══════════ */
  const b64Variants = (p) => { const out = [p]; try { out.push(btoa(p)); } catch (_) {} try { out.push(btoa(unescape(encodeURIComponent(p)))); } catch (_) {} return out; };

  async function doLogin() {
    const u = $('lg-user').value.trim(), p = $('lg-pass').value;
    const err = $('login-err');
    err.style.display = 'none';
    if (!u || !p) { err.textContent = 'أدخل اسم المستخدم وكلمة المرور'; err.style.display = 'block'; return; }
    try {
      const rows = await rest(DB.main, 'GET', `gmt_users?username=eq.${encodeURIComponent(u)}&select=username,display_name,password_hash,is_active,branch_key`);
      const user = (rows || [])[0];
      const ok = user && user.is_active !== false && b64Variants(p).includes(user.password_hash);
      if (!ok) { err.textContent = 'بيانات الدخول غير صحيحة أو الحساب موقوف'; err.style.display = 'block'; return; }
      state.user = { username: user.username, display_name: user.display_name || user.username, branch: user.branch_key || '' };
      afterLogin();
    } catch (e) { err.textContent = 'تعذّر الاتصال: ' + e.message; err.style.display = 'block'; }
  }

  function afterLogin() {
    $('login-screen').style.display = 'none';
    $('who').textContent = '👤 ' + state.user.display_name;
    buildHome();
  }

  /* ══════════ الرئيسية: بطاقات الأنواع ══════════ */
  function buildHome() {
    const g = $('type-grid');
    g.innerHTML = registry.map((t, i) => `
      <div class="type-card" data-i="${i}">
        <div class="ic">${t.icon}</div>
        <div class="tt">${esc(t.title)}</div>
        <div class="dd">${esc(t.desc)}</div>
      </div>`).join('');
    g.querySelectorAll('.type-card').forEach((c) => c.addEventListener('click', () => openType(registry[+c.dataset.i])));
    $('home').style.display = 'block';
    $('work').classList.remove('on');
  }

  /* ══════════ فتح نوع عقد: بناء النموذج ══════════ */
  function openType(t) {
    state.type = t;
    state.data = {};
    state.contractNo = null; state.barcode = null; state.registered = false; state.manualEdit = false;
    // القيم الافتراضية
    (t.fields || []).forEach((f) => { state.data[f.key] = f.def != null ? f.def : (f.type === 'date' ? today() : ''); });

    $('form-title').innerHTML = `${t.icon} ${esc(t.title)}`;
    $('form-sub').textContent = t.desc;

    // صندوق التعبئة التلقائية من الكفالة (للأنواع الداعمة)
    $('autofill-wrap').innerHTML = t.warrantyAutofill ? `
      <div class="autofill-box">
        <label class="f-label">⚡ تعبئة تلقائية من الكفالة</label>
        <div class="f-row">
          <div><input class="f-in" id="af-wid" placeholder="رقم الكفالة (الباركود)" style="direction:ltr;text-align:center;"></div>
          <div style="flex:0 0 auto;"><button class="btn btn-red btn-sm" id="af-go" style="width:auto;">جلب</button></div>
        </div>
        <div style="font-size:10px;color:#0369a1;margin-top:4px;font-weight:700;">يملأ الاسم والمنتج والسيريال والفاتورة والباقة تلقائياً — ويمكن تعديل أي حقل يدوياً.</div>
      </div>` : '';
    if (t.warrantyAutofill) $('af-go').addEventListener('click', autoFillFromWarranty);

    // بناء الحقول
    const fw = $('fields-wrap');
    fw.innerHTML = (t.fields || []).map((f) => {
      const v = esc(state.data[f.key]);
      if (f.type === 'select') {
        return `<label class="f-label">${esc(f.label)}${f.req ? ' *' : ''}</label>
          <select class="f-sel" data-k="${f.key}">${f.options.map((o) => `<option value="${esc(o.v)}" ${o.v === state.data[f.key] ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
      }
      if (f.type === 'textarea') return `<label class="f-label">${esc(f.label)}</label><textarea class="f-ta" data-k="${f.key}">${v}</textarea>`;
      return `<label class="f-label">${esc(f.label)}${f.req ? ' *' : ''}</label>
        <input class="f-in" type="${f.type || 'text'}" data-k="${f.key}" value="${v}" ${f.ltr ? 'style="direction:ltr;text-align:center;"' : ''} placeholder="${esc(f.ph || '')}">`;
    }).join('');
    fw.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => {
      state.data[el.dataset.k] = el.value;
      if (!state.manualEdit) renderPreview();
    }));

    // نسخ الطباعة
    $('copies-wrap').innerHTML = (t.copies || [{ id: 'company', label: 'نسخة الشركة (كاملة)', on: true }])
      .map((c) => `<label><input type="checkbox" data-copy="${c.id}" ${c.on ? 'checked' : ''}> ${esc(c.label)}</label>`).join('');
    $('copies-wrap').querySelectorAll('input').forEach((el) => el.addEventListener('change', () => { if (!state.manualEdit) renderPreview(); }));

    $('home').style.display = 'none';
    $('work').classList.add('on');
    updateNoChip();
    renderPreview();
    window.scrollTo(0, 0);
  }

  function selectedCopies() {
    return Array.from(document.querySelectorAll('#copies-wrap input:checked')).map((el) => el.dataset.copy);
  }

  /* ══════════ التعبئة التلقائية من الكفالة ══════════ */
  async function autoFillFromWarranty() {
    const wid = $('af-wid').value.trim();
    if (!wid) return toast('أدخل رقم الكفالة أولاً', true);
    try {
      toast('جارٍ الجلب...');
      const rows = await rest(DB.warranty, 'GET', `warranties?short_id=eq.${encodeURIComponent(wid)}&select=*`);
      const w = (rows || [])[0];
      if (!w) return toast('لا توجد كفالة بهذا الرقم', true);
      // خرائط دفاعية لأسماء الأعمدة المحتملة
      const map = {
        customerName: pick(w, ['customer_name', 'name', 'client_name', 'c']),
        customerPhone: pick(w, ['customer_phone', 'phone', 'mobile']),
        birthDate: String(pick(w, ['birth_date', 'birthdate']) || '').slice(0, 10),
        productName: pick(w, ['product_name', 'product', 'device', 'p']),
        serialNo: pick(w, ['serial_no', 'serial', 'imei', 's']),
        invoiceNo: pick(w, ['invoice_no', 'invoice', 'inv']),
        invoiceDate: String(pick(w, ['purchase_date', 'invoice_date', 'created_at']) || '').slice(0, 10),
        warrantyId: pick(w, ['short_id']),
        warrantyTier: pick(w, ['warranty_type', 'type', 't']) || state.data.warrantyTier,
        branchName: pick(w, ['created_by', 'branch', 'branch_key']),
      };
      Object.entries(map).forEach(([k, v]) => { if (v && k in state.data) state.data[k] = v; });
      // انعكاس بالنموذج
      document.querySelectorAll('#fields-wrap [data-k]').forEach((el) => { if (el.dataset.k in map && map[el.dataset.k]) el.value = map[el.dataset.k]; });
      if (!state.manualEdit) renderPreview();
      toast('✓ عُبّئت البيانات من الكفالة ' + wid);
    } catch (e) { toast('فشل الجلب: ' + e.message, true); }
  }

  /* ══════════ الترقيم من السجل (قاعدة الكفالة) ══════════ */
  async function ensureNumber() {
    if (state.contractNo) return state.contractNo;
    const t = state.type;
    const partyKey = t.partyField || 'customerName';
    try {
      const ins = (await rest(DB.warranty, 'POST', 'contracts', {
        contract_type: t.id,
        party_name: state.data[partyKey] || null,
        warranty_short_id: state.data.warrantyId || null,
        details: state.data,
        created_by: state.user ? state.user.display_name : null,
      }, { Prefer: 'return=representation' }))?.[0];
      if (!ins || ins.id == null) throw new Error('لم يُرجَع السجل');
      state.contractNo = 'GMT-C-' + String(ins.id).padStart(5, '0');
      await rest(DB.warranty, 'PATCH', `contracts?id=eq.${ins.id}`, { contract_no: state.contractNo });
      state.registered = true;
    } catch (e) {
      // رقم محلي احتياطي إن تعذّر السجل (يُعلَّم بحرف L)
      state.contractNo = 'GMT-C-L' + Date.now().toString().slice(-8);
      state.registered = false;
      toast('⚠️ تعذّر تسجيل العقد بالسجل (' + e.message.slice(0, 60) + ') — أُصدر رقم محلي', true);
    }
    makeBarcode(state.contractNo);
    updateNoChip();
    return state.contractNo;
  }

  function makeBarcode(text) {
    try {
      const cv = document.createElement('canvas');
      global.JsBarcode(cv, text, { format: 'CODE128', width: 1.6, height: 34, displayValue: true, fontSize: 11, margin: 4 });
      state.barcode = cv.toDataURL('image/png');
    } catch (_) { state.barcode = null; }
  }

  function updateNoChip() {
    $('contract-no-chip').innerHTML = state.contractNo
      ? `رقم العقد: <b>${esc(state.contractNo)}</b>${state.registered ? ' · مسجّل بالسجل ✓' : ' · <span style="color:#b45309;">غير مسجّل (محلي)</span>'}`
      : 'رقم العقد يُولَّد عند الاعتماد/الطباعة';
  }

  /* ══════════ المعاينة ══════════ */
  function renderPreview() {
    const t = state.type; if (!t) return;
    const d = { ...state.data, __no: state.contractNo || '(يُولَّد عند الاعتماد)', __barcode: state.barcode, __date: fmtDate(today()), __user: state.user ? state.user.display_name : '' };
    const copies = selectedCopies();
    let html = '';
    copies.forEach((c) => { html += t.render(d, c, { esc, fmtDate }); });
    $('paper').innerHTML = html || '<div style="text-align:center;color:#999;padding:40px;font-weight:800;">اختر نسخة واحدة على الأقل للطباعة</div>';
    applyEditMode();
  }

  /* ══════════ التحرير الحر ══════════ */
  function toggleEdit() {
    state.manualEdit = !state.manualEdit;
    $('edit-hint').classList.toggle('on', state.manualEdit);
    $('btn-edit').textContent = state.manualEdit ? '🔒 إنهاء التحرير' : '🔓 تحرير النص';
    if (!state.manualEdit) toast('انتهى وضع التحرير — تعديلاتك محفوظة بالمعاينة وستُطبع كما هي');
    applyEditMode();
  }
  function applyEditMode() {
    document.querySelectorAll('#paper .sheet').forEach((s) => {
      s.contentEditable = state.manualEdit ? 'true' : 'false';
      s.style.outline = state.manualEdit ? '2px dashed #f59e0b' : 'none';
    });
  }

  /* ══════════ الاعتماد والطباعة والتصدير ══════════ */
  function validate() {
    const missing = (state.type.fields || []).filter((f) => f.req && !String(state.data[f.key] || '').trim());
    if (missing.length) { toast('حقول مطلوبة ناقصة: ' + missing.map((f) => f.label).join('، '), true); return false; }
    return true;
  }

  async function approveAnd(action) {
    if (!state.manualEdit && !validate()) return;
    const had = !!state.contractNo;
    await ensureNumber();
    if (!had && !state.manualEdit) renderPreview(); // إدراج الرقم والباركود بالمعاينة
    if (had && !state.manualEdit) renderPreview();
    // بوضع التحرير اليدوي: نحقن الرقم مكان العبارة المؤقتة دون هدم تعديلاته
    if (state.manualEdit) {
      document.querySelectorAll('#paper .sheet').forEach((s) => {
        s.innerHTML = s.innerHTML.split('(يُولَّد عند الاعتماد)').join(esc(state.contractNo));
      });
    }
    archiveSnapshot(); // 📌 أرشفة النص المطبوع فعلاً (دليل الشركة عند النزاع)
    if (action === 'print') setTimeout(() => window.print(), 120);
    if (action === 'word') exportWord();
  }

  /* ══ أرشفة نسخة النص المعتمد (إصدار 2) ══
     يحفظ ما طُبع فعلاً — بما فيه أي تعديل يدوي — بجدول contracts.
     يتطلب تشغيل GMT_CONTRACTS_V2.txt؛ وإن لم تُشغَّل الأعمدة يفشل بصمت دون تعطيل الطباعة. */
  async function archiveSnapshot() {
    if (!state.registered || !state.contractNo) return;
    const html = ($('paper') || {}).innerHTML || '';
    try {
      await rest(DB.warranty, 'PATCH', `contracts?contract_no=eq.${encodeURIComponent(state.contractNo)}`, {
        snapshot_html: html.slice(0, 400000),
        manual_edit: !!state.manualEdit,
        printed_at: new Date().toISOString(),
        app_version: APP_VERSION,
      });
    } catch (e) { console.warn('تعذّرت أرشفة نسخة العقد:', e.message); }
  }

  function exportWord() {
    const sheets = Array.from(document.querySelectorAll('#paper .sheet'))
      .map((s) => { const c = s.cloneNode(true); c.removeAttribute('contenteditable'); c.style.outline = ''; return '<div class="sheet">' + c.innerHTML + '</div>'; })
      .join('');
    // نضمّن CSS الأداة نفسه ليحافظ Word على الشكل قدر الإمكان
    const css = Array.from(document.styleSheets).map((ss) => {
      try { return Array.from(ss.cssRules).map((r) => r.cssText).join('\n'); } catch (_) { return ''; }
    }).join('\n');
    const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>عقد ${esc(state.contractNo || '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1{ size:21cm 29.7cm; margin:1.4cm 1.3cm; mso-page-orientation:portrait; }
div.WordSection1{ page:WordSection1; }
body{ font-family:Arial,'Segoe UI',sans-serif; direction:rtl; }
.sheet{ page-break-after:always; position:relative; }
.sheet:last-child{ page-break-after:auto; }
.c-foot{ position:static; margin-top:14px; }
${css}
</style></head>
<body><div class="WordSection1" dir="rtl">${sheets}</div></body></html>`;
    const blob = new Blob(['\ufeff', doc], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `عقد_${state.type.id}_${state.contractNo || 'مسودة'}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('📄 صُدّر ملف Word (.doc) — يفتح ويتحرر بوورد بالكامل');
  }

  /* ══════════ الإقلاع ══════════ */
  document.addEventListener('DOMContentLoaded', () => {
    // أزرار عامة
    $('lg-btn').addEventListener('click', doLogin);
    $('lg-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    $('btn-back').addEventListener('click', buildHome);
    $('btn-edit').addEventListener('click', toggleEdit);
    $('btn-print').addEventListener('click', () => approveAnd('print'));
    $('btn-word').addEventListener('click', () => approveAnd('word'));
    $('btn-new').addEventListener('click', () => { if (confirm('بدء عقد جديد من نفس النوع؟ (تُمسح الحقول)')) openType(state.type); });

    // دخول سيادي: الأدمن الكلي يفتح بـ ?sovereign=1 (نفس نمط باقي الأدوات)
    if (new URLSearchParams(location.search).get('sovereign') === '1') {
      state.user = { username: 'sovereign', display_name: 'الإدارة العليا (سيادي)', branch: '' };
      afterLogin();
    }
  });
})(window);
