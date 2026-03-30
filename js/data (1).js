// ── CONSTANTS ────────────────────────────────────────────────────
const LOCAL_KEY  = 'et_expenses_v3';
const OUTLET_KEY = 'et_outlets_v1';
const CREDS_KEY  = 'et_creds_v1';
const SYNC_KEY   = 'et_last_sync';

const OVERALL_CATS = ['Food & Dining','Travel & Transport','Office/Work','Shopping','Utilities & Bills','Other'];
const DEFAULT_OUTLETS = [
  'Tesco','Sainsbury\'s','ASDA','Lidl','Morrisons','Waitrose','Co-op',
  'Amazon','Argos','B&M','H&M','Sports Direct','Boots','Primark',
  'Costa Coffee','Pret a Manger','McDonald\'s','KFC','Subway','Pizza Hut',
  'National Rail','First Bus','TfL Oyster','Uber','Booking.com',
  'Scottish Power','Wessex Water','British Gas','Voxi','O2','Virgin',
  'DVLA','Admiral','Bristol Council'
];

// ── STATE ────────────────────────────────────────────────────────
let expenses    = [];
let outlets     = [];
let sbUrl       = '';
let sbKey       = '';
let isSyncing   = false;

// ── HELPERS ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function deriveMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return MONTHS[d.getMonth()] + '-' + String(d.getFullYear()).slice(2);
}
function deriveDay(dateStr) {
  if (!dateStr) return '';
  return DAYS[new Date(dateStr + 'T00:00:00').getDay()];
}
function fmt(n)     { return '£' + parseFloat(n || 0).toFixed(2); }
function fmtDate(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }

function catBadge(cat) {
  const m = { 'Food & Dining':'food','Travel & Transport':'travel','Office/Work':'office','Shopping':'shopping','Utilities & Bills':'utilities' };
  return `<span class="badge badge-${m[cat]||'other'}">${cat}</span>`;
}
function savingBadge(paid, actual) {
  const s = (actual || paid) - paid;
  return s > 0.005 ? `<span class="savings-badge">saved £${s.toFixed(2)}</span>` : '<span style="color:var(--text3)">—</span>';
}

// ── OUTLET MANAGEMENT ────────────────────────────────────────────
function loadOutlets() {
  try {
    const d = JSON.parse(localStorage.getItem(OUTLET_KEY));
    outlets = Array.isArray(d) ? d : [...DEFAULT_OUTLETS];
  } catch { outlets = [...DEFAULT_OUTLETS]; }
}
function saveOutlets() { localStorage.setItem(OUTLET_KEY, JSON.stringify(outlets)); }
function addOutlet(name) {
  const n = name.trim();
  if (n && !outlets.find(o => o.toLowerCase() === n.toLowerCase())) {
    outlets.push(n);
    outlets.sort();
    saveOutlets();
    if (sbUrl && sbKey) {
      sbFetch('/outlets', { method:'POST', headers:{ Prefer:'return=minimal' }, body: JSON.stringify({ name:n }) }).catch(() => {});
    }
  }
}
function filterOutlets(val) {
  const drop = document.getElementById('outletDropdown');
  if (!drop) return;
  const q = val.toLowerCase();
  const matches = outlets.filter(o => o.toLowerCase().includes(q));
  drop.innerHTML = matches.map(o => `<div class="outlet-option" onmousedown="selectOutlet('${o.replace(/'/g,"\\'")}')">${o}</div>`).join('');
  if (val && !outlets.find(o => o.toLowerCase() === q)) {
    drop.innerHTML += `<div class="outlet-option new-outlet" onmousedown="selectOutlet('${val.replace(/'/g,"\\'")}', true)">+ Add "${val}"</div>`;
  }
  drop.classList.toggle('open', drop.innerHTML !== '');
}
function selectOutlet(name, isNew) {
  const el = document.getElementById('f-outlet');
  if (el) el.value = name;
  const drop = document.getElementById('outletDropdown');
  if (drop) drop.classList.remove('open');
  if (isNew) addOutlet(name);
}
function openOutletDropdown() {
  const el = document.getElementById('f-outlet');
  if (el) filterOutlets(el.value);
}
function closeOutletDropdown() {
  setTimeout(() => {
    const drop = document.getElementById('outletDropdown');
    if (drop) drop.classList.remove('open');
  }, 150);
}
function buildOutletSelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Outlets</option>' + outlets.map(o => `<option value="${o}">${o}</option>`).join('');
  sel.value = cur;
}

