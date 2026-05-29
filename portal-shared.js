/**
 * FUMMSA PORTAL — SHARED UTILITIES  (portal-shared.js)
 * =====================================================
 * Load order on every portal page:
 *   1. supabase CDN script
 *   2. supabase-config.js
 *   3. portal-auth.js
 *   4. portal-api.js
 *   5. portal-shared.js   ← this file
 *   6. page-specific inline <script>
 */

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */

let _toastTimer = null;

/**
 * Show a toast message.
 * @param {string} msg
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration  ms (default 4000)
 */
function showToast(msg, type = 'info', duration = 4000) {
  let t = document.getElementById('portalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'portalToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  clearTimeout(_toastTimer);
  t.textContent = msg;
  t.className = `toast ${type} show`;
  _toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ═══════════════════════════════════════════════════════════════
   MODAL HELPERS
   ═══════════════════════════════════════════════════════════════ */

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR / NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Switch the active page section and sidebar highlight.
 * Every portal page uses:   <div class="page-section" id="sec-NAME">
 * And sidebar links:        <div class="sb-link" data-section="NAME">
 */
function showSection(name) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sb-link[data-section]').forEach(l => l.classList.remove('active'));

  const sec = document.getElementById(`sec-${name}`);
  if (sec) sec.classList.add('active');

  const link = document.querySelector(`.sb-link[data-section="${name}"]`);
  if (link) link.classList.add('active');

  // Close mobile sidebar
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';

  // Fire optional page-specific loader
  if (typeof window[`onShow_${name}`] === 'function') {
    window[`onShow_${name}`]();
  }
}

/**
 * Bootstrap sidebar toggle and navigation links.
 * Call once on DOMContentLoaded.
 */
function initSidebar() {
  // Hamburger toggle
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // Wire sidebar links
  document.querySelectorAll('.sb-link[data-section]').forEach(link => {
    link.addEventListener('click', () => showSection(link.dataset.section));
  });
}

/* ═══════════════════════════════════════════════════════════════
   TOPBAR USER DISPLAY
   ═══════════════════════════════════════════════════════════════ */

/**
 * Populate topbar avatar, name, role from session storage user object.
 */
function populateTopbar() {
  const user = getFummsaUser();
  if (!user) return;

  const nameEl = document.getElementById('topbarUserName');
  const roleEl = document.getElementById('topbarUserRole');
  const avatarEl = document.getElementById('topbarAvatar');

  if (nameEl) nameEl.textContent = user.name || user.email || 'User';
  if (roleEl) roleEl.textContent = _roleLabel(user.role);
  if (avatarEl) {
    if (user.photoUrl) {
      avatarEl.innerHTML = `<img src="${user.photoUrl}" alt="${user.name}">`;
    } else {
      avatarEl.textContent = _initials(user.name || user.email);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════════════════ */

/** Format ISO date string → "12 Jan 2025" */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Format ISO datetime → "12 Jan 2025, 10:30 AM" */
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Format number as Nigerian Naira */
function fmtNaira(num) {
  if (num == null || isNaN(num)) return '₦—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
  }).format(num);
}

/** Derive grade CSS class */
function gradeClass(g) {
  const m = { A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', E: 'grade-e', F: 'grade-f' };
  return m[(g || '').toUpperCase()] || '';
}

/** Get a badge HTML snippet for a status string */
function statusBadge(status) {
  const map = {
    active:       ['badge-active',  '● Active'],
    inactive:     ['badge-info',    '○ Inactive'],
    pending:      ['badge-pending', '⏳ Pending'],
    suspended:    ['badge-locked',  '⛔ Suspended'],
    paid:         ['badge-paid',    '✓ Paid'],
    unpaid:       ['badge-unpaid',  '✗ Unpaid'],
    partial:      ['badge-partial', '◐ Partial'],
    allocated:    ['badge-paid',    '✓ Allocated'],
    rejected:     ['badge-unpaid',  '✗ Rejected'],
    approved:     ['badge-paid',    '✓ Approved'],
    hod_approved: ['badge-info',    '↑ HOD Approved'],
    dean_approved:['badge-info',    '↑ Dean Approved'],
    success:      ['badge-paid',    '✓ Success'],
    failed:       ['badge-unpaid',  '✗ Failed'],
  };
  const [cls, label] = map[status] || ['badge-info', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

/** Format academic level: 100 → "100 Level" */
function fmtLevel(l) {
  return l ? `${l} Level` : '—';
}

/** Pretty-print a role string */
function _roleLabel(role) {
  const m = {
    student:    'Student',
    lecturer:   'Lecturer',
    hod:        'Head of Department',
    dean:       'Dean of Faculty',
    dsa:        'Division of Student Affairs',
    executive:  'University Executive',
    superadmin: 'Super Administrator',
  };
  return m[role] || role || 'User';
}

/** Get initials from a full name */
function _initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM DIALOG (styled)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Show a styled confirm dialog. Returns a Promise<boolean>.
 */
function portalConfirm(message, title = 'Confirm Action', dangerBtn = false) {
  return new Promise(resolve => {
    let overlay = document.getElementById('_confirmOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '_confirmOverlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" style="max-width:420px">
          <h3 id="_confirmTitle"></h3>
          <p id="_confirmMsg" style="font-size:0.88rem;color:var(--mid);line-height:1.7;margin-bottom:4px"></p>
          <div class="modal-footer">
            <button id="_confirmNo"  class="btn btn-outline">Cancel</button>
            <button id="_confirmYes" class="btn btn-primary">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    document.getElementById('_confirmTitle').textContent = title;
    document.getElementById('_confirmMsg').textContent   = message;
    const yesBtn = document.getElementById('_confirmYes');
    yesBtn.className = `btn ${dangerBtn ? 'btn-danger' : 'btn-primary'}`;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    const cleanup = (result) => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      resolve(result);
    };

    yesBtn.onclick = () => cleanup(true);
    document.getElementById('_confirmNo').onclick = () => cleanup(false);
  });
}

/* ═══════════════════════════════════════════════════════════════
   PRINT / EXPORT HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Open a printable window with given HTML content.
 */
function printContent(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`
    <!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; padding: 20mm; color: #111; }
      h1   { font-size: 14pt; color: #4a0a1e; margin-bottom: 4pt; }
      h2   { font-size: 12pt; border-bottom: 1pt solid #ccc; padding-bottom: 4pt; }
      table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8pt; }
      th    { background: #f0e8e8; padding: 5pt 8pt; text-align: left; font-size: 8pt; text-transform: uppercase; }
      td    { padding: 5pt 8pt; border-bottom: 0.5pt solid #ddd; }
      .logo-header { display: flex; align-items: center; gap: 10pt; border-bottom: 2pt solid #4a0a1e; padding-bottom: 8pt; margin-bottom: 12pt; }
      .logo-header img { width: 50pt; height: 50pt; border-radius: 50%; }
      @media print { body { padding: 10mm; } }
    </style>
    </head><body>
    <div class="logo-header">
      <img src="logo.png" onerror="this.style.display='none'">
      <div>
        <h1>Federal University of Medicine &amp; Medical Sciences, Abeokuta</h1>
        <p style="font-size:9pt;color:#666">FUMMSA — Official Document</p>
      </div>
    </div>
    ${bodyHtml}
    <p style="font-size:8pt;color:#999;margin-top:16pt">
      Generated: ${fmtDateTime(new Date().toISOString())} · This document is computer-generated.
    </p>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`);
  win.document.close();
}

/**
 * Export a data-table element to CSV and trigger download.
 * @param {string} tableId   - id of the <table> element
 * @param {string} filename  - download file name (without .csv)
 */
function exportTableToCSV(tableId, filename = 'export') {
  const table = document.getElementById(tableId);
  if (!table) { showToast('Table not found.', 'error'); return; }
  const rows  = [...table.querySelectorAll('tr')];
  const csv   = rows.map(row =>
    [...row.querySelectorAll('th,td')]
      .map(cell => `"${cell.innerText.replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

/* ═══════════════════════════════════════════════════════════════
   PAGINATION HELPER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Render a pagination control and return the current page slice.
 *
 * @param {any[]}   items       - full array
 * @param {number}  page        - 1-based current page
 * @param {number}  perPage     - items per page (default 15)
 * @param {string}  containerId - id of element to render pagination into
 * @param {Function} onChange   - called with new page number when user clicks
 * @returns {any[]}             - slice of items for current page
 */
function paginate(items, page, perPage = 15, containerId, onChange) {
  const total   = Math.ceil(items.length / perPage);
  const start   = (page - 1) * perPage;
  const slice   = items.slice(start, start + perPage);
  const el      = document.getElementById(containerId);

  if (el && total > 1) {
    const pages = [];
    if (page > 1)     pages.push(`<button class="pag-btn" data-p="${page-1}">‹ Prev</button>`);
    for (let i = Math.max(1,page-2); i <= Math.min(total,page+2); i++) {
      pages.push(`<button class="pag-btn${i===page?' active':''}" data-p="${i}">${i}</button>`);
    }
    if (page < total) pages.push(`<button class="pag-btn" data-p="${page+1}">Next ›</button>`);

    el.innerHTML = `
      <style>
        .pag-btn{padding:5px 12px;border:1.5px solid var(--rule);background:white;
          font-family:var(--sans);font-size:0.75rem;cursor:pointer;border-radius:2px;
          color:var(--mid);transition:all 0.15s;margin:0 2px;}
        .pag-btn.active,.pag-btn:hover{background:var(--maroon);color:white;border-color:var(--maroon);}
      </style>
      <div style="display:flex;align-items:center;gap:4px;padding:12px 0;justify-content:center;">
        <span style="font-size:0.75rem;color:var(--muted);margin-right:10px">
          Showing ${start+1}–${Math.min(start+perPage,items.length)} of ${items.length}
        </span>
        ${pages.join('')}
      </div>`;

    el.querySelectorAll('.pag-btn').forEach(btn => {
      btn.addEventListener('click', () => onChange(parseInt(btn.dataset.p)));
    });
  } else if (el) {
    el.innerHTML = '';
  }

  return slice;
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH FILTER HELPER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Filter an array of objects by a search term across specified keys.
 */
function filterBySearch(items, term, keys) {
  if (!term || !term.trim()) return items;
  const t = term.toLowerCase();
  return items.filter(item =>
    keys.some(k => String(item[k] ?? '').toLowerCase().includes(t))
  );
}

/* ═══════════════════════════════════════════════════════════════
   COURSE SLIP / RECEIPT GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate and print a course registration slip.
 */
function printCourseSlip(student, courses, sessionLabel, semesterLabel) {
  const rows = courses.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${c.courses?.code || c.code || '—'}</td>
      <td>${c.courses?.title || c.title || '—'}</td>
      <td>${c.courses?.units || c.units || '—'}</td>
      <td>${c.courses?.departments?.name || '—'}</td>
    </tr>`).join('');

  const totalUnits = courses.reduce((s, c) => s + (c.courses?.units || c.units || 0), 0);

  printContent('Course Registration Slip', `
    <h2>Course Registration Slip</h2>
    <table style="margin-bottom:12pt">
      <tr><th>Student Name</th><td>${student.full_name || student.name}</td>
          <th>Matric No.</th><td>${student.matric_no || student.matric || '—'}</td></tr>
      <tr><th>Faculty</th><td>${student.faculty || '—'}</td>
          <th>Department</th><td>${student.department || '—'}</td></tr>
      <tr><th>Programme</th><td>${student.programme || '—'}</td>
          <th>Level</th><td>${fmtLevel(student.level)}</td></tr>
      <tr><th>Session</th><td>${sessionLabel}</td>
          <th>Semester</th><td>${semesterLabel}</td></tr>
    </table>
    <table>
      <thead><tr><th>#</th><th>Code</th><th>Course Title</th><th>Units</th><th>Dept</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right;font-weight:bold">Total Units:</td>
          <td style="font-weight:bold">${totalUnits}</td><td></td>
        </tr>
      </tfoot>
    </table>
    <p style="margin-top:16pt;font-size:9pt">
      Student Signature: _______________________ &nbsp;&nbsp;&nbsp;
      HOD Stamp &amp; Signature: _______________________
    </p>`);
}

/**
 * Generate and print a payment receipt.
 */
function printReceipt(transaction, student) {
  printContent('Payment Receipt', `
    <h2>Official Payment Receipt</h2>
    <table style="margin-bottom:12pt">
      <tr><th>Receipt No.</th><td>${transaction.reference_no}</td>
          <th>Date</th><td>${fmtDateTime(transaction.payment_date || transaction.created_at)}</td></tr>
      <tr><th>Student Name</th><td>${student.full_name || student.name}</td>
          <th>Matric No.</th><td>${student.matric_no || student.matric || '—'}</td></tr>
      <tr><th>Description</th><td colspan="3">${transaction.description || '—'}</td></tr>
      <tr><th>Amount</th><td><strong>${fmtNaira(transaction.amount)}</strong></td>
          <th>Method</th><td>${transaction.payment_method || 'Remita'}</td></tr>
      <tr><th>Status</th><td colspan="3"><strong>${(transaction.status || '').toUpperCase()}</strong></td></tr>
    </table>
    <p style="font-size:9pt;margin-top:24pt;border-top:1pt solid #ccc;padding-top:8pt">
      This receipt is valid only when bearing a Remita payment confirmation. 
      Contact the Bursary Office for any discrepancies.
    </p>`);
}

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN TIMER
   ═══════════════════════════════════════════════════════════════ */

let _countdownInterval = null;

/**
 * Start a countdown display in an element.
 * @param {number}   totalSeconds
 * @param {string}   displayId   - id of <span> or similar element
 * @param {Function} onExpire    - callback when timer hits 0
 */
function startCountdown(totalSeconds, displayId, onExpire) {
  clearInterval(_countdownInterval);
  let remaining = totalSeconds;

  const update = () => {
    const el = document.getElementById(displayId);
    if (!el) return;
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
    el.style.color = remaining < 300 ? 'var(--danger)' : '';
    if (remaining <= 0) {
      clearInterval(_countdownInterval);
      if (typeof onExpire === 'function') onExpire();
    }
    remaining--;
  };

  update();
  _countdownInterval = setInterval(update, 1000);
}

function stopCountdown() { clearInterval(_countdownInterval); }

/* ═══════════════════════════════════════════════════════════════
   TRANSACTION VALIDATOR
   ═══════════════════════════════════════════════════════════════ */

async function validateTransaction(reference, outputElId) {
  const el = document.getElementById(outputElId);
  if (!el) return;
  el.innerHTML = `<div class="skeleton sk-block"></div>`;

  const { data, error } = await api_validateTransaction(reference);
  if (error || !data) {
    el.innerHTML = `<div class="alert error show">❌ Transaction not found. Check the reference number and try again.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="portal-card" style="border-left:4px solid ${data.status==='success'?'var(--success)':'var(--danger)'}">
      <div class="card-hd">
        <h3>${data.status === 'success' ? '✅ Valid Transaction' : '❌ Failed Transaction'}</h3>
        ${statusBadge(data.status)}
      </div>
      <div class="form-grid-2" style="gap:12px;font-size:0.85rem">
        <div><span style="color:var(--muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:.1em">Reference</span>
          <p style="font-weight:700;font-family:monospace">${data.reference_no}</p></div>
        <div><span style="color:var(--muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:.1em">Amount</span>
          <p style="font-weight:700;font-family:'Source Serif 4',serif;font-size:1.1rem">${fmtNaira(data.amount)}</p></div>
        <div><span style="color:var(--muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:.1em">Student</span>
          <p>${data.student_name || '—'}</p></div>
        <div><span style="color:var(--muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:.1em">Description</span>
          <p>${data.description || '—'}</p></div>
        <div><span style="color:var(--muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:.1em">Date</span>
          <p>${fmtDateTime(data.payment_date || data.created_at)}</p></div>
        <div><span style="color:var(--muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:.1em">Validated</span>
          <p>${data.validated ? '✅ Yes' : '⏳ Pending'}</p></div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   INITIALISE ON DOM READY
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  populateTopbar();

  // Wire logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', () => fummsaLogout());
  });

  // Auto-show first section if none active
  const firstSec = document.querySelector('.page-section');
  if (firstSec && !document.querySelector('.page-section.active')) {
    firstSec.classList.add('active');
    const secId = firstSec.id.replace('sec-', '');
    const link  = document.querySelector(`.sb-link[data-section="${secId}"]`);
    if (link) link.classList.add('active');
  }

  // Live search inputs wired to tables
  document.querySelectorAll('[data-search-table]').forEach(input => {
    input.addEventListener('input', () => {
      const tableId = input.dataset.searchTable;
      const term    = input.value.toLowerCase();
      const table   = document.getElementById(tableId);
      if (!table) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  });
});