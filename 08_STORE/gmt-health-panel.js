/* ═══════════════════════════════════════════════════════════════════════
   gmt-health-panel.js — لوحة صحة النظام 🩺 (للأدمن فقط)
   تُرفع بجانب صفحة الأدمن (وأدمن المتجر/السيادي إن أردت) وتُستدعى:
     <script src="gmt-health-panel.js"></script>
   يظهر زر 🩺 أسفل اليسار (أو نادِها: GMTHealthPanel.open()).

   ماذا تريك:
   • 🔴 الأخطاء الحيّة من **كل نقاط البيع** — بلا أن يبلّغك أحد.
   • فلترة: الفرع · المستخدم · الصفحة · الخطورة.
   • «جديد منذ آخر زيارة» — تعرف ما استجدّ.
   • ملخّص **يومي** و**أسبوعي**: الأكثر تكراراً · أي فرع/صفحة تتعثّر.
   • رحلات الجلسات: ماذا فعل المستخدم قبل الخطأ بالضبط.
   • زر «صدّر تقريراً كاملاً» — نصّ جاهز لإرساله للمهندس.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTHealthPanel) return;
  const RED = '#C00012';
  const LS_SEEN = 'gmt_health_seen';

  function cfg() {
    /* 🔧 يستعمل الإعدادات التي التقطها الحارس v3.1 من طلبات الصفحة (الصفحات لا تحمّل gmt-config.js كلها) */
    const sniffed = (window.GMTBug && typeof GMTBug.config === 'function' && GMTBug.config()) || window.GMT_SB || null;
    const url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL || window.SUPA_URL || (window.CONFIG && CONFIG.SUPABASE_URL) || (sniffed && sniffed.url);
    const key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || window.SUPA_KEY || (window.CONFIG && CONFIG.SUPABASE_ANON_KEY) || (sniffed && sniffed.key);
    return url && key ? { url: String(url).replace(/\/$/, ''), key } : null;
  }
  const F = (p, q) => {
    const c = cfg();
    if (!c) return Promise.reject(new Error('لا توجد إعدادات قاعدة بالصفحة'));
    return (window.__gmtRealFetch || fetch)(c.url + '/rest/v1/' + p + (q || ''), {
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key },
    }).then((r) => (r.ok ? r.json() : r.text().then((t) => { throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 120)); })));
  };
  const ago = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'الآن';
    if (m < 60) return `قبل ${m} د`;
    if (m < 1440) return `قبل ${Math.round(m / 60)} س`;
    return `قبل ${Math.round(m / 1440)} يوم`;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  let rows = [], seen = 0, filt = { sev: '', branch: '', page: '', range: 1 };

  function styles() {
    if (document.getElementById('gmt-hp-css')) return;
    const s = document.createElement('style');
    s.id = 'gmt-hp-css';
    s.textContent = `
    .hp-ov{position:fixed;inset:0;z-index:2147482500;background:rgba(6,8,11,.88);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:12px;font-family:Cairo,Arial,sans-serif;direction:rtl}
    .hp-w{background:#11151c;border:1px solid #232b38;border-radius:18px;width:min(880px,100%);max-height:92vh;display:flex;flex-direction:column;color:#e6eaf0}
    .hp-h{padding:14px 16px;border-bottom:1px solid #232b38}
    .hp-tabs{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
    .hp-tab{background:#1a212b;border:1px solid #283040;color:#9fa9b7;border-radius:99px;padding:7px 13px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}
    .hp-tab.on{background:${RED};color:#fff;border-color:${RED}}
    .hp-b{overflow:auto;padding:12px 14px;display:grid;gap:8px}
    .hp-row{background:#161d26;border:1px solid #232b38;border-radius:12px;padding:11px 12px}
    .hp-row.crit{border-right:4px solid ${RED}}
    .hp-row.warn{border-right:4px solid #b45309}
    .hp-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
    .hp-t{font-weight:900;font-size:13.5px}
    .hp-m{font-size:12.5px;color:#c3cbd6;font-weight:600;line-height:1.75;margin-top:4px}
    .hp-meta{font-size:11px;color:#7d8797;font-weight:700;margin-top:6px;display:flex;gap:10px;flex-wrap:wrap}
    .hp-new{background:${RED};color:#fff;font-size:9.5px;font-weight:900;border-radius:99px;padding:2px 7px}
    .hp-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:6px}
    .hp-card{background:#161d26;border:1px solid #232b38;border-radius:12px;padding:10px;text-align:center}
    .hp-card b{display:block;font-size:20px;font-weight:900}
    .hp-card span{font-size:11px;color:#818b9a;font-weight:800}
    .hp-f{padding:11px 14px;border-top:1px solid #232b38;display:flex;gap:8px}
    .hp-btn{border:none;border-radius:11px;padding:11px;font-weight:900;font-family:inherit;cursor:pointer;font-size:13px}
    .hp-p{background:${RED};color:#fff;flex:1}.hp-s{background:#1e2531;color:#aab3c0;padding:11px 15px}
    .hp-sel{background:#0f141b;border:1px solid #283040;color:#dbe1e9;border-radius:9px;padding:7px 9px;font-size:12px;font-weight:700;font-family:inherit}
    `;
    document.head.appendChild(s);
  }

  async function load() {
    const days = filt.range;
    const since = new Date(Date.now() - days * 864e5).toISOString();
    rows = await F('gmt_telemetry', `?select=*&created_at=gte.${since}&order=created_at.desc&limit=500`);
    try { seen = +(localStorage.getItem(LS_SEEN) || 0); } catch (_) { seen = 0; }
  }

  function digest() {
    const errs = rows.filter((r) => r.kind === 'error' && !r.training);
    const crit = errs.filter((r) => r.severity === 'crit');
    const byType = {};
    errs.forEach((r) => { const k = r.err_type + ' — ' + (r.message || '').slice(0, 60); byType[k] = (byType[k] || 0) + (r.count || 1); });
    const top = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const byBranch = {};
    errs.forEach((r) => { const b = r.branch || '؟'; byBranch[b] = (byBranch[b] || 0) + 1; });
    const users = new Set(errs.map((r) => r.user_name).filter(Boolean));
    const sessions = rows.filter((r) => r.kind === 'session');
    return { errs, crit, top, byBranch, users, sessions };
  }

  function render(root) {
    const d = digest();
    const list = d.errs.filter((r) =>
      (!filt.sev || r.severity === filt.sev) &&
      (!filt.branch || r.branch === filt.branch) &&
      (!filt.page || r.page === filt.page));

    const branches = Array.from(new Set(d.errs.map((r) => r.branch).filter(Boolean)));
    const pages = Array.from(new Set(d.errs.map((r) => r.page).filter(Boolean)));

    root.querySelector('#hp-body').innerHTML = `
      <div class="hp-k">
        <div class="hp-card"><b style="color:${d.crit.length ? '#ff6b78' : '#4ade80'}">${d.crit.length}</b><span>حرج</span></div>
        <div class="hp-card"><b>${d.errs.length}</b><span>إجمالي الأخطاء</span></div>
        <div class="hp-card"><b>${d.users.size}</b><span>مستخدم متأثّر</span></div>
        <div class="hp-card"><b>${d.sessions.length}</b><span>جلسة مسجَّلة</span></div>
      </div>

      <div class="hp-row" style="border-color:#2c3646">
        <div class="hp-t">📊 الأكثر تكراراً (${filt.range === 1 ? 'اليوم' : filt.range + ' أيام'})</div>
        ${d.top.length ? d.top.map(([k, n]) => `<div class="hp-m">• ${esc(k)} <b style="color:#ff9aa4">×${n}</b></div>`).join('') : '<div class="hp-m">لا أخطاء 🎉</div>'}
        ${Object.keys(d.byBranch).length ? `<div class="hp-meta">${Object.entries(d.byBranch).map(([b, n]) => `<span>${esc(b)}: ${n}</span>`).join('')}</div>` : ''}
      </div>

      <div style="display:flex;gap:7px;flex-wrap:wrap;margin:2px 0 4px">
        <select class="hp-sel" id="hp-sev"><option value="">كل الخطورات</option><option value="crit">🔴 حرج</option><option value="warn">🟠 تحذير</option></select>
        <select class="hp-sel" id="hp-br"><option value="">كل الفروع</option>${branches.map((b) => `<option ${filt.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <select class="hp-sel" id="hp-pg"><option value="">كل الصفحات</option>${pages.map((p) => `<option ${filt.page === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      </div>

      ${list.length ? list.map((r) => {
        const isNew = new Date(r.created_at).getTime() > seen;
        return `<div class="hp-row ${r.severity}">
          <div class="hp-top">
            <div class="hp-t">${r.severity === 'crit' ? '🔴' : '🟠'} ${esc(r.err_type)} ${isNew ? '<span class="hp-new">جديد</span>' : ''}</div>
            <div style="font-size:11px;color:#7d8797;font-weight:800;white-space:nowrap">${ago(r.created_at)}</div>
          </div>
          <div class="hp-m">${esc(r.message)}</div>
          ${r.detail ? `<div class="hp-m" style="color:#8b95a4;font-size:11.5px">↳ ${esc(String(r.detail).slice(0, 200))}</div>` : ''}
          <div class="hp-meta">
            <span>👤 ${esc(r.user_name || '—')}</span>
            <span>🏬 ${esc(r.branch || '—')}</span>
            <span>📄 ${esc(r.page || '—')}</span>
            ${r.count > 1 ? `<span>🔁 ×${r.count}</span>` : ''}
            <span>🧭 ${esc(String(r.session_id).slice(0, 8))}</span>
          </div>
        </div>`;
      }).join('') : '<div class="hp-row"><div class="hp-m">لا أخطاء ضمن هذا الفلتر 🎉</div></div>'}
    `;

    root.querySelector('#hp-sev').value = filt.sev;
    root.querySelector('#hp-sev').onchange = (e) => { filt.sev = e.target.value; render(root); };
    root.querySelector('#hp-br').onchange = (e) => { filt.branch = e.target.value; render(root); };
    root.querySelector('#hp-pg').onchange = (e) => { filt.page = e.target.value; render(root); };
  }

  function textReport() {
    const d = digest();
    const L = ['═══ صحة نظام GMT 🩺 ═══',
      'المدى: آخر ' + filt.range + ' يوم · ' + new Date().toLocaleString('ar-SY'),
      `حرج: ${d.crit.length} · إجمالي: ${d.errs.length} · مستخدمون متأثّرون: ${d.users.size}`,
      '── الأكثر تكراراً ──'];
    d.top.forEach(([k, n]) => L.push(`• ${k} ×${n}`));
    L.push('── التفاصيل ──');
    d.errs.slice(0, 60).forEach((r, i) =>
      L.push(`#${i + 1} [${new Date(r.created_at).toLocaleString('ar-SY')}] ${r.severity === 'crit' ? '🔴' : '🟠'} ${r.err_type} · ${r.user_name || '—'} · ${r.branch || '—'} · ${r.page || '—'}\n${r.message}${r.detail ? '\n↳ ' + String(r.detail).slice(0, 200) : ''}`));
    return L.join('\n');
  }

  async function open() {
    styles();
    const ov = document.createElement('div');
    ov.className = 'hp-ov';
    ov.innerHTML = `<div class="hp-w">
      <div class="hp-h">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:900;font-size:16px">🩺 صحة النظام — كل الفروع</div>
          <button class="hp-tab" data-a="close">إغلاق</button>
        </div>
        <div class="hp-tabs">
          <button class="hp-tab on" data-r="1">اليوم</button>
          <button class="hp-tab" data-r="7">الأسبوع</button>
          <button class="hp-tab" data-r="30">الشهر</button>
        </div>
      </div>
      <div class="hp-b" id="hp-body"><div class="hp-row"><div class="hp-m">جارٍ التحميل…</div></div></div>
      <div class="hp-f">
        <button class="hp-btn hp-p" data-a="copy">📋 صدّر تقريراً كاملاً</button>
        <button class="hp-btn hp-s" data-a="seen">✓ علّمت كمقروء</button>
      </div>
    </div>`;
    document.body.appendChild(ov);

    const refresh = async () => {
      try { await load(); render(ov); }
      catch (e) { ov.querySelector('#hp-body').innerHTML = `<div class="hp-row crit"><div class="hp-t">تعذّر التحميل</div><div class="hp-m">${esc(e.message)}</div><div class="hp-m" style="color:#8b95a4">تأكّد أنك شغّلت ملف <b>SCHEMA_00_telemetry.sql</b> بقاعدة البيانات.</div></div>`; }
    };
    await refresh();

    ov.addEventListener('click', async (e) => {
      const r = e.target.closest('[data-r]'), a = e.target.closest('[data-a]');
      if (r) {
        ov.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', x === r));
        filt.range = +r.dataset.r; await refresh(); return;
      }
      if (!a) { if (e.target === ov) ov.remove(); return; }
      if (a.dataset.a === 'close') ov.remove();
      else if (a.dataset.a === 'seen') { try { localStorage.setItem(LS_SEEN, Date.now()); } catch (_) {} a.textContent = '✓ تم'; await refresh(); }
      else if (a.dataset.a === 'copy') {
        const t = textReport();
        try { await navigator.clipboard.writeText(t); a.textContent = '✓ نُسخ — ألصقه بالرسالة'; }
        catch (_) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); a.textContent = '✓ نُسخ'; }
      }
    });
  }

  function mount() {
    if (document.getElementById('gmt-hp-btn')) return;
    const b = document.createElement('button');
    b.id = 'gmt-hp-btn';
    b.textContent = '🩺';
    b.title = 'صحة النظام';
    b.style.cssText = 'position:fixed;bottom:16px;left:78px;z-index:2147482000;width:52px;height:52px;border-radius:50%;background:#0e7490;color:#fff;border:2px solid rgba(255,255,255,.2);font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:Cairo,Arial,sans-serif;';
    b.onclick = open;
    document.body.appendChild(b);
  }

  window.GMTHealthPanel = { open, mount, report: textReport };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
