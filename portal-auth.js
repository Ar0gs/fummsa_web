/**
 * FUMMSA PORTAL — AUTHENTICATION & AUTHORIZATION UTILITIES
 * Depends on: supabase-config.js (included first)
 *
 * Usage on each portal page (inside a <script> at bottom of body):
 *
 *   // Protect page — redirect to login if not authenticated,
 *   // redirect to correct portal if wrong role.
 *   requireAuth(['student']);         // only students allowed
 *   requireAuth(['lecturer','hod']);  // multiple roles allowed
 *   requireAuth();                    // any authenticated user
 */

// ── Route guard ───────────────────────────────────────────────

/**
 * Check that a user is logged in and has one of the allowed roles.
 * If not logged in  → redirect to index.html
 * If wrong role     → redirect to their correct portal
 * If portal locked  → show locked overlay (students only)
 *
 * @param {string[]} [allowedRoles]  - e.g. ['student'] or ['hod','dean']
 * @returns {object|null}            - the user object, or null (with redirect happening)
 */
function requireAuth(allowedRoles) {
  const user = getFummsaUser();

  // Not logged in
  if (!user || !user.id) {
    window.location.replace('index.html');
    return null;
  }

  // Wrong portal for this role
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
    const correctPortal = FUMMSA_ROLE_PORTALS[user.role] || 'index.html';
    window.location.replace(correctPortal);
    return null;
  }

  // Student portal locked check
  if (user.role === 'student' && user.portal_locked) {
    showPortalLockedOverlay(user.lock_reason || 'Your portal access has been restricted.');
    return null;
  }

  return user;
}

/**
 * Refresh user data from Supabase and update sessionStorage.
 * Call on page load (after requireAuth) to ensure fresh data.
 */
async function refreshUserData() {
  const user = getFummsaUser();
  if (!user || !db) return user;

  try {
    const { data: profile } = await db
      .from('portal_users')
      .select(`
        id, email, full_name, role, status, photo_url, phone, last_login,
        student_profiles (
          matric_no, level, portal_locked, lock_reason,
          faculties ( name ),
          departments ( name ),
          programmes ( name )
        ),
        staff_profiles (
          staff_id, rank, specialization,
          faculties ( name ),
          departments ( name )
        )
      `)
      .eq('id', user.profile_id || user.id)
      .single();

    if (profile) {
      const enriched = {
        ...user,
        name:    profile.full_name,
        email:   profile.email,
        role:    profile.role,
        status:  profile.status,
        photoUrl: profile.photo_url,
        ...(profile.student_profiles && {
          matric:       profile.student_profiles.matric_no,
          level:        profile.student_profiles.level,
          faculty:      profile.student_profiles.faculties?.name,
          department:   profile.student_profiles.departments?.name,
          programme:    profile.student_profiles.programmes?.name,
          portal_locked: profile.student_profiles.portal_locked,
          lock_reason:   profile.student_profiles.lock_reason,
        }),
        ...(profile.staff_profiles && {
          staffId:       profile.staff_profiles.staff_id,
          rank:          profile.staff_profiles.rank,
          specialization: profile.staff_profiles.specialization,
          faculty:        profile.staff_profiles.faculties?.name,
          department:     profile.staff_profiles.departments?.name,
        }),
      };
      setFummsaUser(enriched);
      return enriched;
    }
  } catch (err) {
    console.warn('[FUMMSA] Could not refresh user data:', err.message);
  }
  return user;
}


// ── Login ─────────────────────────────────────────────────────

/**
 * Authenticate a user with email/password or matric number.
 * Returns { user, error }
 */
async function fummsaLogin(identifier, password) {
  if (!db) {
    // ── Demo fallback ─────────────────────────────────────────
    return _demoLogin(identifier, password);
  }

  try {
    let email = identifier;

    // If matric number, resolve email first
    if (!identifier.includes('@')) {
      const { data: stuRow, error: stuErr } = await db
        .from('portal_users')
        .select('email')
        .eq('id',
          (await db.from('student_profiles').select('user_id').eq('matric_no', identifier).single()).data?.user_id
        )
        .single();

      if (stuErr || !stuRow) {
        return { user: null, error: 'Matriculation number not found.' };
      }
      email = stuRow.email;
    }

    // Supabase Auth sign-in
    const { data: authData, error: authErr } = await db.auth.signInWithPassword({ email, password });
    if (authErr) {
      return { user: null, error: _friendlyAuthError(authErr.message) };
    }

    // Fetch profile
    const { data: profile } = await db
      .from('portal_users')
      .select('id, full_name, role, status, photo_url')
      .eq('auth_id', authData.user.id)
      .single();

    if (!profile) return { user: null, error: 'Profile not found. Contact support.' };

    if (profile.status === 'pending') {
      await db.auth.signOut();
      return { user: null, error: 'Your account is pending approval by the administrator.' };
    }

    if (profile.status === 'suspended' || profile.status === 'inactive') {
      await db.auth.signOut();
      return { user: null, error: 'Your account has been suspended. Contact the Registrar.' };
    }

    const userData = {
      id:         authData.user.id,
      profile_id: profile.id,
      email,
      name:       profile.full_name,
      role:       profile.role,
      photoUrl:   profile.photo_url,
    };

    setFummsaUser(userData);
    await logActivity('login', 'user', profile.id);

    return { user: userData, error: null };

  } catch (err) {
    return { user: null, error: 'Login failed. Please try again.' };
  }
}