// ── LOCAL STORAGE ────────────────────────────────────────────────
function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify(expenses)); }
function loadLocal() {
  try { const d = JSON.parse(localStorage.getItem(LOCAL_KEY)); if (d) expenses = d; } catch {}
}
function clearLocalData() {
  if (!confirm('Clear local cache? Your Supabase data is safe.')) return;
  localStorage.removeItem(LOCAL_KEY);
  expenses = [];
  toast('Cleared — syncing from Supabase…');
  syncNow();
}

// ── SEED DATA (demo) ─────────────────────────────────────────────
function seedData() {
  const subMap = {
    'Food & Dining':    ['Fruits','Groceries','Snacks','Eating Out','Home Food'],
    'Travel & Transport':['Transport','Fuel','Train','Parking'],
    'Office/Work':      ['Stationery','Equipment','Lunch'],
    'Shopping':         ['Clothes','Electronics','Home','Sports'],
    'Utilities & Bills':['Electricity','Water','Internet','Rent','Insurance'],
    'Other':            ['Miscellaneous']
  };
  const outletList = ['Tesco','Sainsbury\'s','Costa Coffee','National Rail','Scottish Power','Amazon','Lidl','First Bus','Boots','KFC'];
  const itemMap = { 'Fruits':'Apples','Groceries':'Weekly shop','Transport':'Bus ticket','Electricity':'Monthly bill','Clothes':'T-shirts' };
  const now = new Date();
  for (let i = 60; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    if (Math.random() < 0.5) {
      const oc     = OVERALL_CATS[Math.floor(Math.random() * OVERALL_CATS.length)];
      const cat    = subMap[oc][Math.floor(Math.random() * subMap[oc].length)];
      const outlet = outletList[Math.floor(Math.random() * outletList.length)];
      const actual = parseFloat((Math.random() * 80 + 2).toFixed(2));
      const paid   = parseFloat((actual * (0.85 + Math.random() * 0.15)).toFixed(2));
      const dateStr = d.toISOString().slice(0, 10);
      expenses.push({
        id: Date.now() + i,
        date: dateStr, month: deriveMonth(dateStr), day: deriveDay(dateStr),
        item: itemMap[cat] || '', category: cat, overall_cat: oc,
        outlet, paid, actual,
        payment: ['Card','Cash','Direct Debit'][Math.floor(Math.random() * 3)]
      });
    }
  }
  saveLocal();
}

// ── SUPABASE ─────────────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  if (!sbUrl || !sbKey) return null;
  const url = sbUrl.replace(/\/$/, '') + '/rest/v1' + path;
  const customHeaders = {
    'apikey': sbKey,
    'Authorization': 'Bearer ' + sbKey,
    'Content-Type': 'application/json'
  };
  if (options.headers?.Prefer) customHeaders['Prefer'] = options.headers.Prefer;
  const { headers: _h, ...restOptions } = options;
  const res = await fetch(url, { ...restOptions, headers: customHeaders });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function loadFromSupabase() {
  try {
    const [data, outletData] = await Promise.all([
      sbFetch('/expenses?order=date.desc&select=*'),
      sbFetch('/outlets?select=name&order=name.asc')
    ]);
    if (data) {
      expenses = data.map(r => ({
        id: r.id, date: r.date,
        month: r.month || deriveMonth(r.date),
        day:   r.day   || deriveDay(r.date),
        item: r.item || '', category: r.category || '',
        overall_cat: r.overall_cat, outlet: r.outlet,
        paid: parseFloat(r.paid_price),
        actual: parseFloat(r.actual_price || r.paid_price),
        payment: r.payment || 'Card'
      }));
      saveLocal();
    }
    if (outletData) {
      outletData.forEach(o => { if (!outlets.find(x => x.toLowerCase() === o.name.toLowerCase())) outlets.push(o.name); });
      outlets.sort(); saveOutlets();
    }
    return true;
  } catch(e) { console.warn('Supabase load:', e.message); return false; }
}

