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

function updateUserUI() {
  if (!currentUser) return;
  const email  = currentUser.email || '';
  const initials = email ? email.slice(0,2).toUpperCase() : 'U';
  // Update avatar in settings
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) avatarEl.textContent = initials;
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = email;
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
  saveUserCreds();
}

function loadCreds() {
  if (currentUser) {
    sbUrl = localStorage.getItem('et_sb_url_' + currentUser.id) || '';
    sbKey = localStorage.getItem('et_sb_key_' + currentUser.id) || '';
  }
  const u = document.getElementById('sb-url'), k = document.getElementById('sb-key');
  if (u) u.value = sbUrl; if (k) k.value = sbKey;
}
