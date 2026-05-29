# FUMMSA Portal — Deployment Guide

## File List
| File | Purpose |
|------|---------|
| `portal-login.html` | Universal login + lecturer registration |
| `portal-student.html` | Student portal (courses, results, fees, hostel, CBT) |
| `portal-lecturer.html` | Lecturer dashboard (courses, attendance, CA scores, materials) |
| `portal-hod.html` | Head of Department (all lecturer features + student oversight, portal lock) |
| `portal-dean.html` | Dean of Faculty (faculty overview, approvals) |
| `portal-dsa.html` | Division of Student Affairs (hostel, welfare, disciplinary) |
| `portal-executive.html` | University Executives / VC (university-wide overview) |
| `portal-superadmin.html` | Super Admin (all users, approvals, system settings, audit logs) |
| `supabase-config.js` | Supabase credentials + client init |
| `portal-auth.js` | Login, logout, requireAuth(), session management |
| `portal-api.js` | All database API helpers with demo fallback |
| `portal-shared.js` | Shared UI utilities (toast, modals, date formatter) |
| `portal.css` | Shared stylesheet (optional — each page also has inline styles) |

## Deployment Steps

### 1. Supabase Setup (already done)
- SQL schema already executed ✅
- Storage bucket `portal-assets` created ✅

### 2. Create the Super Admin account
In Supabase Dashboard → Authentication → Users → Add User:
- Email: `superadmin@fummsa.edu.ng`
- Password: (set a strong password)

Then in SQL Editor:
```sql
INSERT INTO portal_users (auth_id, email, full_name, role, status, approved)
VALUES (
  '<auth-uid-from-dashboard>',
  'superadmin@fummsa.edu.ng',
  'Super Administrator',
  'superadmin', 'active', true
);
```

### 3. Host the files
Upload all files to any static host — GitHub Pages, Netlify, Vercel, or a plain web server.
All files must be in the **same folder** (they reference each other by relative path).

### 4. Script load order (already in every page)
```html
<script src="supabase-config.js"></script>   <!-- credentials + db client -->
<script src="portal-auth.js"></script>        <!-- requireAuth, fummsaLogin, etc. -->
<script src="portal-api.js"></script>         <!-- all DB API helpers -->
<script src="portal-shared.js"></script>      <!-- toast, modals, utils -->
```

### 5. Demo credentials (while testing without real DB)
| Role | Email / Matric | Password |
|------|---------------|----------|
| Super Admin | `superadmin@fummsa.edu.ng` | `FUMMSAadmin#2025` |
| Student | `2023/MED/0042` | `14052003` |
| Lecturer | `demo.lecturer@fummsa.edu.ng` | `demo1234` |
| HOD | `r.musa@fummsa.edu.ng` | `demo1234` |
| Dean | `a.okonkwo@fummsa.edu.ng` | `demo1234` |
| DSA | `dsa@fummsa.edu.ng` | `demo1234` |
| Executive/VC | `vc@fummsa.edu.ng` | `demo1234` |

### 6. Student Onboarding Flow
1. Registrar creates student account in Supabase Auth
2. Insert row into `portal_users` (role=`student`, status=`active`)  
3. Insert row into `student_profiles` (matric_no, level, faculty_id, etc.)
4. Student logs in with matric number + date-of-birth as default password (DDMMYYYY)

### 7. Lecturer Self-Registration Flow
1. Lecturer fills form on Login page → "Lecturer Registration" tab
2. Account created with status=`pending` in `portal_users`
3. Super Admin approves via `portal-superadmin.html` → Pending Approvals
4. Lecturer receives notification and can log in

## Bug Fixes Applied
- `supabase-config.js` line 32: `FUMMSA_ANON_KEY` → `FUMMSA_SUPABASE_ANON_KEY` ✅
- All portal HTML files now correctly load shared scripts ✅
- `requireAuth(['role'])` added to each portal's init function ✅
- `clearFummsaSession()` used for logout throughout ✅
