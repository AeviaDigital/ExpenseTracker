// ── ADD EXPENSE ──────────────────────────────────────────────────
let scannedData = null;

async function submitExpense() {
  const outlet = document.getElementById('f-outlet').value.trim();
  const paid   = parseFloat(document.getElementById('f-paid').value);
  const date   = document.getElementById('f-date').value;
  if (!outlet)       { toast('Please enter an Outlet'); return; }
  if (!date)         { toast('Please select a Date'); return; }
  if (isNaN(paid))   { toast('Please enter a valid Paid Price'); return; }

  addOutlet(outlet);

  const exp = {
    id: Date.now(),
    date, month: deriveMonth(date), day: deriveDay(date),
    item:        document.getElementById('f-item').value.trim(),
    category:    document.getElementById('f-category').value.trim(),
    overall_cat: document.getElementById('f-overall-cat').value,
    outlet, paid,
    actual: parseFloat(document.getElementById('f-actual').value) || paid,
    payment: document.getElementById('f-payment').value
  };

  expenses.unshift(exp);
  saveLocal();
  clearForm();
  toast('Expense saved' + (sbUrl ? ' — syncing…' : ' locally'));
  const ok = await saveToSupabase(exp);
  if (ok) toast('Expense saved & synced ✓');
}

function clearForm() {
  ['f-outlet','f-paid','f-actual','f-item','f-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('f-overall-cat').value = 'Food & Dining';
  document.getElementById('f-payment').value = 'Card';
  hideScanResult();
  const prev = document.getElementById('receiptPreview');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  const ocr = document.getElementById('ocrStatus');
  if (ocr) ocr.classList.remove('show');
  scannedData = null;
}

// ── RECEIPT SCAN — improved ───────────────────────────────────────
function handleDrag(e)  { e.preventDefault(); document.getElementById('uploadZone')?.classList.add('drag'); }
function handleDragLeave() { document.getElementById('uploadZone')?.classList.remove('drag'); }
function handleDrop(e)  { e.preventDefault(); document.getElementById('uploadZone')?.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) processFile(f); }
function handleFileSelect(e) { const f = e.target.files[0]; if (f) processFile(f); }

async function processFile(file) {
  // Show preview
  if (file.type.startsWith('image/')) {
    const prev = document.getElementById('receiptPreview');
    const reader = new FileReader();
    reader.onload = e => { prev.src = e.target.result; prev.style.display = 'block'; };
    reader.readAsDataURL(file);
  }

  // Show loading skeleton
  const ocr = document.getElementById('ocrStatus');
  if (ocr) ocr.classList.add('show');
  hideScanResult();

  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            ...(file.type.startsWith('image/') ? [{ type:'image', source:{ type:'base64', media_type:file.type, data:b64 } }] : []),
            { type: 'text', text: `Extract expense details from this receipt. Return ONLY valid JSON with confidence scores (0-1):
{
  "outlet": "store name",
  "outlet_conf": 0.95,
  "paid": 12.50,
  "paid_conf": 0.99,
  "actual": 15.00,
  "actual_conf": 0.80,
  "date": "YYYY-MM-DD",
  "date_conf": 0.90,
  "overall_cat": "Food & Dining|Travel & Transport|Office/Work|Shopping|Utilities & Bills|Other",
  "overall_cat_conf": 0.85,
  "category": "sub-category e.g. Groceries",
  "category_conf": 0.75,
  "item": "specific item if visible",
  "item_conf": 0.60
}
Today: ${new Date().toISOString().slice(0,10)}. If no discount, actual equals paid. Amounts in GBP numbers only.` }
          ]
        }]
      })
    });

    const data = await res.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    const match = text.match(/\{[\s\S]*\}/);

    if (match) {
      scannedData = JSON.parse(match[0]);
      showScanResult(scannedData);
    } else {
      toast('Could not extract details — please fill in manually');
    }
  } catch(e) {
    toast('AI extraction failed — please fill in manually');
    console.error(e);
  } finally {
    if (ocr) ocr.classList.remove('show');
  }
}

function confClass(val) {
  if (!val || val >= 0.85) return 'high';
  if (val >= 0.6)           return 'medium';
  return 'low';
}
function confLabel(val) {
  if (!val || val >= 0.85) return 'High confidence';
  if (val >= 0.6)           return 'Medium confidence — verify';
  return 'Low confidence — please check';
}

function showScanResult(d) {
  const el = document.getElementById('scanResult');
  if (!el) return;
  el.style.display = 'block';

  const fields = [
    { key:'outlet',      label:'Outlet',           conf: d.outlet_conf,      val: d.outlet || '',      type:'text' },
    { key:'paid',        label:'Paid Price (£)',    conf: d.paid_conf,        val: d.paid || '',        type:'number' },
    { key:'actual',      label:'Actual Price (£)',  conf: d.actual_conf,      val: d.actual || '',      type:'number' },
    { key:'date',        label:'Date',              conf: d.date_conf,        val: d.date || '',        type:'date' },
    { key:'overall_cat', label:'Overall Category',  conf: d.overall_cat_conf, val: d.overall_cat || '', type:'select-overall' },
    { key:'category',    label:'Category',          conf: d.category_conf,    val: d.category || '',    type:'text' },
    { key:'item',        label:'Item',              conf: d.item_conf,        val: d.item || '',        type:'text' },
  ];

  const grid = document.getElementById('scanFieldsGrid');
  if (!grid) return;

  grid.innerHTML = fields.map(f => `
    <div class="scan-field-item">
      <div class="scan-field-label">
        <span class="confidence ${confClass(f.conf)}" title="${confLabel(f.conf)}"></span>
        ${f.label}
      </div>
      ${f.type === 'select-overall'
        ? `<select class="scan-field-input" id="sf-${f.key}">
            ${OVERALL_CATS.map(c => `<option value="${c}" ${c===f.val?'selected':''}>${c}</option>`).join('')}
           </select>`
        : `<input type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}"
              class="scan-field-input" id="sf-${f.key}"
              value="${f.val}" step="${f.type==='number'?'0.01':''}">`
      }
    </div>`).join('');
}

function hideScanResult() {
  const el = document.getElementById('scanResult');
  if (el) el.style.display = 'none';
}

function applyScanned() {
  const fields = ['outlet','paid','actual','date','overall_cat','category','item'];
  const formMap = {
    outlet:'f-outlet', paid:'f-paid', actual:'f-actual', date:'f-date',
    overall_cat:'f-overall-cat', category:'f-category', item:'f-item'
  };
  fields.forEach(key => {
    const scanEl = document.getElementById('sf-' + key);
    const formEl = document.getElementById(formMap[key]);
    if (scanEl && formEl) formEl.value = scanEl.value;
  });
  const outlet = document.getElementById('f-outlet')?.value;
  if (outlet) addOutlet(outlet);
  toast('Receipt details applied — review and save');
}

function rescan() {
  hideScanResult();
  const fileInput = document.getElementById('fileInput');
  if (fileInput) { fileInput.value = ''; fileInput.click(); }
}