async function saveToSupabase(exp) {
  if (!sbUrl || !sbKey) return false;
  try {
    const r = await sbFetch('/expenses', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        date: exp.date, month: exp.month, day: exp.day,
        item: exp.item, category: exp.category, overall_cat: exp.overall_cat,
        outlet: exp.outlet, paid_price: exp.paid, actual_price: exp.actual, payment: exp.payment
      })
    });
    if (r?.[0]) exp.id = r[0].id;
    return true;
  } catch(e) { console.warn('Supabase save:', e.message); return false; }
}

async function deleteFromSupabase(id) {
  if (!sbUrl || !sbKey) return;
  try { await sbFetch('/expenses?id=eq.' + id, { method: 'DELETE' }); } catch(e) {}
}

async function testConnection() {
  sbUrl = document.getElementById('sb-url').value.trim();
  sbKey = document.getElementById('sb-key').value.trim();
  if (!sbUrl || !sbKey) { toast('Please enter your Project URL and Anon Key'); return; }
  // Save immediately so syncNow can use them
  saveCreds();
  try {
    setSyncState('syncing');
    await sbFetch('/expenses?limit=1&select=id');
    setSyncState('synced');
    toast('Connected! Syncing…');
    await syncNow();
  } catch(e) {
    setSyncState('error');
    console.error('Connection error:', e.message);
    toast('Connection failed: ' + e.message.slice(0, 80));
  }
}

async function syncNow() {
  if (!sbUrl || !sbKey) { toast('Add Supabase credentials in Settings first'); return; }
  if (isSyncing) return;
  isSyncing = true; setSyncState('syncing');
  const btn = document.getElementById('syncBtn');
  if (btn) btn.innerHTML = '<span class="spinner"></span>Syncing…';
  try {
    const ok = await loadFromSupabase();
    if (ok) {
      setSyncState('synced');
      localStorage.setItem(SYNC_KEY, new Date().toISOString());
      updateLastSyncLabel();
      renderCurrentPage();
      toast('Synced successfully');
    } else setSyncState('error');
  } catch { setSyncState('error'); }
  finally {
    isSyncing = false;
    if (btn) btn.textContent = 'Sync Now';
  }
}

function setSyncState(s) {
  document.querySelectorAll('.sync-dot').forEach(d => {
    d.className = 'sync-dot ' + (s === 'synced' ? 'synced' : s === 'syncing' ? 'syncing' : s === 'error' ? 'error' : '');
  });
  const label = s === 'synced' ? 'Synced' : s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Sync error' : 'Not connected';
  ['sidebarSyncLabel','settingsSyncLabel','mobileSyncLabel'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = label;
  });
  const cb = document.getElementById('connectedBadge');
  if (cb) cb.style.display = s === 'synced' ? 'inline-block' : 'none';
}

// saveCreds and loadCreds are defined in auth.js (user-scoped)
function updateLastSyncLabel() {
  const el = document.getElementById('lastSyncLabel'); if (!el) return;
  const ts = localStorage.getItem(SYNC_KEY);
  if (ts) el.textContent = 'Last synced: ' + new Date(ts).toLocaleString('en-GB');
}

// ── EXPORT ───────────────────────────────────────────────────────
function exportCSV() {
  const headers = ['Date','Month','Day','Item','Category','Overall Category','Outlet','Paid Price','Actual Price','Payment'];
  const rows = expenses.map(e => [
    e.date, e.month, e.day,
    `"${e.item||''}"`, `"${e.category||''}"`, e.overall_cat,
    `"${e.outlet}"`, e.paid.toFixed(2), (e.actual||e.paid).toFixed(2), e.payment
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
  a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported — matches your Day Wise column format');
}

// ── TOAST ────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