/**
 * Register a new lecturer account (pending approval).
 */
async function fummsaRegisterLecturer(formData) {
  if (!db) {
    return { success: true, error: null }; // demo
  }

  const { firstName, lastName, email, staffId, faculty, department, role, password } = formData;

  try {
    const { data: authData, error: authErr } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: `${firstName} ${lastName}` } },
    });

    if (authErr) return { success: false, error: _friendlyAuthError(authErr.message) };

    // Insert pending profile
    const { error: profileErr } = await db.from('portal_users').insert([{
      auth_id:   authData.user?.id,
      email,
      full_name: `${firstName} ${lastName}`,
      role,
      status:    'pending',
      approved:  false,
    }]);

    if (profileErr) return { success: false, error: 'Profile creation failed: ' + profileErr.message };

    return { success: true, error: null };

  } catch (err) {
    return { success: false, error: 'Registration failed. Please try again.' };
  }
}

/**
 * Log the user out.
 */
async function fummsaLogout() {
  await logActivity('logout');
  clearFummsaSession();
}


// ── Activity logging ──────────────────────────────────────────

async function logActivity(action, entityType = null, entityId = null, details = null) {
  if (!db) return;
  try {
    await db.from('activity_logs').insert([{
      user_id:     getFummsaUser()?.profile_id || null,
      action,
      entity_type: entityType,
      entity_id:   entityId,
      details,
    }]);
  } catch (e) {
    // Non-critical, ignore
  }
}


// ── Portal-locked overlay (students only) ─────────────────────

function showPortalLockedOverlay(reason) {
  const overlay = document.createElement('div');
  overlay.id = 'portalLockedOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(74,10,30,0.95);z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Libre Franklin',system-ui,sans-serif;text-align:center;padding:24px;
  `;
  overlay.innerHTML = `
    <div style="max-width:480px;">
      <div style="font-size:3rem;margin-bottom:16px;">🔒</div>
      <h2 style="font-family:'Source Serif 4',Georgia,serif;font-size:1.6rem;color:white;margin-bottom:12px;">
        Portal Access Restricted
      </h2>
      <p style="font-size:0.9rem;color:rgba(255,255,255,0.7);line-height:1.7;margin-bottom:24px;">
        ${reason}
      </p>
      <p style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin-bottom:28px;">
        Please contact your Head of Department or the Registrar's Office to resolve this restriction.
      </p>
      <button onclick="clearFummsaSession()" style="
        background:#C4922A;color:white;border:none;padding:12px 28px;
        font-family:'Libre Franklin',sans-serif;font-weight:700;font-size:0.82rem;
        letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border-radius:2px;">
        Sign Out
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}


// ── Demo fallback login ───────────────────────────────────────

function _demoLogin(identifier, password) {
  const demos = {
    'superadmin@fummsa.edu.ng': { pass:'FUMMSAadmin#2025', role:'superadmin', name:'Super Administrator' },
    '2023/MED/0042':            { pass:'14052003',         role:'student',    name:'Aisha Bello Muhammad',
                                  matric:'2023/MED/0042', faculty:'Basic Medical Sciences',
                                  department:'Human Anatomy', programme:'MBBS', level:'300', status:'active' },
    'demo.student@fummsa.edu.ng':{ pass:'demo1234',        role:'student',    name:'Aisha Bello Muhammad',
                                  matric:'2023/MED/0042', faculty:'Basic Medical Sciences',
                                  department:'Human Anatomy', programme:'MBBS', level:'300', status:'active' },
    'f.adeyemi@fummsa.edu.ng':  { pass:'demo1234',         role:'lecturer',   name:'Dr. Fatimah Adeyemi' },
    'demo.lecturer@fummsa.edu.ng':{ pass:'demo1234',       role:'lecturer',   name:'Dr. Fatimah Adeyemi' },
    'r.musa@fummsa.edu.ng':     { pass:'demo1234',         role:'hod',        name:'Prof. Rasheed Musa' },
    'a.okonkwo@fummsa.edu.ng':  { pass:'demo1234',         role:'dean',       name:'Prof. Dr. Amaka Okonkwo' },
    'dsa@fummsa.edu.ng':        { pass:'demo1234',         role:'dsa',        name:'Dr. Tunde Akinwale' },
    'vc@fummsa.edu.ng':         { pass:'demo1234',         role:'executive',  name:'Prof. Babatunde Adeyemi-Ogunleye' },
  };

  const entry = demos[identifier];
  if (!entry) return { user: null, error: 'Credentials not found.' };
  if (entry.pass !== password) return { user: null, error: 'Incorrect password.' };

  const userData = { id: 'demo-'+entry.role, email: identifier, ...entry };
  setFummsaUser(userData);
  return { user: userData, error: null };
}


// ── Friendly error messages ───────────────────────────────────

function _friendlyAuthError(msg) {
  if (!msg) return 'An unknown error occurred.';
  if (msg.includes('Invalid login'))   return 'Invalid email or password.';
  if (msg.includes('Email not confirmed')) return 'Please verify your email address first.';
  if (msg.includes('already registered')) return 'This email is already registered.';
  if (msg.includes('Password should'))  return 'Password must be at least 8 characters.';
  return msg;
}
