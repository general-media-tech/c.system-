/* ═══════════════════════════════════════════════════════
   إقرار تسليم وإخلاء طرف | js/contracts/handover.js — إصدار 1 (2026-07-12)
   يُوقَّع عند ترك العمل أو إنهاء عقد الوكالة (م18 عقد العمل / م14 عقد الوكيل).
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const head = (d, esc) => `<div class="c-head">
    <div class="logo">General Media Tech<small>جنرال ميديا تك — إخلاء طرف</small></div>
    <div class="meta">رقم المستند: <b style="color:#C00012;">${esc(d.__no)}</b><br>تاريخ التحرير: ${esc(d.__date)}${d.__barcode ? `<img src="${d.__barcode}" alt="barcode">` : ''}</div>
  </div>`;
  const foot = (d, esc) => `<div class="c-foot">
    <span>إخلاء طرف ${esc(d.__no)} — ${esc(d.partyName || '')}</span>
    <span class="law-line">لا يُعد إبراءً من الالتزامات المستمرة (السرية · عدم المنافسة · الملكية الفكرية)</span>
    <span class="pageno">صفحة 1 من 1</span></div>`;

  const CHK = (t) => `<li><span class="chk">☐</span> ${t}</li>`;

  window.GMTContracts.register({
    id: 'handover',
    icon: '📤',
    title: 'إقرار تسليم وإخلاء طرف',
    desc: 'قائمة تسليم عند ترك العمل: العهدة · الملفات · الحسابات وكلمات المرور · حذف النسخ · التسوية المالية — مع بقاء الالتزامات المستمرة.',
    partyField: 'partyName',
    copies: [
      { id: 'company', label: 'نسخة الشركة (الأصل)', on: true },
      { id: 'client', label: 'نسخة الطرف الثاني', on: true },
    ],
    fields: [
      { key: 'companyName', label: 'الاسم القانوني للشركة', def: 'شركة جنرال ميديا تك General Media Tech', req: true },
      { key: 'companyRep', label: 'المستلِم عن الشركة', def: '' },
      { key: 'partyName', label: 'اسم الطرف الثاني الثلاثي', req: true },
      { key: 'partyId', label: 'الرقم الوطني', ltr: true },
      { key: 'partyCapacity', label: 'الصفة', type: 'select', def: 'employee', options: [
        { v: 'employee', t: 'عامل' }, { v: 'agent', t: 'وكيل بيع' },
      ] },
      { key: 'baseContractNo', label: 'رقم العقد الأساسي', ltr: true },
      { key: 'endDate', label: 'تاريخ انتهاء العلاقة', type: 'date' },
      { key: 'endReason', label: 'سبب الانتهاء', type: 'select', def: 'resign', options: [
        { v: 'resign', t: 'استقالة' }, { v: 'termination', t: 'إنهاء من الشركة' },
        { v: 'expiry', t: 'انتهاء المدة' }, { v: 'mutual', t: 'اتفاق الطرفين' },
      ] },
      { key: 'returnedItems', label: 'المسلَّم فعلاً (سطر لكل بند)', type: 'textarea', ph: 'كاميرا Canon R6 — تسلسلي 1234567\nمفتاح المحل\nبطاقة دخول' },
      { key: 'pendingItems', label: 'ما لم يُسلَّم بعد (إن وُجد)', type: 'textarea' },
      { key: 'settlement', label: 'التسوية المالية (مستحقات/مطلوبات)', type: 'textarea', ph: 'مستحقات الموظف: ______ · مطلوبات على الموظف: ______ · الصافي: ______' },
      { key: 'jurisdictionCity', label: 'مدينة الاختصاص القضائي', def: 'حلب', req: true },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],

    render(d, copy, { esc }) {
      const badge = copy === 'client' ? '<div class="c-copy client">نسخة الطرف الثاني</div>' : '<div class="c-copy">نسخة الشركة — الأصل</div>';
      const cap = d.partyCapacity === 'agent' ? 'وكيل بيع' : 'عامل';
      const reason = { resign: 'استقالة', termination: 'إنهاء من الشركة', expiry: 'انتهاء المدة', mutual: 'اتفاق الطرفين' }[d.endReason] || '';
      const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => `<li>${esc(s)}</li>`).join('') || '<li>ــــ</li>';

      return `<div class="sheet">${badge}${head(d, esc)}
        <div class="c-title">إقرار تسليم وإخلاء طرف<small>يُحرَّر عند انتهاء العلاقة التعاقدية — ملحقٌ متمّم للعقد الأساسي</small></div>
        <table class="c-data">
          <tr><td class="k">الشركة</td><td>${esc(d.companyName)} — المستلِم عنها: ${esc(d.companyRep) || '________'}</td></tr>
          <tr><td class="k">الطرف الثاني</td><td>${esc(d.partyName)} — وطني: ${esc(d.partyId) || '________'} — الصفة: ${esc(cap)}</td></tr>
          <tr><td class="k">العقد الأساسي</td><td>${esc(d.baseContractNo) || '________'}</td></tr>
          <tr><td class="k">تاريخ الانتهاء وسببه</td><td>${d.endDate ? esc(d.endDate) : '____/____/______'} — ${esc(reason)}</td></tr>
        </table>

        <div class="c-art"><h4>أولاً — قائمة التسليم (تُؤشَّر بند بند)</h4>
          <ul class="chk-list">
            ${CHK('كامل العهدة من أجهزة ومعدات وكاميرات وعدسات وحواسيب وهواتف وأقراص وبطاقات ذاكرة')}
            ${CHK('المفاتيح وبطاقات الدخول والأختام')}
            ${CHK('البضائع والأمانات وأثمان المبيعات المقبوضة (إن وُجدت)')}
            ${CHK('جميع الملفات الورقية والإلكترونية والملفات المصدرية والمشاريع')}
            ${CHK('جميع الحسابات وكلمات المرور ونقل صلاحيات الحسابات والصفحات والمنصات')}
            ${CHK('حذف كل نسخة من بيانات الشركة وملفاتها من الأجهزة الشخصية والحسابات السحابية والهاتف')}
            ${CHK('إعادة/إتلاف المواد التدريبية وقوائم العملاء والموردين والأسعار')}
          </ul></div>

        <div class="c-art"><h4>ثانياً — المسلَّم فعلاً</h4><ol>${lines(d.returnedItems)}</ol></div>
        ${d.pendingItems ? `<div class="c-art"><h4>ثالثاً — ما لم يُسلَّم بعد (يبقى بذمة الطرف الثاني)</h4><ol>${lines(d.pendingItems)}</ol></div>` : ''}
        ${d.settlement ? `<div class="c-art"><h4>رابعاً — التسوية المالية</h4><div class="c-note">${esc(d.settlement)}</div></div>` : ''}

        <div class="c-art"><h4>خامساً — الإقرارات</h4>
          <ol>
            <li>يقرّ الطرف الثاني بأنه سلّم ما هو مبيّن أعلاه، وأنه <b>لم يبقَ لديه أي نسخة</b> من ملفات الشركة أو بياناتها أو قوائم عملائها أو مورديها أو موادها التدريبية، بأي صيغة أو وسيط.</li>
            <li>يقرّ ببقاء التزاماته المستمرة نافذة بعد انتهاء العلاقة، وهي: <b>السرية</b> (بلا تحديد مدة) · <b>عدم المنافسة</b> · <b>حماية العملاء والموردين</b> · <b>الملكية الفكرية</b> · و<b>الشرط الجزائي</b> المقرر في العقد الأساسي.</li>
            <li>هذا الإقرار <b>لا يُعد إبراءً</b> من أي التزام أو مسؤولية تنكشف لاحقاً عن نقص أو تلف أو مخالفة وقعت أثناء العلاقة.</li>
            <li>ما لم يُسلَّم من عهدة يبقى بذمة الطرف الثاني بقيمته، ويلتزم بأدائه فور المطالبة.</li>
            <li>تختص محاكم مدينة ${esc(d.jurisdictionCity)} بنظر أي نزاع.${d.notes ? ' <b>ملاحظات:</b> ' + esc(d.notes) : ''}</li>
          </ol></div>

        <div class="sign-grid">
          <div class="sign-box"><span class="role">الطرف الثاني</span><div class="thumb-box">بصمة الإبهام</div>
            <div class="ln">الاسم: ${esc(d.partyName) || '________________'}</div>
            <div class="ln">التوقيع: ____________________</div>
            <div class="ln">التاريخ: ____________________</div></div>
          <div class="sign-box"><span class="role">عن الشركة (المستلِم)</span>
            <div class="ln">الاسم: ${esc(d.companyRep) || esc(d.__user) || '________________'}</div>
            <div class="ln">التوقيع والختم: ____________________</div></div>
        </div>
        ${foot(d, esc)}</div>`;
    },
  });
})();
