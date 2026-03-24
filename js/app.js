// ── NAVIGATION STATE ─────────────────────────────────────────────
let currentPage = 'dashboard';

const MOBILE_PAGES = ['dashboard','add','analytics','expenses','settings'];
let mobileIndex = 0;
let swipeStartX = 0, swipeStartY = 0, isSwiping = false;

// ── DESKTOP NAVIGATION ───────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes("'" + id + "'")) n.classList.add('active');
  });
  currentPage = id;
  renderCurrentPage();
}

function renderCurrentPage() {
  if (currentPage === 'dashboard')  renderDashboard();
  else if (currentPage === 'expenses') { renderExpenses(); populateExpenseFilters(); }
  else if (currentPage === 'analytics') renderAnalytics();
  else if (currentPage === 'settings') { loadCreds(); updateLastSyncLabel(); updateUserUI(); }
  else if (currentPage === 'add') {
    document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  }
}

// ── MOBILE SWIPE ─────────────────────────────────────────────────
function initMobileSwipe() {
  const wrapper = document.getElementById('mobileSwipeWrapper');
  if (!wrapper) return;
  wrapper.addEventListener('touchstart', e => { swipeStartX = e.touches[0].clientX; swipeStartY = e.touches[0].clientY; isSwiping = false; }, { passive:true });
  wrapper.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - swipeStartX, dy = e.touches[0].clientY - swipeStartY;
    if (!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) isSwiping = true;
    if (isSwiping) setMobilePagesTransform(-(mobileIndex*20) + (dx/window.innerWidth)*100/5);
  }, { passive:true });
  wrapper.addEventListener('touchend', e => {
    if (!isSwiping) return;
    const dx = e.changedTouches[0].clientX - swipeStartX, threshold = window.innerWidth * 0.25;
    if (dx < -threshold && mobileIndex < MOBILE_PAGES.length-1) goToMobilePage(mobileIndex+1);
    else if (dx > threshold && mobileIndex > 0) goToMobilePage(mobileIndex-1);
    else goToMobilePage(mobileIndex);
    isSwiping = false;
  }, { passive:true });
}

function setMobilePagesTransform(pct) {
  const track = document.getElementById('mobilePagesTrack');
  if (track) track.style.transform = `translateX(${pct}%)`;
}

function goToMobilePage(index) {
  mobileIndex = Math.max(0, Math.min(index, MOBILE_PAGES.length-1));
  setMobilePagesTransform(-(mobileIndex*20));
  currentPage = MOBILE_PAGES[mobileIndex];
  updateMobileIndicator();
  renderCurrentPage();
}

function updateMobileIndicator() {
  document.querySelectorAll('.indicator-dot').forEach((d,i) => d.classList.toggle('active', i===mobileIndex));
  const labels = ['Dashboard','Add Expense','Analytics','Expenses','Settings'];
  const lbl = document.getElementById('mobilePageLabel');
  if (lbl) lbl.textContent = labels[mobileIndex];
}

// ── INIT ─────────────────────────────────────────────────────────
async function init() {
  // Auth guard — must pass before anything else
  const authed = await initAuth();
  if (!authed) return;

  loadOutlets();
  loadLocal();
  // Don't seed demo data for real users
  loadCreds();

  renderDashboard();
  initMobileSwipe();
  goToMobilePage(0);

  if (sbUrl && sbKey) {
    setSyncState('syncing');
    const ok = await loadFromSupabase();
    if (ok) { setSyncState('synced'); updateLastSyncLabel(); renderDashboard(); if (window.innerWidth <= 768) renderMobileDashboard(); }
    else setSyncState('error');
  }
}

document.addEventListener('DOMContentLoaded', init);
