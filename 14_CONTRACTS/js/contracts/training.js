/* ═══════════════════════════════════════════════════════
   ملحق التدريب وإقرار الاستلام | js/contracts/training.js — إصدار 1 (2026-07-12)
   يوثّق الدورات وتكاليفها ومدة الارتباط — سندُ المطالبة باسترداد التكاليف (م11 من عقد العمل).
   ملاحظة قانونية: الاسترداد لا ينفذ إلا بتكلفة ثابتة ومحددة القيمة وموقَّعة من العامل.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const head = (d, esc) => `<div class="c-head">
    <div class="logo">General Media Tech<small>جنرال ميديا تك — ملحق تدريب</small></div>
    <div class="meta">رقم المستند: <b style="color:#C00012;">${esc(d.__no)}</b><br>تاريخ التحرير: ${esc(d.__date)}${d.__barcode ? `<img src="${d.__barcode}" alt="barcode">` : ''}</div>
  </div>`;
  const foot = (d, esc) => `<div class="c-foot">
    <span>ملحق تدريب ${esc(d.__no)} — ${esc(d.employeeName || '')}</span>
    <span class="law-line">ملحقٌ متمّم للعقد الأساسي</span>
    <span class="pageno">صفحة 1 من 1</span></div>`;

  function rows(esc, d) {
    const items = String(d.courses || '').split('\n').map((s) => s.trim()).filter(Boolean);
    let html = '';
    const n = Math.max(6, items.length);
    for (let i = 0; i < n; i++) {
      const p = (items[i] || '').split('|').map((s) => s.trim());
      html += `<tr>
        <td style="text-align:center;font-weight:900;">${i + 1}</td>
        <td>${esc(p[0] || '')}</td>
        <td style="text-align:center;">${esc(p[1] || '')}</td>
        <td style="text-align:center;">${esc(p[2] || '')}</td>
        <td style="text-align:center;font-weight:800;">${esc(p[3] || '')}</td>
      </tr>`;
    }
    return html;
  }

  window.GMTContracts.register({
    id: 'training',
    icon: '🎓',
    title: 'ملحق تدريب وإقرار استلام',
    desc: 'توثيق الدورات والتدريب الداخلي والخارجي وتكاليفها ومدة الارتباط — سند استرداد التكاليف عند الترك المبكر.',
    partyField: 'employeeName',
    copies: [
      { id: 'company', label: 'نسخة الشركة (الأصل)', on: true },
      { id: 'client', label: 'نسخة الموظف', on: true },
    ],
    fields: [
      { key: 'companyName', label: 'الاسم القانوني للشركة', def: 'شركة جنرال ميديا تك General Media Tech', req: true },
      { key: 'companyRep', label: 'ممثل الشركة الموقِّع', def: '' },
      { key: 'employeeName', label: 'اسم الموظف الثلاثي', req: true },
      { key: 'employeeId', label: 'الرقم الوطني', ltr: true },
      { key: 'baseContractNo', label: 'رقم عقد العمل الأساسي', ltr: true },
      { key: 'courses', label: 'الدورات (سطر لكل دورة: العنوان | الجهة/المدرّب | التاريخ | التكلفة)', type: 'textarea', ph: 'أساسيات التصوير الاحترافي | تدريب داخلي — قسم الاستوديو | 2026-08-01 | 1,500,000 ل.س\nمونتاج Premiere | دورة خارجية | 2026-09-10 | 2,000,000 ل.س' },
      { key: 'totalCost', label: 'إجمالي التكلفة الثابتة', req: true, ph: 'مثال: 3,500,000 ل.س' },
      { key: 'bondMonths', label: 'مدة الارتباط بعد آخر دورة (شهراً)', type: 'number', def: '12' },
      { key: 'jurisdictionCity', label: 'مدينة الاختصاص القضائي', def: 'حلب', req: true },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],

    render(d, copy, { esc }) {
      const badge = copy === 'client' ? '<div class="c-copy client">نسخة الموظف</div>' : '<div class="c-copy">نسخة الشركة — الأصل</div>';
      const bond = esc(d.bondMonths) || '12';

      return `<div class="sheet">${badge}${head(d, esc)}
        <div class="c-title">ملحق تدريب وإقرار استلام<small>ملحقٌ متمّم للعقد الأساسي (المادة 11 من عقد العمل)</small></div>
        <table class="c-data">
          <tr><td class="k">الشركة</td><td>${esc(d.companyName)} — يمثّلها: ${esc(d.companyRep) || '________'}</td></tr>
          <tr><td class="k">الموظف</td><td>${esc(d.employeeName)} — وطني: ${esc(d.employeeId) || '________'}</td></tr>
          <tr><td class="k">العقد الأساسي</td><td>${esc(d.baseContractNo) || '________'}</td></tr>
          <tr><td class="k">مدة الارتباط</td><td><b>${bond}</b> شهراً من تاريخ آخر دورة</td></tr>
        </table>

        <div class="c-art"><h4>جدول التدريب وتكاليفه</h4>
          <table class="c-data c-table">
            <tr><th style="width:8%;">م</th><th style="width:34%;">عنوان التدريب / الدورة</th><th style="width:24%;">الجهة أو المدرّب</th><th style="width:14%;">التاريخ</th><th>التكلفة</th></tr>
            ${rows(esc, d)}
            <tr><td colspan="4" style="text-align:left;font-weight:900;">الإجمالي الثابت</td><td style="text-align:center;font-weight:900;color:#C00012;">${esc(d.totalCost) || '__________'}</td></tr>
          </table>
        </div>

        <div class="c-art"><h4>الأحكام</h4>
          <ol>
            <li>يُعد تدريباً — لأغراض هذا الملحق والعقد الأساسي — كل ما تنفقه الشركة على تأهيل الموظف: الدورات وورش العمل، والتدريب الداخلي والخارجي والعملي، والتعليم الفردي وعن بُعد، والمتابعة والإشراف المخصَّصان لتعليمه، والمواد التعليمية.</li>
            <li>يقرّ الموظف بتلقّي التدريب المبيّن أعلاه على نفقة الشركة، وبأن <b>التكلفة الثابتة</b> المدوَّنة صحيحة ومقبولة منه.</li>
            <li>إذا ترك الموظف العمل باستقالته أو أُنهيت خدمته لسببٍ يعود إلى خطئه الجسيم قبل انقضاء <b>${bond}</b> شهراً من تاريخ آخر دورة، التزم بردّ التكلفة الثابتة <b>بنسبة المدة المتبقية</b> من مدة الارتباط (مثال: تركُ العمل بعد نصف المدة ⇒ ردُّ نصف التكلفة).</li>
            <li>لا يُطالَب الموظف بأي مبلغ إذا كان إنهاء الخدمة بفعل الشركة دون خطأ منه.</li>
            <li>محتوى التدريب وموادّه ومهاراته الخاصة بأنظمة الشركة وأساليبها مشمولٌ ببندي <b>السرية</b> و<b>الملكية الفكرية</b> في العقد الأساسي، ويُعد هذا الملحق جزءاً لا يتجزأ منه.</li>
            <li>أي دورة لاحقة تُضاف بملحق جديد موقَّع، وتبدأ مدة الارتباط من تاريخها.</li>
          </ol></div>

        ${d.notes ? `<div class="c-note"><b>ملاحظات:</b> ${esc(d.notes)}</div>` : ''}
        <div class="c-note">تختص محاكم مدينة ${esc(d.jurisdictionCity)} بنظر أي نزاع ينشأ عن هذا الملحق.</div>

        <div class="sign-grid">
          <div class="sign-box"><span class="role">الموظف</span><div class="thumb-box">بصمة الإبهام</div>
            <div class="ln">الاسم: ${esc(d.employeeName) || '________________'}</div>
            <div class="ln">التوقيع: ____________________</div>
            <div class="ln">التاريخ: ____________________</div></div>
          <div class="sign-box"><span class="role">عن الشركة</span>
            <div class="ln">الاسم: ${esc(d.companyRep) || esc(d.__user) || '________________'}</div>
            <div class="ln">التوقيع والختم: ____________________</div></div>
        </div>
        ${foot(d, esc)}</div>`;
    },
  });
})();
