/* ═══════════════════════════════════════════════════════
   gmt-settlements.js — م6: الحساب الجاري والتسويات (يُرفع جنب admin-final.html)
   ─ يحل مشكلة "التحصيل المزدوج" جذرياً: كل عمولة تُدفع تُختم برقم تسوية
     (settlement_id) — والعمولة المختومة لا تدخل أي تسوية أخرى إطلاقاً.
   ─ شاشة واحدة لكل فرع: الصندوق الحالي · عمولات موافقة غير مدفوعة · بذمتك له ·
     سجل كامل (فواتير/عمولات/سحوبات/تسويات).
   ─ ثلاث عمليات فقط: 💵 سحب من الصندوق · 🧾 تسوية دورية (الأساسية) · عمولة فاتورة مفردة.
   يتطلب: GMT_SETTLEMENTS.txt (القاعدة الرئيسية).
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

  const S = { branchKey: null, cashier: '', from: monthStart(), to: today(), data: null, busy: false };

  /* ══ حساب الوضع المالي للفرع (المصدر الوحيد للحقيقة) ══ */
  function compute(branchKey, cashier, from, to) {
    const invs = (window.allInvoices || []).filter((i) => i.branch_key === branchKey);
    const comms = (window.allComm || []).filter((c) => c.branch_key === branchKey);
    const trans = (window.allTransfers || []).filter((t) => t.branch_key === branchKey);

    const inRange = (d) => { const x = String(d || '').slice(0, 10); return x >= from && x <= to; };
    const byCashier = (c) => !cashier || (c.cashier_name || '') === cashier;

    // الصندوق = المبيعات النقدية المحصّلة − ما رُحّل/سُحب (نفس منطق النظام الحالي)
    const sales = invs.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const moved = trans.reduce((s, t) => s + (Number(t.amount) || 0), 0); // موجب=تحصيل/سحب، سالب=مصروف
    const cashBox = sales - moved;

    // العمولات — م6-ب: عمولة الآجل معلّقة حتى تحصيل الفاتورة (awaiting_collection)
    const held = comms.filter((c) => c.awaiting_collection && !c.paid && byCashier(c));
    const heldSum = held.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const approvedUnpaid = comms.filter((c) => c.approved && !c.paid && !c.awaiting_collection && byCashier(c));
    const owed = approvedUnpaid.reduce((s, c) => s + (Number(c.amount) || 0), 0); // بذمة الإدارة له (كل الفترات)
    const periodComms = approvedUnpaid.filter((c) => inRange(c.approved_at || c.created_at));
    const periodOwed = periodComms.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const pending = comms.filter((c) => !c.approved && byCashier(c));
    const pendingSum = pending.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const paidEver = comms.filter((c) => c.paid && byCashier(c)).reduce((s, c) => s + (Number(c.amount) || 0), 0);

    return { sales, moved, cashBox, owed, periodComms, periodOwed, pending: pending.length, pendingSum, paidEver, invCount: invs.length, held: held.length, heldSum };
  }

  /* ══ الترقيم الرسمي للتسوية ══ */
  async function nextNo(row) {
    const ins = await window.sb('POST', '/rest/v1/gmt_settlements', row, { Prefer: 'return=representation' });
    const r = Array.isArray(ins) ? ins[0] : ins;
    if (!r || r.id == null) throw new Error('تعذّر إنشاء سجل التسوية');
    const no = 'GMT-S-' + String(r.id).padStart(5, '0');
    await window.sb('PATCH', `/rest/v1/gmt_settlements?id=eq.${r.id}`, { settlement_no: no }, { Prefer: 'return=minimal' });
    r.settlement_no = no;
    return r;
  }

  /* ══ الواجهة ══ */
  function open(branchKey) {
    S.branchKey = branchKey || (window.branches || [])[0]?.key_name;
    if (!S.branchKey) return alert('لا توجد فروع');
    render();
  }

  function render() {
    const b = (window.branches || []).find((x) => x.key_name === S.branchKey) || { display_name: S.branchKey };
    const d = compute(S.branchKey, S.cashier, S.from, S.to);
    S.data = d;

    // قائمة الكاشيرين لهذا الفرع (من العمولات)
    const cashiers = Array.from(new Set((window.allComm || []).filter((c) => c.branch_key === S.branchKey && c.cashier_name).map((c) => c.cashier_name)));

    const ov = document.getElementById('settl-ov') || document.createElement('div');
    ov.id = 'settl-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto;';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:18px;max-width:760px;width:100%;margin:auto;font-family:'Cairo',sans-serif;direction:rtl;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a1a,#2a1215);color:#fff;padding:14px 18px;border-bottom:3px solid #C00012;display:flex;align-items:center;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:16px;font-weight:900;">🧾 الحساب الجاري — ${esc(b.display_name)}</div>
            <div style="font-size:11px;color:#cbd5e1;">كل عملية تُسجَّل برقم — ولا عمولة تُدفع مرتين</div>
          </div>
          <button onclick="document.getElementById('settl-ov').remove()" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:9px;padding:7px 12px;font-weight:800;font-family:inherit;cursor:pointer;">إغلاق</button>
        </div>

        <div style="padding:16px;">
          <!-- الفرع والكاشير والفترة -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            <select id="st-branch" style="flex:1;min-width:120px;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px;font-family:inherit;font-weight:800;font-size:12px;">
              ${(window.branches || []).map((x) => `<option value="${esc(x.key_name)}" ${x.key_name === S.branchKey ? 'selected' : ''}>${esc(x.display_name || x.key_name)}</option>`).join('')}
            </select>
            <select id="st-cashier" style="flex:1;min-width:120px;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px;font-family:inherit;font-weight:800;font-size:12px;">
              <option value="">كل الكاشيرين</option>
              ${cashiers.map((c) => `<option value="${esc(c)}" ${c === S.cashier ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
            <input type="date" id="st-from" value="${S.from}" style="border:1.5px solid #e5e7eb;border-radius:10px;padding:8px;font-family:inherit;font-size:12px;">
            <input type="date" id="st-to" value="${S.to}" style="border:1.5px solid #e5e7eb;border-radius:10px;padding:8px;font-family:inherit;font-size:12px;">
          </div>

          <!-- البطاقات الأربع -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-bottom:14px;">
            <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:11px;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#0369a1;">💰 بصندوق الفرع الآن</div>
              <div style="font-size:19px;font-weight:900;color:#0369a1;margin-top:2px;">${money(d.cashBox)}</div>
              <div style="font-size:9px;color:#64748b;">مبيعات ${money(d.sales)} − محصّل ${money(d.moved)}</div>
            </div>
            <div style="background:#FFF0F2;border:1.5px solid #FFD6DA;border-radius:12px;padding:11px;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#C00012;">💜 عمولات بذمتك له</div>
              <div style="font-size:19px;font-weight:900;color:#C00012;margin-top:2px;">${money(d.owed)}</div>
              <div style="font-size:9px;color:#64748b;">موافَقة وغير مدفوعة (كل الفترات)</div>
            </div>
            <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:11px;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#b45309;">⏳ بانتظار موافقتك</div>
              <div style="font-size:19px;font-weight:900;color:#b45309;margin-top:2px;">${money(d.pendingSum)}</div>
              <div style="font-size:9px;color:#64748b;">${d.pending} عمولة — وافق عليها من تبويب الفواتير</div>
            </div>
            <div style="background:#fff1f2;border:1.5px solid #fecdd3;border-radius:12px;padding:11px;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#be123c;">🔒 معلّقة (بيع آجل)</div>
              <div style="font-size:19px;font-weight:900;color:#be123c;margin-top:2px;">${money(d.heldSum)}</div>
              <div style="font-size:9px;color:#64748b;">${d.held} عمولة — تُستحق عند تحصيل ثمن الفاتورة</div>
            </div>
            <div style="background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:12px;padding:11px;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#059669;">✅ عمولات الفترة المحددة</div>
              <div style="font-size:19px;font-weight:900;color:#059669;margin-top:2px;">${money(d.periodOwed)}</div>
              <div style="font-size:9px;color:#64748b;">${d.periodComms.length} فاتورة — جاهزة للتسوية</div>
            </div>
          </div>

          <!-- العمليات الثلاث -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            <button onclick="GMTSettlements.doSettle()" style="flex:2;min-width:170px;background:linear-gradient(135deg,#C00012,#8a000d);color:#fff;border:none;border-radius:11px;padding:12px;font-family:inherit;font-weight:900;font-size:13px;cursor:pointer;">
              🧾 تسوية الفترة (${money(d.periodOwed)})
            </button>
            <button onclick="GMTSettlements.doWithdraw()" style="flex:1;min-width:130px;background:#1a1a1a;color:#fff;border:none;border-radius:11px;padding:12px;font-family:inherit;font-weight:900;font-size:13px;cursor:pointer;">
              💵 سحب من الصندوق
            </button>
          </div>

          <!-- سجل العمولات المشمولة -->
          <div style="font-size:12px;font-weight:900;color:#374151;margin-bottom:6px;">📋 عمولات الفترة (كل فاتورة على حدة — يمكنك دفع أي واحدة مفردة)</div>
          <div style="border:1px solid #e5e7eb;border-radius:12px;max-height:190px;overflow:auto;margin-bottom:14px;">
            ${d.periodComms.length ? d.periodComms.map((c) => {
              const inv = (window.allInvoices || []).find((i) => i.id === c.invoice_id);
              return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid #f3f4f6;font-size:11.5px;">
                <div style="flex:1;font-weight:800;">${esc(inv ? ('#' + (inv.inv_number || inv.id)) : ('عمولة #' + c.id))} ${c.cashier_name ? `<span style="color:#9ca3af;font-weight:700;">· ${esc(c.cashier_name)}</span>` : ''}</div>
                <div style="font-weight:900;color:#C00012;">${money(c.amount)}</div>
                <button onclick="GMTSettlements.paySingle('${c.id}')" style="background:#f5f3ff;color:#C00012;border:1px solid #ddd6fe;border-radius:8px;padding:5px 9px;font-family:inherit;font-size:10px;font-weight:800;cursor:pointer;">دفع مفرد</button>
              </div>`;
            }).join('') : '<div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;font-weight:700;">لا عمولات موافقة بهذه الفترة</div>'}
          </div>

          <!-- سجل التسويات السابقة -->
          <div style="font-size:12px;font-weight:900;color:#374151;margin-bottom:6px;">📜 سجل التسويات والسحوبات</div>
          <div id="st-history" style="border:1px solid #e5e7eb;border-radius:12px;max-height:170px;overflow:auto;">
            <div style="padding:14px;text-align:center;color:#9ca3af;font-size:12px;">جارٍ التحميل…</div>
          </div>
        </div>
      </div>`;
    if (!ov.parentNode) document.body.appendChild(ov);

    document.getElementById('st-branch').onchange = (e) => { S.branchKey = e.target.value; S.cashier = ''; render(); };
    document.getElementById('st-cashier').onchange = (e) => { S.cashier = e.target.value; render(); };
    document.getElementById('st-from').onchange = (e) => { S.from = e.target.value; render(); };
    document.getElementById('st-to').onchange = (e) => { S.to = e.target.value; render(); };
    loadHistory();
  }

  async function loadHistory() {
    const el = document.getElementById('st-history');
    try {
      const rows = await window.sb('GET', `/rest/v1/gmt_settlements?branch_key=eq.${encodeURIComponent(S.branchKey)}&order=created_at.desc&limit=40`);
      if (!el) return;
      el.innerHTML = (rows && rows.length) ? rows.map((r) => {
        const icon = r.kind === 'withdraw' ? '💵' : r.kind === 'single' ? '💜' : '🧾';
        const label = r.kind === 'withdraw' ? 'سحب من الصندوق' : r.kind === 'single' ? 'دفع عمولة مفردة' : 'تسوية دورية';
        const amt = r.kind === 'withdraw' ? r.withdraw_amount : r.paid_amount;
        return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid #f3f4f6;font-size:11px;">
          <div style="flex:1;">
            <div style="font-weight:900;">${icon} ${label} <span style="color:#9ca3af;">${esc(r.settlement_no || '')}</span></div>
            <div style="color:#6b7280;font-weight:700;margin-top:1px;">${new Date(r.created_at).toLocaleDateString('ar-SY')} ${r.cashier_name ? '· ' + esc(r.cashier_name) : ''} ${r.invoice_count ? '· ' + r.invoice_count + ' فاتورة' : ''}</div>
            ${r.note ? `<div style="color:#9ca3af;font-size:10px;margin-top:1px;">${esc(r.note)}</div>` : ''}
          </div>
          <div style="text-align:left;">
            <div style="font-weight:900;color:#111;">${money(amt)}</div>
            <div style="font-size:9px;color:#6b7280;">صندوق بعدها ${money(r.cash_after)} · بذمتك ${money(r.owed_after)}</div>
          </div>
        </div>`;
      }).join('') : '<div style="padding:14px;text-align:center;color:#9ca3af;font-size:12px;">لا سجلات بعد</div>';
    } catch (e) {
      if (el) el.innerHTML = `<div style="padding:14px;color:#dc2626;font-size:11px;font-weight:700;">تعذّر تحميل السجل: ${esc(e.message)} — هل شغّلت GMT_SETTLEMENTS.txt؟</div>`;
    }
  }

  /* ══ العملية ١: التسوية الدورية (الأساسية) ══ */
  async function doSettle() {
    const d = S.data;
    if (!d.periodComms.length) return alert('لا عمولات موافقة بهذه الفترة');
    const b = (window.branches || []).find((x) => x.key_name === S.branchKey) || {};
    const maxPay = d.periodOwed;

    const html = `
      <div style="font-family:'Cairo',sans-serif;direction:rtl;">
        <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;margin-bottom:12px;font-size:12px;font-weight:800;color:#166534;line-height:1.9;">
          🧾 تسوية <b>${esc(b.display_name || S.branchKey)}</b>${S.cashier ? ' — ' + esc(S.cashier) : ''}<br>
          الفترة: ${S.from} ← ${S.to} · ${d.periodComms.length} فاتورة<br>
          إجمالي عمولات الفترة: <b>${money(maxPay)}</b> · بصندوقه الآن: <b>${money(d.cashBox)}</b>
        </div>
        <label style="font-size:11px;font-weight:800;color:#374151;">المبلغ المدفوع له فعلاً الآن $</label>
        <input type="number" id="st-pay" value="${maxPay.toFixed(2)}" step="0.01" min="0" style="width:100%;border:2px solid #16a34a;border-radius:10px;padding:11px;font-family:inherit;font-size:18px;font-weight:900;text-align:center;color:#16a34a;margin:5px 0 4px;">
        <div style="font-size:10.5px;color:#6b7280;font-weight:700;line-height:1.8;margin-bottom:10px;">
          ادفع كل المبلغ أو جزءاً منه — الباقي يبقى مسجّلاً بذمتك له ويظهر بالتسوية القادمة تلقائياً.
        </div>
        <label style="font-size:11px;font-weight:800;color:#374151;">ملاحظة (اختياري)</label>
        <input type="text" id="st-note" placeholder="مثال: تسوية شهر تموز — سُلّمت نقداً" style="width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px;font-family:inherit;font-size:12px;margin:4px 0 12px;">
        <div style="display:flex;gap:8px;">
          <button id="st-go" style="flex:2;background:linear-gradient(135deg,#C00012,#8a000d);color:#fff;border:none;border-radius:10px;padding:12px;font-family:inherit;font-weight:900;font-size:13px;cursor:pointer;">✅ اعتماد التسوية وختم الفواتير</button>
          <button onclick="document.getElementById('st-dlg').remove()" style="flex:1;background:#f3f4f6;color:#374151;border:none;border-radius:10px;padding:12px;font-family:inherit;font-weight:800;cursor:pointer;">إلغاء</button>
        </div>
      </div>`;
    dialog(html);
    document.getElementById('st-go').onclick = async () => {
      if (S.busy) return; S.busy = true;
      const btn = document.getElementById('st-go'); btn.disabled = true; btn.textContent = 'جارٍ الاعتماد…';
      try {
        const pay = parseFloat(document.getElementById('st-pay').value) || 0;
        const note = document.getElementById('st-note').value.trim();
        const ids = d.periodComms.map((c) => c.id);
        const rec = await nextNo({
          branch_key: S.branchKey, cashier_name: S.cashier || null, kind: 'settlement',
          period_from: S.from, period_to: S.to,
          comm_total: d.periodOwed, paid_amount: pay, withdraw_amount: 0,
          cash_before: d.cashBox, cash_after: d.cashBox,
          owed_after: Math.max(0, d.owed - pay), invoice_count: ids.length,
          note: note || null, created_by: 'admin',
        });
        // ختم العمولات — دفعة واحدة (العمولة المختومة لا تدخل تسوية ثانية أبداً)
        // &paid=eq.false ⇒ القاعدة نفسها تمنع دفع عمولة مدفوعة مسبقاً (منع التحصيل المزدوج عبر التبويبات)
        await window.sb('PATCH', `/rest/v1/invoice_commissions?id=in.(${ids.join(',')})&paid=eq.false`,
          { paid: true, paid_at: new Date().toISOString(), settlement_id: rec.id }, { Prefer: 'return=minimal' });
        (window.allComm || []).forEach((c) => { if (ids.includes(c.id)) { c.paid = true; c.settlement_id = rec.id; } });
        document.getElementById('st-dlg')?.remove();
        alert('✅ اعتُمدت التسوية ' + rec.settlement_no + '\nالمدفوع: ' + money(pay) + (d.owed - pay > 0.01 ? '\nالباقي بذمتك له: ' + money(d.owed - pay) : '\nخالص بالكامل ✓'));
        render();
      } catch (e) { alert('تعذّرت التسوية: ' + e.message); }
      finally { S.busy = false; }
    };
  }

  /* ══ العملية ٢: السحب من الصندوق ══ */
  async function doWithdraw() {
    const d = S.data;
    const b = (window.branches || []).find((x) => x.key_name === S.branchKey) || {};
    const html = `
      <div style="font-family:'Cairo',sans-serif;direction:rtl;">
        <div style="background:#ecfeff;border:1.5px solid #a5f3fc;border-radius:12px;padding:12px;margin-bottom:12px;font-size:12px;font-weight:800;color:#155e75;line-height:1.9;">
          💵 سحب من صندوق <b>${esc(b.display_name || S.branchKey)}</b><br>
          بالصندوق الآن: <b>${money(d.cashBox)}</b> · من ضمنها عمولات له: <b>${money(d.owed)}</b>
        </div>
        <label style="font-size:11px;font-weight:800;color:#374151;">المبلغ الذي سحبته $</label>
        <input type="number" id="st-amt" value="${d.cashBox.toFixed(2)}" step="0.01" min="0" style="width:100%;border:2px solid #0e7490;border-radius:10px;padding:11px;font-family:inherit;font-size:18px;font-weight:900;text-align:center;color:#0e7490;margin:5px 0 4px;">
        <div id="st-preview" style="font-size:11px;color:#374151;font-weight:800;background:#f8fafc;border-radius:9px;padding:9px;line-height:1.9;margin-bottom:10px;"></div>
        <label style="font-size:11px;font-weight:800;color:#374151;">ملاحظة (اختياري)</label>
        <input type="text" id="st-note2" placeholder="مثال: استلمت المبلغ نقداً بتاريخ..." style="width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px;font-family:inherit;font-size:12px;margin:4px 0 12px;">
        <div style="display:flex;gap:8px;">
          <button id="st-go2" style="flex:2;background:#1a1a1a;color:#fff;border:none;border-radius:10px;padding:12px;font-family:inherit;font-weight:900;font-size:13px;cursor:pointer;">✅ تسجيل السحب</button>
          <button onclick="document.getElementById('st-dlg').remove()" style="flex:1;background:#f3f4f6;color:#374151;border:none;border-radius:10px;padding:12px;font-family:inherit;font-weight:800;cursor:pointer;">إلغاء</button>
        </div>
      </div>`;
    dialog(html);
    const upd = () => {
      const a = parseFloat(document.getElementById('st-amt').value) || 0;
      const left = d.cashBox - a;
      document.getElementById('st-preview').innerHTML =
        `يبقى بصندوقه: <b>${money(Math.max(0, left))}</b><br>` +
        `عمولاته المستحقة: <b style="color:#C00012;">${money(d.owed)}</b> — ${left >= d.owed - 0.01
          ? 'مغطّاة من صندوقه ✓ (تُدفع له بالتسوية)'
          : `<span style="color:#b45309;">غير مغطاة بالكامل: ${money(d.owed - Math.max(0, left))} تبقى بذمتك له</span>`}`;
    };
    document.getElementById('st-amt').oninput = upd; upd();
    document.getElementById('st-go2').onclick = async () => {
      if (S.busy) return; S.busy = true;
      const btn = document.getElementById('st-go2'); btn.disabled = true; btn.textContent = 'جارٍ التسجيل…';
      try {
        const amt = parseFloat(document.getElementById('st-amt').value) || 0;
        const note = document.getElementById('st-note2').value.trim();
        const rec = await nextNo({
          branch_key: S.branchKey, cashier_name: S.cashier || null, kind: 'withdraw',
          period_from: S.from, period_to: S.to,
          comm_total: 0, paid_amount: 0, withdraw_amount: amt,
          cash_before: d.cashBox, cash_after: Math.max(0, d.cashBox - amt),
          owed_after: d.owed, invoice_count: 0, note: note || null, created_by: 'admin',
        });
        // حركة الصندوق بنفس جدول النظام (لتنعكس بكل الشاشات)
        const t = await window.sb('POST', '/rest/v1/branch_transfers', {
          branch_key: S.branchKey, amount: amt,
          note: 'سحب — ' + rec.settlement_no + (note ? ' · ' + note : ''),
          transfer_date: today(), confirmed_by: 'admin',
          settlement_id: rec.id, kind: 'withdraw',
        }, { Prefer: 'return=representation' });
        const row = Array.isArray(t) ? t[0] : t;
        if (row && window.allTransfers) window.allTransfers.push(row);
        document.getElementById('st-dlg')?.remove();
        alert('✅ سُجّل السحب ' + rec.settlement_no + '\nالمبلغ: ' + money(amt) + '\nبقي بصندوقه: ' + money(Math.max(0, d.cashBox - amt)) + '\nبذمتك له عمولات: ' + money(d.owed));
        render();
      } catch (e) { alert('تعذّر تسجيل السحب: ' + e.message); }
      finally { S.busy = false; }
    };
  }

  /* ══ العملية ٣: دفع عمولة فاتورة مفردة ══ */
  async function paySingle(commId) {
    const c = (window.allComm || []).find((x) => String(x.id) === String(commId));
    if (!c) return;
    if (!confirm('دفع عمولة هذه الفاتورة مفردةً؟\nالمبلغ: ' + money(c.amount) + '\n(تُختم فلا تدخل أي تسوية لاحقة)')) return;
    if (S.busy) return; S.busy = true;
    try {
      const d = S.data;
      const rec = await nextNo({
        branch_key: S.branchKey, cashier_name: c.cashier_name || S.cashier || null, kind: 'single',
        period_from: S.from, period_to: S.to,
        comm_total: Number(c.amount) || 0, paid_amount: Number(c.amount) || 0, withdraw_amount: 0,
        cash_before: d.cashBox, cash_after: d.cashBox,
        owed_after: Math.max(0, d.owed - (Number(c.amount) || 0)), invoice_count: 1,
        note: 'دفع عمولة فاتورة مفردة', created_by: 'admin',
      });
      await window.sb('PATCH', `/rest/v1/invoice_commissions?id=eq.${c.id}&paid=eq.false`,
        { paid: true, paid_at: new Date().toISOString(), settlement_id: rec.id }, { Prefer: 'return=minimal' });
      c.paid = true; c.settlement_id = rec.id;
      alert('✅ دُفعت العمولة — ' + rec.settlement_no);
      render();
    } catch (e) { alert('تعذّر الدفع: ' + e.message); }
    finally { S.busy = false; }
  }

  function dialog(html) {
    document.getElementById('st-dlg')?.remove();
    const d = document.createElement('div');
    d.id = 'st-dlg';
    d.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px;';
    d.innerHTML = `<div style="background:#fff;border-radius:16px;padding:16px;max-width:420px;width:100%;">${html}</div>`;
    document.body.appendChild(d);
  }

  /* ══ الدالة الموحّدة: أي دفع عمولة بالنظام كله يمر من هنا ويُختم ══
     (استدعتها المسارات المدموجة: التحصيل الكامل مع الفاتورة، واقتطاع العمولة عند
      تحصيل الدين) — فلا يبقى أي مسار يكتب paid=true دون رقم تسوية. */
  async function stampPay(commIds, branchKey, amount, kind, note) {
    const ids = (commIds || []).filter(Boolean);
    if (!ids.length) return null;
    const d = compute(branchKey, '', S.from, S.to);
    const first = (window.allComm || []).find((c) => String(c.id) === String(ids[0]));
    const rec = await nextNo({
      branch_key: branchKey, cashier_name: (first && first.cashier_name) || null,
      kind: kind || 'single', period_from: S.from, period_to: S.to,
      comm_total: Number(amount) || 0, paid_amount: Number(amount) || 0, withdraw_amount: 0,
      cash_before: d.cashBox, cash_after: d.cashBox,
      owed_after: Math.max(0, d.owed - (Number(amount) || 0)), invoice_count: ids.length,
      note: note || null, created_by: 'admin',
    });
    await window.sb('PATCH', `/rest/v1/invoice_commissions?id=in.(${ids.join(',')})&paid=eq.false`,
      { paid: true, paid_at: new Date().toISOString(), settlement_id: rec.id }, { Prefer: 'return=minimal' });
    (window.allComm || []).forEach((c) => { if (ids.map(String).includes(String(c.id))) { c.paid = true; c.settlement_id = rec.id; } });
    if (document.getElementById('settl-ov')) render();
    return rec;
  }

  window.GMTSettlements = { open, doSettle, doWithdraw, paySingle, compute, stampPay };

  /* ══ زر عائم بالأدمن ══ */
  function mount() {
    if (document.getElementById('settl-btn')) return;
    const b = document.createElement('button');
    b.id = 'settl-btn';
    b.textContent = '🧾 الحساب الجاري والتسويات';
    b.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:800;background:linear-gradient(135deg,#C00012,#8a000d);color:#fff;border:none;border-radius:12px;padding:11px 15px;font-family:Cairo,Arial,sans-serif;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(192,0,18,.32);';
    b.onclick = () => open(S.branchKey);
    document.body.appendChild(b);
    // إزاحة زر أسماء النقاط لئلا يتراكبا
    const bn = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('أسماء نقاط البيع'));
    if (bn) bn.style.bottom = '62px';
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
