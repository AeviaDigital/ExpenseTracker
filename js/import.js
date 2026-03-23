// ── CSV IMPORT ────────────────────────────────────────────────────
let csvRows = [], csvHeaders = [], mappedRows = [];

const IMPORT_FIELDS = [
  { key:'date',        label:'Date',             required:true  },
  { key:'month',       label:'Month',            required:false },
  { key:'day',         label:'Day',              required:false },
  { key:'item',        label:'Item',             required:false },
  { key:'category',    label:'Category',         required:false },
  { key:'overall_cat', label:'Overall Category', required:false },
  { key:'outlet',      label:'Outlet',           required:true  },
  { key:'paid',        label:'Paid Price',       required:true  },
  { key:'actual',      label:'Actual Price',     required:false },
];

function handleCsvDrag(e)  { e.preventDefault(); document.getElementById('csvUploadZone')?.classList.add('drag'); }
function handleCsvDragLeave() { document.getElementById('csvUploadZone')?.classList.remove('drag'); }
function handleCsvDrop(e)  { e.preventDefault(); document.getElementById('csvUploadZone')?.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) parseCsvFile(f); }
function handleCsvSelect(e) { const f = e.target.files[0]; if (f) parseCsvFile(f); }

function parseCsvFile(file) {
  const r = new FileReader();
  r.onload = e => {
    const result = parseCSV(e.target.result);
    if (!result || result.length < 2) {
      const el = document.getElementById('csvParseStatus');
      if (el) { el.style.display = 'block'; el.textContent = 'Could not read CSV — make sure the file has headers in the first row.'; }
      return;
    }
    csvHeaders = result[0];
    csvRows    = result.slice(1).filter(r => r.some(v => v.trim()));
    const el   = document.getElementById('csvParseStatus');
    if (el) {
      el.style.display = 'block';
      el.innerHTML = `<span style="color:var(--accent)">✓ Loaded <strong>${csvRows.length} rows</strong> with columns: ${csvHeaders.map(h => `<code style="background:var(--surface2);padding:1px 5px;border-radius:3px;font-size:11px">${h}</code>`).join(' ')}</span>`;
    }
    buildMappingUI();
  };
  r.readAsText(file);
}

