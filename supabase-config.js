/**
 * FUMMSA PORTAL — SUPABASE CLIENT CONFIGURATION
 * Include this script on every portal page BEFORE portal-auth.js and portal-api.js
 * <script src="supabase-config.js"></script>
 */

// ── Supabase credentials ──────────────────────────────────────
// Replace these with your actual Supabase project values.
const FUMMSA_SUPABASE_URL     = 'https://icjvqrdbaqenmbbldzka.supabase.co';
const FUMMSA_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljanZxcmRiYXFlbm1iYmxkemthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM3MjksImV4cCI6MjA5NTUyOTcyOX0.cMKRoPg110DRwTv4ttlF-sypEBHOm3TjuIUespHwpBM';

// ── Storage keys ──────────────────────────────────────────────
const FUMMSA_SESSION_KEY = 'fummsa_user';

// ── Role → portal file map ────────────────────────────────────
const FUMMSA_ROLE_PORTALS = {
  student:    'portal-student.html',
  lecturer:   'portal-lecturer.html',
  hod:        'portal-hod.html',
  dean:       'portal-dean.html',
  dsa:        'portal-dsa.html',
  executive:  'portal-executive.html',
  superadmin: 'portal-superadmin.html',
};

// ── Initialise Supabase client ────────────────────────────────
let db = null;

(function initSupabase() {
  try {
    if (typeof supabase !== 'undefined') {
      db = supabase.createClient(FUMMSA_SUPABASE_URL, FUMMSA_SUPABASE_ANON_KEY);
      console.info('[FUMMSA] Supabase client ready');
    } else {
      console.warn('[FUMMSA] Supabase library not loaded — running in demo mode');
    }
  } catch (err) {
    console.warn('[FUMMSA] Supabase init failed:', err.message, '— demo mode active');
  }
})();

/**
 * Get the current signed-in user data from sessionStorage.
 * Returns null if not authenticated.
 */
function getFummsaUser() {
  try {
    return JSON.parse(sessionStorage.getItem(FUMMSA_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * Save user data to sessionStorage.
 */
function setFummsaUser(userData) {
  sessionStorage.setItem(FUMMSA_SESSION_KEY, JSON.stringify(userData));
}

/**
 * Clear session and redirect to login.
 */
function clearFummsaSession() {
  sessionStorage.removeItem(FUMMSA_SESSION_KEY);
  if (db) db.auth.signOut().catch(() => {});
  window.location.href = 'index.html';
}
