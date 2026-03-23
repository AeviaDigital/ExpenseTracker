// ── NAVIGATION STATE ─────────────────────────────────────────────
let currentPage = 'dashboard';

// Mobile swipe state
const MOBILE_PAGES = ['dashboard','add','analytics','expenses','settings'];
let mobileIndex   = 0;
let swipeStartX   = 0;
let swipeStartY   = 0;
let isSwiping     = false;

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
  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'expenses') { renderExpenses(); populateExpenseFilters(); }
  else if (currentPage === 'analytics') renderAnalytics();
  else if (currentPage === 'settings') { loadCreds(); updateLastSyncLabel(); }
  else if (currentPage === 'add') {
    document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  }
}

// ── MOBILE SWIPE NAVIGATION ──────────────────────────────────────
function initMobileSwipe() {
  const wrapper = document.getElementById('mobileSwipeWrapper');
  if (!wrapper) return;

  wrapper.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    isSwiping   = false;
  }, { passive: true });

  wrapper.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = e.touches[0].clientY - swipeStartY;
    if (!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      isSwiping = true;
    }
    if (isSwiping) {
      const pct  = (dx / window.innerWidth) * 100;
      const base = -(mobileIndex * 20);
      setMobilePagesTransform(base + pct / 5);
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', e => {
    if (!isSwiping) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const threshold = window.innerWidth * 0.25;
    if (dx < -threshold && mobileIndex < MOBILE_PAGES.length - 1) {
      goToMobilePage(mobileIndex + 1);
    } else if (dx > threshold && mobileIndex > 0) {
      goToMobilePage(mobileIndex - 1);
    } else {
      goToMobilePage(mobileIndex); // snap back
    }
    isSwiping = false;
  }, { passive: true });
}

function setMobilePagesTransform(pct) {
  const track = document.getElementById('mobilePagesTrack');
  if (track) track.style.transform = `translateX(${pct}%)`;
}

function goToMobilePage(index) {
  mobileIndex = Math.max(0, Math.min(index, MOBILE_PAGES.length - 1));
  setMobilePagesTransform(-(mobileIndex * 20));
  currentPage = MOBILE_PAGES[mobileIndex];
  updateMobileIndicator();
  renderCurrentPage();
}

function updateMobileIndicator() {
  document.querySelectorAll('.indicator-dot').forEach((d, i) => {
    d.classList.toggle('active', i === mobileIndex);
  });
  const labels = ['Dashboard','Add Expense','Analytics','Expenses','Settings'];
  const lbl = document.getElementById('mobilePageLabel');
  if (lbl) lbl.textContent = labels[mobileIndex];
  // Update mobile header title per page
  const titles = {
    dashboard: 'Dashboard', add: 'Add Expense', analytics: 'Analytics',
    expenses: 'All Expenses', settings: 'Settings & Sync'
  };
  document.querySelectorAll('.mobile-header-title').forEach(el => {
    el.textContent = titles[currentPage] || '';
  });
}

// ── INIT ─────────────────────────────────────────────────────────
async function init() {
  loadOutlets();
  loadLocal();
  if (expenses.length === 0) seedData();
  loadCreds();

  // Desktop: render dashboard
  renderDashboard();

  // Mobile: set up swipe
  initMobileSwipe();
  goToMobilePage(0);

  // Connect to Supabase if credentials exist
  if (sbUrl && sbKey) {
    setSyncState('syncing');
    const ok = await loadFromSupabase();
    if (ok) {
      setSyncState('synced');
      updateLastSyncLabel();
      renderDashboard();
      // Re-render mobile dashboard too
      if (window.innerWidth <= 768) renderMobileDashboard();
    } else {
      setSyncState('error');
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
