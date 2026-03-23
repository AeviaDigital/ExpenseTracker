// ── DASHBOARD ────────────────────────────────────────────────────
let catCI, trendCI, mobileCatCI, mobileTrendCI;

function renderDashboard() {
  _renderDashboardInto(
    'stat-month','stat-month-count','stat-year','stat-year-count',
    'stat-saved','stat-avg','dash-period',
    'catChart','trendChart','recent-tbody'
  );
  // Also render mobile dashboard if it exists
  renderMobileDashboard();
}

function renderMobileDashboard() {
  _renderDashboardInto(
    'm-stat-month','m-stat-month-count','m-stat-year','m-stat-year-count',
    'm-stat-saved','m-stat-avg','m-dash-period',
    'mCatChart','mTrendChart','m-recent-tbody'
  );
}

function _renderDashboardInto(
  idMonth,idMonthCount,idYear,idYearCount,
  idSaved,idAvg,idPeriod,
  idCatChart,idTrendChart,idRecentTbody
) {
  const now = new Date(), ym = now.toISOString().slice(0,7), yr = now.getFullYear().toString();
  const thisMonth = expenses.filter(e => e.date.startsWith(ym));
  const thisYear  = expenses.filter(e => e.date.startsWith(yr));
  const mPaid     = thisMonth.reduce((s,e) => s + e.paid, 0);
  const mActual   = thisMonth.reduce((s,e) => s + (e.actual || e.paid), 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl(idMonth,      fmt(mPaid));
  setEl(idMonthCount, thisMonth.length + ' expenses');
  setEl(idYear,       fmt(thisYear.reduce((s,e) => s + e.paid, 0)));
  setEl(idYearCount,  thisYear.length + ' expenses');
  setEl(idSaved,      fmt(mActual - mPaid));
  setEl(idAvg,        fmt(mPaid / Math.max(now.getDate(), 1)));
  setEl(idPeriod,     'Overview · ' + now.toLocaleDateString('en-GB', { month:'long', year:'numeric' }));

  // Category donut
  const catT = {};
  thisMonth.forEach(e => { catT[e.overall_cat] = (catT[e.overall_cat] || 0) + e.paid; });
  const cL  = Object.keys(catT);
  const pal = ['#2d9e70','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#6b7280'];
  const catCanvas = document.getElementById(idCatChart);
  if (catCanvas) {
    if (idCatChart === 'catChart') { if (catCI) catCI.destroy(); }
    else { if (mobileCatCI) mobileCatCI.destroy(); }
    const inst = new Chart(catCanvas, {
      type: 'doughnut',
      data: { labels: cL, datasets: [{ data: cL.map(k => catT[k]), backgroundColor: pal, borderWidth: 0, hoverOffset: 6 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ boxWidth:10, font:{size:11}, color:'#888' } } }, cutout:'65%' }
    });
    if (idCatChart === 'catChart') catCI = inst; else mobileCatCI = inst;
  }

  // Trend bar
  const months = [], mAmts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(MONTHS[d.getMonth()]);
    mAmts.push(expenses.filter(e => e.date.startsWith(d.toISOString().slice(0,7))).reduce((s,e) => s + e.paid, 0));
  }
  const trendCanvas = document.getElementById(idTrendChart);
  if (trendCanvas) {
    if (idTrendChart === 'trendChart') { if (trendCI) trendCI.destroy(); }
    else { if (mobileTrendCI) mobileTrendCI.destroy(); }
    const inst = new Chart(trendCanvas, {
      type: 'bar',
      data: { labels: months, datasets: [{ data: mAmts, backgroundColor:'#2d9e7033', borderColor:'#2d9e70', borderWidth:2, borderRadius:6 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback: v => '£'+v, color:'#888', font:{size:11} }, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ ticks:{ color:'#888', font:{size:11} }, grid:{ display:false } } } }
    });
    if (idTrendChart === 'trendChart') trendCI = inst; else mobileTrendCI = inst;
  }

  // Recent table
  const tbody = document.getElementById(idRecentTbody);
  if (!tbody) return;
  const recent = [...expenses].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 8);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">No expenses yet</div>
        <div class="empty-sub">Add your first expense or import your CSV to get started</div>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(e => `
    <tr>
      <td class="date-cell">
        <span>${fmtDate(e.date)}</span>
        <div class="date-tooltip">${e.day}, ${e.month}</div>
      </td>
      <td style="font-weight:500">${e.outlet}</td>
      <td>${catBadge(e.overall_cat)}</td>
      <td class="mono">${fmt(e.paid)}</td>
      <td class="mono" style="color:var(--text2)">${fmt(e.actual)}</td>
      <td>${savingBadge(e.paid, e.actual)}</td>
    </tr>`).join('');
}
