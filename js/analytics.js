// ── ANALYTICS ────────────────────────────────────────────────────
let analyticsPeriod = 'month';
let anOvCI, anSubCI, pvaCI, dowCI, cumCI, outCI;

function setAnalyticsPeriod(p, el) {
  analyticsPeriod = p;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAnalytics();
}

function getByPeriod() {
  const now = new Date();
  return expenses.filter(e => {
    const d = new Date(e.date);
    if (analyticsPeriod === 'month')   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (analyticsPeriod === 'quarter') return Math.floor(d.getMonth()/3) === Math.floor(now.getMonth()/3) && d.getFullYear() === now.getFullYear();
    if (analyticsPeriod === 'year')    return d.getFullYear() === now.getFullYear();
    return true;
  });
}

function renderAnalytics() {
  const data    = getByPeriod();
  const tPaid   = data.reduce((s,e) => s + e.paid, 0);
  const tActual = data.reduce((s,e) => s + (e.actual || e.paid), 0);
  const tSaved  = tActual - tPaid;
  const days    = [...new Set(data.map(e => e.date))].length;
  const topOut  = Object.entries(data.reduce((a,e) => { a[e.outlet] = (a[e.outlet]||0) + e.paid; return a; }, {})).sort((a,b) => b[1]-a[1])[0];

  // Insights
  const ig = document.getElementById('insights-grid');
  if (ig) {
    ig.innerHTML = `
      <div class="insight-card"><div class="insight-title">Total Paid</div><div class="insight-value">${fmt(tPaid)}</div><div class="insight-sub">${data.length} transactions</div></div>
      <div class="insight-card"><div class="insight-title">Total Actual</div><div class="insight-value">${fmt(tActual)}</div><div class="insight-sub">original prices</div></div>
      <div class="insight-card" style="border-left:3px solid var(--warning)"><div class="insight-title">Total Saved</div><div class="insight-value" style="color:var(--warning)">${fmt(tSaved)}</div><div class="insight-sub">Actual − Paid</div></div>
      <div class="insight-card"><div class="insight-title">Daily Average</div><div class="insight-value">${fmt(days ? tPaid/days : 0)}</div><div class="insight-sub">Paid · ${days} active days</div></div>`;
  }

  if (data.length === 0) {
    ['anOvCatChart','anSubCatChart','paidVsActualChart','dowChart','cumulChart','outletChart'].forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) {
        const parent = canvas.parentElement;
        parent.innerHTML = `<div class="empty-state" style="padding:30px">
          <div class="empty-icon" style="font-size:28px">📊</div>
          <div style="font-size:13px;color:var(--text3)">No data for this period</div>
        </div>`;
      }
    });
    return;
  }

  const pal = ['#2d9e70','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#6b7280'];

  // Overall Category donut
  const ovT = {};
  data.forEach(e => { ovT[e.overall_cat] = (ovT[e.overall_cat]||0) + e.paid; });
  const ovL = Object.keys(ovT).sort((a,b) => ovT[b]-ovT[a]);
  if (anOvCI) anOvCI.destroy();
  const ovCanvas = document.getElementById('anOvCatChart');
  if (ovCanvas) anOvCI = new Chart(ovCanvas, {
    type:'pie', data:{ labels:ovL, datasets:[{ data:ovL.map(k=>ovT[k]), backgroundColor:pal, borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{size:11}, color:'#888' } } } }
  });

  // Sub-category bar
  const subT = {};
  data.forEach(e => { if (e.category) subT[e.category] = (subT[e.category]||0) + e.paid; });
  const subL = Object.keys(subT).sort((a,b) => subT[b]-subT[a]).slice(0, 10);
  if (anSubCI) anSubCI.destroy();
  const subCanvas = document.getElementById('anSubCatChart');
  if (subCanvas) anSubCI = new Chart(subCanvas, {
    type:'bar', indexAxis:'y',
    data:{ labels:subL, datasets:[{ data:subL.map(k=>subT[k]), backgroundColor:'#3b82f640', borderColor:'#3b82f6', borderWidth:2, borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ callback:v=>'£'+v, color:'#888', font:{size:11} }, grid:{ color:'rgba(0,0,0,0.05)' } }, y:{ ticks:{ color:'#888', font:{size:11} }, grid:{ display:false } } } }
  });

  // Paid vs Actual grouped bar
  const pvaLabels = OVERALL_CATS.filter(c => data.some(e => e.overall_cat === c));
  const pvaPaid   = pvaLabels.map(c => parseFloat(data.filter(e => e.overall_cat===c).reduce((s,e) => s+e.paid, 0).toFixed(2)));
  const pvaActual = pvaLabels.map(c => parseFloat(data.filter(e => e.overall_cat===c).reduce((s,e) => s+(e.actual||e.paid), 0).toFixed(2)));
  if (pvaCI) pvaCI.destroy();
  const pvaCanvas = document.getElementById('paidVsActualChart');
  if (pvaCanvas) pvaCI = new Chart(pvaCanvas, {
    type:'bar',
    data:{ labels:pvaLabels, datasets:[
      { label:'Paid Price',   data:pvaPaid,   backgroundColor:'#2d9e7060', borderColor:'#2d9e70', borderWidth:2, borderRadius:4 },
      { label:'Actual Price', data:pvaActual, backgroundColor:'#f59e0b40', borderColor:'#f59e0b', borderWidth:2, borderRadius:4 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ boxWidth:10, font:{size:11}, color:'#888' } } }, scales:{ y:{ ticks:{ callback:v=>'£'+v, color:'#888', font:{size:11} }, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ ticks:{ color:'#888', font:{size:11} }, grid:{ display:false } } } }
  });

  // Day of week
  const dow  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dowT = new Array(7).fill(0);
  data.forEach(e => { const d = new Date(e.date+'T00:00:00'); dowT[(d.getDay()+6)%7] += e.paid; });
  if (dowCI) dowCI.destroy();
  const dowCanvas = document.getElementById('dowChart');
  if (dowCanvas) dowCI = new Chart(dowCanvas, {
    type:'bar',
    data:{ labels:dow, datasets:[{ data:dowT, backgroundColor:dowT.map((_,i)=>i>=5?'#ec489960':'#3b82f660'), borderColor:dowT.map((_,i)=>i>=5?'#ec4899':'#3b82f6'), borderWidth:2, borderRadius:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:v=>'£'+v, color:'#888', font:{size:11} }, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ ticks:{ color:'#888', font:{size:11} }, grid:{ display:false } } } }
  });

  // Cumulative line
  const sorted = [...data].sort((a,b) => a.date.localeCompare(b.date));
  let cum = 0;
  const cD = [], cV = [];
  sorted.forEach(e => { cum += e.paid; cD.push(fmtDate(e.date)); cV.push(parseFloat(cum.toFixed(2))); });
  if (cumCI) cumCI.destroy();
  const cumCanvas = document.getElementById('cumulChart');
  if (cumCanvas) cumCI = new Chart(cumCanvas, {
    type:'line',
    data:{ labels:cD, datasets:[{ data:cV, borderColor:'#2d9e70', backgroundColor:'#2d9e7020', fill:true, tension:0.3, pointRadius:2, pointHoverRadius:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:v=>'£'+v, color:'#888', font:{size:11} }, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ ticks:{ maxTicksLimit:8, color:'#888', font:{size:11} }, grid:{ display:false } } } }
  });

  // Top outlets
  const oT = Object.entries(data.reduce((a,e) => { a[e.outlet] = (a[e.outlet]||0)+e.paid; return a; }, {})).sort((a,b) => b[1]-a[1]).slice(0, 10);
  if (outCI) outCI.destroy();
  const outCanvas = document.getElementById('outletChart');
  if (outCanvas) {
    const oH = Math.max(oT.length * 38 + 60, 200);
    outCanvas.parentElement.style.height = oH + 'px';
    outCI = new Chart(outCanvas, {
      type:'bar', indexAxis:'y',
      data:{ labels:oT.map(m=>m[0]), datasets:[{ data:oT.map(m=>m[1]), backgroundColor:'#8b5cf640', borderColor:'#8b5cf6', borderWidth:2, borderRadius:4 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ callback:v=>'£'+v, color:'#888', font:{size:11} }, grid:{ color:'rgba(0,0,0,0.05)' } }, y:{ ticks:{ color:'#888', font:{size:12} }, grid:{ display:false } } } }
    });
  }
}
