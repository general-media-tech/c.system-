/* ═══════════════════════════════════════════════════════
   نموذج العهدة | js/contracts/custody.js — إصدار 1 (2026-07-12)
   ملحق يُوقَّع عند تسليم أي جهاز/معدة/مفتاح/حساب — يُحيل إليه عقد العمل (م14).
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const head = (d, esc) => `<div class="c-head">
    <div class="logo">General Media Tech<small>جنرال ميديا تك — نموذج عهدة</small></div>
    <div class="meta">رقم المستند: <b style="color:#C00012;">${esc(d.__no)}</b><br>تاريخ التحرير: ${esc(d.__date)}${d.__barcode ? `<img src="${d.__barcode}" alt="barcode">` : ''}</div>
  </div>`;
  const foot = (d, esc) => `<div class="c-foot">
    <span>عهدة ${esc(d.__no)} — ${esc(d.holderName || '')}</span>
    <span class="law-line">ملحقٌ متمّم للعقد الأساسي — إيصال أمانة</span>
    <span class="pageno">صفحة 1 من 1</span></div>`;

  // أسطر فارغة لجدول العهدة (تُملأ يدوياً أو عبر التحرير الحر)
  function rows(n, esc, d) {
    let html = '';
    const items = String(d.items || '').split('\n').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < Math.max(n, items.length); i++) {
      const it = items[i] || '';
      const parts = it.split('|').map((s) => s.trim());
      html += `<tr>
        <td style="text-align:center;font-weight:900;">${i + 1}</td>
        <td>${esc(parts[0] || '')}</td>
        <td style="direction:ltr;text-align:center;">${esc(parts[1] || '')}</td>
        <td style="text-align:center;">${esc(parts[2] || '')}</td>
        <td>${esc(parts[3] || '')}</td>
      </tr>`;
    }
    return html;
  }

  window.GMTContracts.register({
    id: 'custody',
    icon: '📦',
    title: 'نموذج عهدة (تسليم أجهزة ومعدات)',
    desc: 'إيصال أمانة تفصيلي: الأصناف والأرقام التسلسلية والحالة والقيمة · إقرار الضمان والإعادة · ملحق متمّم للعقد الأساسي.',
    partyField: 'holderName',
    copies: [
      { id: 'company', label: 'نسخة الشركة (الأصل)', on: true },
      { id: 'client', label: 'نسخة المستلِم', on: true },
    ],
    fields: [
      { key: 'companyName', label: 'الاسم القانوني للشركة', def: 'شركة جنرال ميديا تك General Media Tech', req: true },
      { key: 'companyRep', label: 'مسلِّم العهدة (عن الشركة)', def: '' },
      { key: 'holderName', label: 'اسم المستلِم الثلاثي', req: true },
      { key: 'holderId', label: 'الرقم الوطني', ltr: true },
      { key: 'holderPhone', label: 'الهاتف', ltr: true },
      { key: 'holderJob', label: 'المسمى الوظيفي / الصفة', def: '' },
      { key: 'branch', label: 'الفرع / نقطة البيع', def: 'المركز — حلب' },
      { key: 'baseContractNo', label: 'رقم العقد الأساسي', ltr: true },
      { key: 'handDate', label: 'تاريخ التسليم', type: 'date' },
      { key: 'items', label: 'الأصناف (سطر لكل صنف: الصنف | الرقم التسلسلي | الكمية | الحالة)', type: 'textarea', ph: 'كاميرا Canon R6 | 1234567 | 1 | جديدة\nعدسة 24-70 | 998877 | 1 | مستعملة — بحالة جيدة' },
      { key: 'totalValue', label: 'إجمالي القيمة التقديرية للعهدة', ph: 'مثال: 12,000,000 ل.س' },
      { key: 'jurisdictionCity', label: 'مدينة الاختصاص القضائي', def: 'حلب', req: true },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],

    render(d, copy, { esc }) {
      const badge = copy === 'client' ? '<div class="c-copy client">نسخة المستلِم</div>' : '<div class="c-copy">نسخة الشركة — الأصل</div>';

      return `<div class="sheet">${badge}${head(d, esc)}
        <div class="c-title">نموذج عهدة — إيصال أمانة<small>ملحقٌ متمّم للعقد الأساسي (المادة 14 من عقد العمل)</small></div>
        <table class="c-data">
          <tr><td class="k">المسلِّم (الشركة)</td><td>${esc(d.companyName)} — بيد: ${esc(d.companyRep) || '________'}</td></tr>
          <tr><td class="k">المستلِم</td><td>${esc(d.holderName)} — وطني: ${esc(d.holderId) || '________'} — هاتف: ${esc(d.holderPhone) || '________'} — الصفة: ${esc(d.holderJob) || '________'}</td></tr>
          <tr><td class="k">الفرع / نقطة البيع</td><td>${esc(d.branch)}</td></tr>
          <tr><td class="k">العقد الأساسي</td><td>${esc(d.baseContractNo) || '________'}</td></tr>
          <tr><td class="k">تاريخ التسليم</td><td>${d.handDate ? esc(d.handDate) : '____/____/______'}</td></tr>
        </table>

        <div class="c-art"><h4>جدول الأصناف المسلَّمة</h4>
          <table class="c-data c-table">
            <tr><th style="width:8%;">م</th><th style="width:38%;">الصنف / الوصف</th><th style="width:22%;">الرقم التسلسلي</th><th style="width:10%;">الكمية</th><th>الحالة عند التسليم</th></tr>
            ${rows(8, esc, d)}
          </table>
          ${d.totalValue ? `<div class="c-note">إجمالي القيمة التقديرية للعهدة: <b>${esc(d.totalValue)}</b></div>` : ''}
        </div>

        <div class="c-art"><h4>إقرار المستلِم</h4>
          <ol>
            <li>أقرّ باستلامي الأصناف المبيّنة أعلاه بحالتها المدوَّنة، وأنها <b>عهدةٌ بيدي يد أمانة</b> وليست ملكاً لي بأي وجه.</li>
            <li>ألتزم بحفظها واستعمالها في أغراض العمل حصراً، وبعدم إعارتها أو رهنها أو نقلها أو التصرف بها.</li>
            <li>أضمن كل نقص أو تلف أو فقد يقع عليها — عدا الاستهلاك الطبيعي والعيب المصنعي الثابت — <b>بقيمتها</b>، وأؤدّيها فور المطالبة، ويجوز حسم ما يجيز القانون حسمه من مستحقاتي.</li>
            <li>ألتزم بإعادتها كاملة بحالتها فور الطلب أو عند انتهاء علاقتي بالشركة، وأن امتناعي عن ردّها يُعد تصرفاً بمال الغير المؤتمَن عليه وتسري بحقي أحكام إساءة الائتمان في قانون العقوبات السوري، فضلاً عن المسؤولية المدنية.</li>
            <li>ما يُسلَّم لي لاحقاً من أصناف بموجب سطر إضافي موقَّع أو نموذج عهدة جديد يُعد متمّماً لهذا النموذج.</li>
          </ol></div>

        ${d.notes ? `<div class="c-note"><b>ملاحظات:</b> ${esc(d.notes)}</div>` : ''}

        <div class="sign-grid">
          <div class="sign-box"><span class="role">المستلِم</span><div class="thumb-box">بصمة الإبهام</div>
            <div class="ln">الاسم: ${esc(d.holderName) || '________________'}</div>
            <div class="ln">التوقيع: ____________________</div>
            <div class="ln">التاريخ: ____________________</div></div>
          <div class="sign-box"><span class="role">عن الشركة (المسلِّم)</span>
            <div class="ln">الاسم: ${esc(d.companyRep) || esc(d.__user) || '________________'}</div>
            <div class="ln">التوقيع والختم: ____________________</div></div>
        </div>
        <div class="c-note">عند الإعادة: تاريخ الإعادة ____________ · الحالة ____________ · استلمها عن الشركة ____________ · التوقيع ____________</div>
        ${foot(d, esc)}</div>`;
    },
  });
})();
