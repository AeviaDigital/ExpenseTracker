// ── AUTH SUPABASE CONFIG ──────────────────────────────────────────
// Replace with YOUR auth Supabase project credentials
const AUTH_SUPABASE_URL      = 'YOUR_AUTH_SUPABASE_URL';
const AUTH_SUPABASE_ANON_KEY = 'YOUR_AUTH_SUPABASE_ANON_KEY';

// ── CURRENT USER STATE ────────────────────────────────────────────
let currentUser   = null;
let authClient    = null;
let dataClient    = null; // user's own Supabase

// ── INIT AUTH ─────────────────────────────────────────────────────
async function initAuth() {
  // ── GUEST MODE BYPASS ───────────────────────────────────────────
  const isGuest = localStorage.getItem('et_guest_mode') === 'true';
  if (isGuest) {
    currentUser = { id: 'guest', email: 'Guest' };
    showGuestBanner();
    return true;
  }

  // Dynamically import Supabase
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

  authClient = createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY);

  // Check session
  const { data: { session } } = await authClient.auth.getSession();
  if (!session) {
    window.location.href = 'auth.html';
    return false;
  }

  currentUser = session.user;

  // Check setup complete
  const setupDone = localStorage.getItem('et_setup_complete_' + currentUser.id);
  if (!setupDone) {
    window.location.href = 'setup.html';
    return false;
  }

  // Load user's own Supabase credentials
  sbUrl = localStorage.getItem('et_sb_url_' + currentUser.id) || '';
  sbKey = localStorage.getItem('et_sb_key_' + currentUser.id) || '';

  if (sbUrl && sbKey) {
    dataClient = createClient(sbUrl, sbKey);
    // Override sbFetch to use dataClient
    window._dataClient = dataClient;
  }

  // Update UI with user info
  updateUserUI();

  // Listen for auth changes
  authClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'auth.html';
    }
  });

  return true;
}

function showGuestBanner() {
  const banner = document.getElementById('guestBanner');
  if (banner) banner.style.display = 'flex';
}

function exitGuestMode() {
  localStorage.removeItem('et_guest_mode');
  window.location.href = 'auth.html';
}

function updateUserUI() {
  if (!currentUser) return;
  const isGuest = currentUser.id === 'guest';
  const email    = isGuest ? 'Guest Mode' : (currentUser.email || '');
  const initials = isGuest ? '?' : (email ? email.slice(0,2).toUpperCase() : 'U');
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) { avatarEl.textContent = initials; if (isGuest) avatarEl.style.background = '#888'; }
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = email;
  const subEl = document.getElementById('userSub');
  if (subEl) subEl.textContent = isGuest ? 'Local only — sign in to sync' : 'Signed in';
  // Show/hide sign out vs sign up button
  const signOutBtn = document.getElementById('signOutBtn');
  const signUpBtn  = document.getElementById('signUpBtn');
  if (isGuest) {
    if (signOutBtn) signOutBtn.style.display = 'none';
    if (signUpBtn)  signUpBtn.style.display  = 'inline-block';
  } else {
    if (signOutBtn) signOutBtn.style.display = 'inline-block';
    if (signUpBtn)  signUpBtn.style.display  = 'none';
  }
}

async function signOut() {
  if (confirm('Sign out of ExpenseTrack?')) {
    await authClient.auth.signOut();
    window.location.href = 'auth.html';
  }
}

// ── SAVE USER CREDS ───────────────────────────────────────────────
function saveUserCreds() {
  if (!currentUser) return;
  sbUrl = document.getElementById('sb-url')?.value.trim() || '';
  sbKey = document.getElementById('sb-key')?.value.trim() || '';
  localStorage.setItem('et_sb_url_' + currentUser.id, sbUrl);
  localStorage.setItem('et_sb_key_' + currentUser.id, sbKey);
  localStorage.setItem('et_setup_complete_' + currentUser.id, 'true');
}

// ── OVERRIDE saveCreds TO USE USER-SCOPED STORAGE ─────────────────
function saveCreds() {
  if (currentUser?.id === 'guest') return;
  saveUserCreds();
}

function loadCreds() {
  if (currentUser && currentUser.id !== 'guest') {
    sbUrl = localStorage.getItem('et_sb_url_' + currentUser.id) || '';
    sbKey = localStorage.getItem('et_sb_key_' + currentUser.id) || '';
  }
  const u = document.getElementById('sb-url'), k = document.getElementById('sb-key');
  if (u) u.value = sbUrl; if (k) k.value = sbKey;
}