function parseCSV(text) {
  return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) inQ = true;
      else if (ch === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"' && inQ) inQ = false;
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

function autoMatch(fieldKey, colName) {
  const cn = colName.toLowerCase().replace(/[\s_\-]/g, '');
  const m = {
    date:        ['date','transactiondate','expensedate'],
    month:       ['month'],
    day:         ['day','dayofweek','weekday'],
    item:        ['item','specificitem','product','description'],
    category:    ['category','cat','subcategory','subcat'],
    overall_cat: ['overallcategory','overallcat','maincategory'],
    outlet:      ['outlet','merchant','vendor','store','shop','payee'],
    paid:        ['paidprice','paid','paidamount','amountpaid'],
    actual:      ['actualprice','actual','originalprice','rrp','listprice'],
  };
  return (m[fieldKey] || []).some(x => cn.includes(x));
}

function buildMappingUI() {
  const step2 = document.getElementById('import-step2');
  if (step2) step2.style.display = 'block';
  const opts = ['(skip)', ...csvHeaders];
  const grid = document.getElementById('importMapGrid');
  if (!grid) return;
  grid.innerHTML = IMPORT_FIELDS.map(f => `
    <div class="import-map-row">
      <div class="import-map-label">${f.label}${f.required ? '<span class="import-req">*</span>' : ''}</div>
      <select id="map-${f.key}" onchange="updateImportPreview()">
        ${opts.map(o => `<option value="${o}" ${autoMatch(f.key, o) ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>`).join('');
  updateImportPreview();
}

function getMapping() {
  const m = {};
  IMPORT_FIELDS.forEach(f => { m[f.key] = document.getElementById('map-' + f.key)?.value || '(skip)'; });
  return m;
}

function updateImportPreview() {
  if (!csvRows.length) return;
  const m = getMapping(), s = csvRows[0];
  const get = col => col === '(skip)' ? '—' : (s[csvHeaders.indexOf(col)] || '—');
  const el = document.getElementById('importPreviewRow');
  if (el) el.innerHTML = '<strong style="font-size:11px;color:var(--text3)">Preview — first row:</strong> ' +
    IMPORT_FIELDS.map(f => `<span style="margin-right:12px;font-size:12px"><strong>${f.label}:</strong> ${get(m[f.key])}</span>`).join('');
}

function normaliseDate(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10);
  const dm = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dm) { let [,d,mo,y] = dm; if (y.length===2) y='20'+y; return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`; }
  const dt = new Date(raw);
  return isNaN(dt) ? null : dt.toISOString().slice(0,10);
}

function normaliseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(raw.toString().replace(/[£$€,\s]/g, ''));
  return isNaN(n) ? null : Math.abs(n);
}

function normaliseOverallCat(raw) {
  if (!raw) return 'Other';
  const r = raw.toLowerCase();
  if (r.includes('food')||r.includes('dining')||r.includes('snack')||r.includes('grocer')||r.includes('chip')) return 'Food & Dining';
  if (r.includes('travel')||r.includes('transport')||r.includes('train')||r.includes('bus')||r.includes('fuel')) return 'Travel & Transport';
  if (r.includes('office')||r.includes('work')||r.includes('stationery')) return 'Office/Work';
  if (r.includes('shop')||r.includes('retail')||r.includes('cloth')||r.includes('sport')||r.includes('utensil')) return 'Shopping';
  if (r.includes('util')||r.includes('bill')||r.includes('rent')||r.includes('electric')||r.includes('water')||r.includes('gas')||r.includes('internet')||r.includes('phone')||r.includes('insurance')) return 'Utilities & Bills';
  const exact = OVERALL_CATS.find(c => c.toLowerCase() === r);
  return exact || 'Other';
}

function runImport() {
  const m = getMapping();
  if (m.date   === '(skip)') { toast('Please map the Date column');       return; }
  if (m.outlet === '(skip)') { toast('Please map the Outlet column');     return; }
  if (m.paid   === '(skip)') { toast('Please map the Paid Price column'); return; }

  const get = (row, col) => col === '(skip)' ? '' : (row[csvHeaders.indexOf(col)] || '');

  mappedRows = csvRows.map((row, i) => {
    const rawDate   = get(row, m.date);
    const rawOutlet = get(row, m.outlet);
    const rawPaid   = get(row, m.paid);
    const date      = normaliseDate(rawDate);
    const paid      = normaliseAmount(rawPaid);
    const outlet    = rawOutlet.trim();
    const actual    = normaliseAmount(get(row, m.actual)) ?? paid;
    const overall_cat = m.overall_cat !== '(skip)' ? normaliseOverallCat(get(row, m.overall_cat)) : 'Other';
    const category    = m.category    !== '(skip)' ? get(row, m.category).trim() : '';
    const item        = m.item        !== '(skip)' ? get(row, m.item).trim() : '';
    const rawMonth    = m.month       !== '(skip)' ? get(row, m.month) : '';
    const rawDay      = m.day         !== '(skip)' ? get(row, m.day) : '';
    const fallbackDate = date || new Date().toISOString().slice(0,10);
    const month = rawMonth || deriveMonth(fallbackDate);
    const day   = rawDay   || deriveDay(fallbackDate);

    let status = 'ok', reason = '';
    if (!date)   { status = 'skip'; reason = 'Invalid date: ' + rawDate; }
    else if (!outlet) { status = 'skip'; reason = 'Empty outlet'; }
    else if (paid === null) { status = 'skip'; reason = 'Invalid paid price: ' + rawPaid; }

    return { _row:i+1, date, month, day, item, category, overall_cat, outlet, paid, actual, status, reason };
  });

  const ok   = mappedRows.filter(r => r.status === 'ok');
  const skip = mappedRows.filter(r => r.status === 'skip');

  const subEl = document.getElementById('import-preview-sub');
  if (subEl) subEl.textContent = `${ok.length} rows ready · ${skip.length} will be skipped`;

  const errBox = document.getElementById('import-errors-box');
  if (errBox) errBox.innerHTML = skip.length > 0
    ? `<div style="background:var(--warning-light);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--warning);margin-bottom:10px">
        <strong>${skip.length} rows skipped:</strong> ${skip.slice(0,3).map(r => `Row ${r._row}: ${r.reason}`).join(' · ')}${skip.length > 3 ? ` · +${skip.length-3} more` : ''}
       </div>` : '';

  const tbody = document.getElementById('import-preview-tbody');
  if (tbody) tbody.innerHTML = mappedRows.slice(0, 50).map(r => `
    <tr>
      <td style="font-size:12px;color:var(--text2)">${r.date||'—'}</td>
      <td style="font-size:12px;color:var(--text3)">${r.month}</td>
      <td style="font-size:12px;color:var(--text3)">${r.day}</td>
      <td style="font-weight:500;font-size:12px">${r.outlet||'—'}</td>
      <td>${r.status==='ok' ? catBadge(r.overall_cat) : '—'}</td>
      <td style="font-size:12px;color:var(--text2)">${r.category||'—'}</td>
      <td style="font-size:12px;color:var(--text2)">${r.item||'—'}</td>
      <td class="mono">${r.paid !== null ? fmt(r.paid) : '—'}</td>
      <td class="mono" style="color:var(--text2)">${r.actual !== null ? fmt(r.actual) : '—'}</td>
      <td><span class="row-${r.status}">${r.status==='ok' ? '✓ Ready' : '✗ '+r.reason}</span></td>
    </tr>`).join('') + (mappedRows.length > 50 ? `<tr><td colspan="10" style="text-align:center;color:var(--text3);font-size:12px;padding:10px">…and ${mappedRows.length-50} more rows</td></tr>` : '');

  const step3 = document.getElementById('import-step3');
  if (step3) { step3.style.display = 'block'; step3.scrollIntoView({ behavior:'smooth', block:'start' }); }
}

async function confirmImport() {
  const ok = mappedRows.filter(r => r.status === 'ok');
  if (!ok.length) { toast('No valid rows to import'); return; }

  const btn = document.getElementById('confirmImportBtn');
  if (btn) btn.disabled = true;
  const prog = document.getElementById('import-progress');
  if (prog) prog.style.display = 'block';
  const bar = document.getElementById('import-progress-bar');
  const lbl = document.getElementById('import-progress-label');

  let imported = 0, failed = 0;
  const BATCH = 20;

  for (let i = 0; i < ok.length; i += BATCH) {
    const batch = ok.slice(i, i + BATCH);
    batch.forEach(r => {
      expenses.push({ id: Date.now() + Math.random(), date:r.date, month:r.month, day:r.day, item:r.item, category:r.category, overall_cat:r.overall_cat, outlet:r.outlet, paid:r.paid, actual:r.actual, payment:'Card' });
      addOutlet(r.outlet);
    });
    saveLocal();
    if (sbUrl && sbKey) {
      try {
        await sbFetch('/expenses', { method:'POST', headers:{ Prefer:'return=minimal' }, body: JSON.stringify(batch.map(r => ({ date:r.date, month:r.month, day:r.day, item:r.item, category:r.category, overall_cat:r.overall_cat, outlet:r.outlet, paid_price:r.paid, actual_price:r.actual, payment:'Card' }))) });
        imported += batch.length;
      } catch(e) { failed += batch.length; }
    } else {
      imported += batch.length;
    }
    if (bar) bar.style.width = Math.round(((i + batch.length) / ok.length) * 100) + '%';
    if (lbl) lbl.textContent = `Importing… ${Math.min(i + BATCH, ok.length)} of ${ok.length}`;
    await new Promise(r => setTimeout(r, 30));
  }

  const titleEl = document.getElementById('import-done-title');
  const subEl   = document.getElementById('import-done-sub');
  if (titleEl) titleEl.textContent = 'Import complete!';
  if (subEl) subEl.textContent = sbUrl
    ? `${imported} expenses imported to Supabase${failed > 0 ? ` · ${failed} failed (saved locally)` : ''}`
    : `${imported} expenses saved locally — connect Supabase in Settings to sync across devices.`;

  const step3 = document.getElementById('import-step3');
  const step4 = document.getElementById('import-step4');
  if (step3) step3.style.display = 'none';
  if (step4) { step4.style.display = 'block'; step4.scrollIntoView({ behavior:'smooth', block:'start' }); }
}

function resetImport() {
  csvRows = []; csvHeaders = []; mappedRows = [];
  ['import-step2','import-step3','import-step4','import-progress'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const btn = document.getElementById('confirmImportBtn');
  if (btn) btn.disabled = false;
  const status = document.getElementById('csvParseStatus');
  if (status) status.style.display = 'none';
  const fi = document.getElementById('csvFileInput');
  if (fi) fi.value = '';
}
