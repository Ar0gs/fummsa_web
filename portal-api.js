/**
 * FUMMSA PORTAL — API HELPER LIBRARY
 * Depends on: supabase-config.js, portal-auth.js
 *
 * All functions return { data, error } or throw.
 * When db === null, demo/mock data is returned so the UI always works.
 */

// ══════════════════════════════════════════════════════════════
// SECTION A — STUDENT PORTAL APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get the full student profile for the current user.
 */
async function api_getStudentProfile(userId) {
  if (!db) return { data: _demoStudentProfile(), error: null };
  const { data, error } = await db
    .from('v_student_full')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

/**
 * Update student profile fields.
 */
async function api_updateStudentProfile(userId, fields) {
  if (!db) return { data: fields, error: null };
  const { data, error } = await db
    .from('portal_users')
    .update({ phone: fields.phone, photo_url: fields.photoUrl })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

/**
 * Get registered courses for the current student in a semester.
 */
async function api_getStudentCourses(studentId, semesterId) {
  if (!db) return { data: _demoCourseRegistrations(), error: null };
  const { data, error } = await db
    .from('course_registrations')
    .select(`
      id, status,
      courses ( id, code, title, units, level, semester_num,
        departments ( name )
      )
    `)
    .eq('student_id', studentId)
    .eq('semester_id', semesterId);
  return { data, error };
}

/**
 * Register a student for a list of course IDs.
 */
async function api_registerCourses(studentId, courseIds, semesterId) {
  if (!db) return { data: { registered: courseIds.length }, error: null };
  const rows = courseIds.map(cid => ({
    student_id:  studentId,
    course_id:   cid,
    semester_id: semesterId,
    status:      'active',
  }));
  const { data, error } = await db
    .from('course_registrations')
    .upsert(rows, { onConflict: 'student_id,course_id,semester_id' })
    .select();
  await logActivity('course_registration', 'student', studentId, { count: courseIds.length });
  return { data, error };
}

/**
 * Get published results for a student (all time or by session).
 */
async function api_getStudentResults(studentId, sessionId = null) {
  if (!db) return { data: _demoResults(), error: null };
  let query = db
    .from('v_results_summary')
    .select('*')
    .eq('student_id', studentId)
    .eq('published', true)
    .order('session', { ascending: false });

  if (sessionId) query = query.eq('session_id', sessionId);
  const { data, error } = await query;
  return { data, error };
}

/**
 * Get all invoices for a student.
 */
async function api_getStudentInvoices(studentId) {
  if (!db) return { data: _demoInvoices(), error: null };
  const { data, error } = await db
    .from('invoices')
    .select(`*, academic_sessions ( label )`)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Get all transactions for a student.
 */
async function api_getStudentTransactions(studentId) {
  if (!db) return { data: _demoTransactions(), error: null };
  const { data, error } = await db
    .from('transactions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Validate a transaction by reference number.
 */
async function api_validateTransaction(refNo) {
  if (!db) return { data: _demoTxnValidation(refNo), error: null };
  const { data, error } = await db.rpc('fn_validate_transaction', {
    p_ref:       refNo,
    p_validator: getFummsaUser()?.profile_id,
  });
  return { data: data?.[0] || null, error };
}

/**
 * Initiate a payment — creates a pending transaction.
 */
async function api_initiatePayment(studentId, invoiceId, amount, feeType) {
  const ref = `RMT-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  if (!db) return { data: { reference_no: ref }, error: null };
  const { data, error } = await db
    .from('transactions')
    .insert([{
      student_id:  studentId,
      invoice_id:  invoiceId,
      reference_no: ref,
      amount,
      payment_method: 'remita',
      status: 'pending',
      description: feeType,
    }])
    .select()
    .single();
  return { data, error };
}

/**
 * Submit a programme change request.
 */
async function api_submitProgChangeRequest(studentId, payload) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('programme_change_requests')
    .insert([{ student_id: studentId, ...payload, status: 'pending' }])
    .select()
    .single();
  await logActivity('programme_change_request', 'student', studentId);
  return { data, error };
}

/**
 * Submit a student petition to a lecturer.
 */
async function api_submitPetition(payload) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('student_petitions')
    .insert([payload])
    .select()
    .single();
  return { data, error };
}

/**
 * Apply for hostel accommodation.
 */
async function api_applyHostel(studentId, hostelId, sessionId, specialNeeds = null) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('hostel_applications')
    .upsert([{ student_id: studentId, hostel_id: hostelId, session_id: sessionId, special_needs: specialNeeds }],
      { onConflict: 'student_id,session_id' })
    .select()
    .single();
  return { data, error };
}

/**
 * Get the student's hostel allocation.
 */
async function api_getHostelAllocation(studentId, sessionId) {
  if (!db) return { data: null, error: null };
  const { data, error } = await db
    .from('hostel_applications')
    .select(`
      status,
      hostel_allocations (
        bed_number,
        hostel_rooms ( room_number, capacity,
          hostels ( name )
        )
      )
    `)
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .single();
  return { data, error };
}

/**
 * Get scholarship listings.
 */
async function api_getScholarships(sessionId) {
  if (!db) return { data: _demoScholarships(), error: null };
  const { data, error } = await db
    .from('scholarships')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .order('deadline', { ascending: true });
  return { data, error };
}

/**
 * Apply for a scholarship.
 */
async function api_applyScholarship(studentId, scholarshipId, essay) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('scholarship_applications')
    .insert([{ student_id: studentId, scholarship_id: scholarshipId, essay }])
    .select()
    .single();
  return { data, error };
}


// ══════════════════════════════════════════════════════════════
// SECTION B — LECTURER PORTAL APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get courses allocated to a lecturer in a semester.
 */
async function api_getLecturerCourses(lecturerId, semesterId) {
  if (!db) return { data: _demoLecturerCourses(), error: null };
  const { data, error } = await db
    .from('course_allocations')
    .select(`
      id, teaching_days, venue,
      courses ( id, code, title, units, level )
    `)
    .eq('lecturer_id', lecturerId)
    .eq('semester_id', semesterId);
  return { data, error };
}

/**
 * Get students registered for a specific allocation.
 */
async function api_getCourseStudents(allocationId) {
  if (!db) return { data: _demoCourseStudents(), error: null };
  const { data: alloc, error: aErr } = await db
    .from('course_allocations')
    .select('course_id, semester_id')
    .eq('id', allocationId)
    .single();
  if (aErr) return { data: [], error: aErr };

  const { data, error } = await db
    .from('course_registrations')
    .select(`
      id, status,
      portal_users ( id, full_name, photo_url,
        student_profiles ( matric_no, level )
      )
    `)
    .eq('course_id', alloc.course_id)
    .eq('semester_id', alloc.semester_id)
    .eq('status', 'active');
  return { data, error };
}

/**
 * Save attendance for a session.
 * records: [{ student_id, status: 'present'|'absent'|'excused' }]
 */
async function api_saveAttendance(allocationId, date, records, topic = null) {
  if (!db) return { data: { count: records.length }, error: null };

  // Upsert attendance session
  const { data: session, error: sErr } = await db
    .from('attendance_sessions')
    .upsert([{ allocation_id: allocationId, date, topic, created_by: getFummsaUser()?.profile_id }],
      { onConflict: 'allocation_id,date' })
    .select()
    .single();
  if (sErr) return { data: null, error: sErr };

  // Upsert each attendance record
  const rows = records.map(r => ({ session_id: session.id, student_id: r.student_id, status: r.status }));
  const { data, error } = await db
    .from('attendance_records')
    .upsert(rows, { onConflict: 'session_id,student_id' })
    .select();
  return { data, error };
}

/**
 * Get attendance summary for a course.
 */
async function api_getAttendanceSummary(allocationId) {
  if (!db) return { data: _demoAttendanceSummary(), error: null };
  const { data, error } = await db
    .rpc('fn_attendance_summary', { p_allocation_id: allocationId });
  return { data, error };
}

/**
 * Submit CA scores for a registration batch.
 * scores: [{ registration_id, score }]
 */
async function api_submitCAScores(scores, caNumber) {
  if (!db) return { data: { count: scores.length }, error: null };
  const rows = scores.map(s => ({
    registration_id: s.registration_id,
    ca_number:       caNumber,
    score:           s.score,
    submitted_by:    getFummsaUser()?.profile_id,
  }));
  const { data, error } = await db
    .from('ca_scores')
    .upsert(rows, { onConflict: 'registration_id,ca_number' })
    .select();
  await logActivity('ca_score_submit', 'course', null, { count: scores.length, ca: caNumber });
  return { data, error };
}

/**
 * Submit exam scores.
 * scores: [{ registration_id, score, is_absent }]
 */
async function api_submitExamScores(scores) {
  if (!db) return { data: { count: scores.length }, error: null };
  const rows = scores.map(s => ({
    registration_id: s.registration_id,
    score:           s.score,
    is_absent:       s.is_absent || false,
    submitted_by:    getFummsaUser()?.profile_id,
  }));
  const { data, error } = await db
    .from('exam_scores')
    .upsert(rows, { onConflict: 'registration_id' })
    .select();
  await logActivity('exam_score_submit', 'course', null, { count: scores.length });
  return { data, error };
}

/**
 * Publish results for a course.
 */
async function api_publishResults(courseId, semesterId) {
  if (!db) return { data: { count: 0 }, error: null };
  const { data, error } = await db.rpc('fn_publish_results', {
    p_course_id: courseId, p_semester_id: semesterId,
  });
  return { data, error };
}

/**
 * Upload course material metadata (actual file goes to Supabase Storage).
 */
async function api_uploadMaterial(allocationId, title, materialType, fileUrl, fileSizeKb) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('course_materials')
    .insert([{
      allocation_id: allocationId,
      title,
      material_type: materialType,
      file_url:      fileUrl,
      file_size_kb:  fileSizeKb,
      uploaded_by:   getFummsaUser()?.profile_id,
    }])
    .select()
    .single();
  return { data, error };
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 */
async function api_uploadFile(bucket, filePath, file) {
  if (!db) return { url: URL.createObjectURL(file), error: null };
  const { data, error } = await db.storage.from(bucket).upload(filePath, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: urlData } = db.storage.from(bucket).getPublicUrl(filePath);
  return { url: urlData.publicUrl, error: null };
}

/**
 * Submit a staff request.
 */
async function api_submitStaffRequest(payload) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('staff_requests')
    .insert([{ staff_id: getFummsaUser()?.profile_id, ...payload }])
    .select()
    .single();
  return { data, error };
}

/**
 * Review a student petition.
 */
async function api_reviewPetition(petitionId, status, remarks) {
  if (!db) return { data: { id: petitionId }, error: null };
  const { data, error } = await db
    .from('student_petitions')
    .update({ status, lecturer_remarks: remarks, reviewed_at: new Date().toISOString() })
    .eq('id', petitionId)
    .select()
    .single();
  return { data, error };
}


// ══════════════════════════════════════════════════════════════
// SECTION C — HOD PORTAL APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get all students in a department.
 */
async function api_getDeptStudents(deptId, level = null) {
  if (!db) return { data: _demoDeptStudents(), error: null };
  let query = db
    .from('v_student_full')
    .select('*')
    .eq('department', deptId); // uses dept name from view; adjust as needed

  if (level) query = query.eq('level', level);
  const { data, error } = await query.order('full_name');
  return { data, error };
}

/**
 * Get all staff in a department.
 */
async function api_getDeptStaff(deptId) {
  if (!db) return { data: _demoDeptStaff(), error: null };
  const { data, error } = await db
    .from('v_staff_full')
    .select('*')
    .eq('department', deptId);
  return { data, error };
}

/**
 * Get pending programme change requests for HOD's department.
 */
async function api_getPendingProgChanges(deptId) {
  if (!db) return { data: _demoProgChanges(), error: null };
  const { data, error } = await db
    .from('programme_change_requests')
    .select(`
      id, reason, status, created_at,
      portal_users!student_id ( full_name ),
      from_dept:departments!from_dept_id ( name ),
      to_dept:departments!to_dept_id ( name )
    `)
    .eq('from_dept_id', deptId)
    .eq('status', 'pending');
  return { data, error };
}

/**
 * Approve or reject a programme change request.
 */
async function api_reviewProgChange(requestId, approved, remarks) {
  if (!db) return { data: { id: requestId }, error: null };
  const { data, error } = await db
    .from('programme_change_requests')
    .update({
      status:       approved ? 'hod_approved' : 'rejected',
      hod_remarks:  remarks,
      reviewed_by:  getFummsaUser()?.profile_id,
      reviewed_at:  new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();
  return { data, error };
}

/**
 * Lock a student's portal access.
 */
async function api_lockStudentPortal(studentId, reason) {
  if (!db) return { data: { locked: true }, error: null };
  const { data, error } = await db.rpc('fn_lock_student_portal', {
    p_student_id: studentId,
    p_reason:     reason,
  });
  await logActivity('lock_portal', 'student', studentId, { reason });
  return { data, error };
}

/**
 * Unlock a student's portal access.
 */
async function api_unlockStudentPortal(studentId) {
  if (!db) return { data: { locked: false }, error: null };
  const { data, error } = await db.rpc('fn_unlock_student_portal', { p_student_id: studentId });
  await logActivity('unlock_portal', 'student', studentId);
  return { data, error };
}

/**
 * Lock ALL students in a department.
 */
async function api_lockDeptPortals(deptId, reason) {
  if (!db) return { data: { count: 0 }, error: null };
  const { data, error } = await db.rpc('fn_lock_dept_portals', { p_dept_id: deptId, p_reason: reason });
  return { data, error };
}

/**
 * Review a staff request (approve/reject).
 */
async function api_reviewStaffRequest(requestId, approved, remarks) {
  if (!db) return { data: { id: requestId }, error: null };
  const { data, error } = await db
    .from('staff_requests')
    .update({
      status:      approved ? 'approved' : 'rejected',
      remarks,
      reviewed_by: getFummsaUser()?.profile_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();
  return { data, error };
}

/**
 * Allocate a course to a lecturer.
 */
async function api_allocateCourse(courseId, semesterId, lecturerId, teachingDays, venue) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('course_allocations')
    .upsert([{ course_id: courseId, semester_id: semesterId, lecturer_id: lecturerId, teaching_days: teachingDays, venue }],
      { onConflict: 'course_id,semester_id' })
    .select()
    .single();
  return { data, error };
}


// ══════════════════════════════════════════════════════════════
// SECTION D — DEAN / DSA / EXECUTIVE APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get all departments in a faculty.
 */
async function api_getFacultyDepts(facultyId) {
  if (!db) return { data: [], error: null };
  const { data, error } = await db
    .from('departments')
    .select('id, name, code')
    .eq('faculty_id', facultyId);
  return { data, error };
}

/**
 * Get faculty-level stats.
 */
async function api_getFacultyStats(facultyId) {
  if (!db) return { data: _demoFacultyStats(), error: null };
  const [students, staff] = await Promise.all([
    db.from('v_student_full').select('id', { count: 'exact' }).eq('faculty_id', facultyId),
    db.from('v_staff_full').select('id', { count: 'exact' }).eq('faculty_id', facultyId),
  ]);
  return { data: { studentCount: students.count, staffCount: staff.count }, error: null };
}

/**
 * Approve a programme change at dean level.
 */
async function api_deanApproveProgramme(requestId, approved, remarks) {
  if (!db) return { data: { id: requestId }, error: null };
  const { data, error } = await db
    .from('programme_change_requests')
    .update({
      status:       approved ? 'dean_approved' : 'rejected',
      dean_remarks: remarks,
      reviewed_by:  getFummsaUser()?.profile_id,
      reviewed_at:  new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();
  return { data, error };
}

/**
 * Get all pending approvals for a dean's faculty.
 */
async function api_getDeanApprovals(facultyId) {
  if (!db) return { data: _demoDeanApprovals(), error: null };
  const { data, error } = await db
    .from('programme_change_requests')
    .select(`
      id, reason, status, created_at,
      portal_users!student_id ( full_name ),
      from_dept:departments!from_dept_id ( name )
    `)
    .eq('status', 'hod_approved')
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Get all disciplinary records (DSA).
 */
async function api_getDisciplinaryRecords(studentId = null) {
  if (!db) return { data: _demoDisciplinary(), error: null };
  let query = db
    .from('disciplinary_records')
    .select(`*, portal_users!student_id ( full_name, student_profiles ( matric_no ) )`);
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query.order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Add a disciplinary record.
 */
async function api_addDisciplinaryRecord(studentId, offence, details, actionTaken, hearingDate) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('disciplinary_records')
    .insert([{
      student_id:   studentId,
      offence,
      details,
      action_taken: actionTaken,
      hearing_date: hearingDate,
      recorded_by:  getFummsaUser()?.profile_id,
    }])
    .select()
    .single();
  return { data, error };
}

/**
 * Run hostel balloting for a session (DSA).
 */
async function api_runHostelBallot(sessionId) {
  if (!db) return { data: { allocated: 0 }, error: null };
  const { data, error } = await db.rpc('fn_run_hostel_ballot', { p_session_id: sessionId });
  await logActivity('hostel_ballot', null, null, { session_id: sessionId });
  return { data: { allocated: data }, error };
}

/**
 * Get university-wide dashboard stats (executive / superadmin).
 */
async function api_getDashboardStats() {
  if (!db) return { data: _demoDashboardStats(), error: null };
  const { data, error } = await db.rpc('fn_dashboard_stats');
  return { data, error };
}


// ══════════════════════════════════════════════════════════════
// SECTION E — SUPERADMIN APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get all portal users with optional role filter.
 */
async function api_getAllUsers(roleFilter = null, statusFilter = null) {
  if (!db) return { data: _demoAllUsers(), error: null };
  let query = db
    .from('portal_users')
    .select('id, email, full_name, role, status, approved, created_at, last_login, phone')
    .order('created_at', { ascending: false });

  if (roleFilter)   query = query.eq('role', roleFilter);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  return { data, error };
}

/**
 * Get pending lecturer/staff registrations.
 */
async function api_getPendingRegistrations() {
  if (!db) return { data: _demoPendingUsers(), error: null };
  const { data, error } = await db
    .from('portal_users')
    .select(`
      id, email, full_name, role, created_at, phone,
      staff_profiles ( staff_id, rank, specialization,
        faculties ( name ), departments ( name )
      )
    `)
    .eq('status', 'pending')
    .neq('role', 'student')
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Approve a pending staff account.
 */
async function api_approveStaff(userId) {
  if (!db) return { data: { approved: true }, error: null };
  const { data, error } = await db.rpc('fn_approve_staff', {
    p_user_id:     userId,
    p_approved_by: getFummsaUser()?.profile_id,
  });
  return { data, error };
}

/**
 * Reject / deactivate a user.
 */
async function api_rejectUser(userId) {
  if (!db) return { data: { rejected: true }, error: null };
  const { data, error } = await db.rpc('fn_reject_staff', { p_user_id: userId });
  return { data, error };
}

/**
 * Update a user's role.
 */
async function api_updateUserRole(userId, newRole) {
  if (!db) return { data: { role: newRole }, error: null };
  const { data, error } = await db
    .from('portal_users')
    .update({ role: newRole })
    .eq('id', userId)
    .select()
    .single();
  await logActivity('role_change', 'user', userId, { new_role: newRole });
  return { data, error };
}

/**
 * Suspend / unsuspend a user.
 */
async function api_toggleUserSuspension(userId, suspend) {
  if (!db) return { data: { suspended: suspend }, error: null };
  const { data, error } = await db
    .from('portal_users')
    .update({ status: suspend ? 'suspended' : 'active' })
    .eq('id', userId)
    .select()
    .single();
  await logActivity(suspend ? 'suspend_user' : 'unsuspend_user', 'user', userId);
  return { data, error };
}

/**
 * Get activity logs (paginated).
 */
async function api_getActivityLogs(limit = 50, offset = 0) {
  if (!db) return { data: _demoActivityLogs(), error: null };
  const { data, error } = await db
    .from('activity_logs')
    .select(`
      id, action, entity_type, entity_id, details, ip_address, created_at,
      portal_users ( full_name, role )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return { data, error };
}

/**
 * Get/update system settings.
 */
async function api_getSystemSettings() {
  if (!db) return { data: _demoSystemSettings(), error: null };
  const { data, error } = await db.from('system_settings').select('*');
  return { data, error };
}

async function api_updateSystemSetting(key, value) {
  if (!db) return { data: { key, value }, error: null };
  const { data, error } = await db
    .from('system_settings')
    .update({ value, updated_by: getFummsaUser()?.profile_id, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select()
    .single();
  return { data, error };
}


// ══════════════════════════════════════════════════════════════
// SECTION F — SHARED / COMMON APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get announcements (filtered by audience).
 */
async function api_getAnnouncements(audience = null) {
  if (!db) return { data: _demoAnnouncements(), error: null };
  let query = db
    .from('announcements')
    .select('*, portal_users ( full_name, role )')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (audience) {
    query = query.or(`audience.eq.all,audience.eq.${audience}`);
  }
  const { data, error } = await query;
  return { data, error };
}

/**
 * Post an announcement.
 */
async function api_postAnnouncement(title, body, audience, priority = 'normal', pinned = false) {
  if (!db) return { data: { id: 'demo' }, error: null };
  const { data, error } = await db
    .from('announcements')
    .insert([{
      author_id: getFummsaUser()?.profile_id,
      title, body, audience, priority, pinned,
    }])
    .select()
    .single();
  return { data, error };
}

/**
 * Get memos for the current user.
 */
async function api_getMemos() {
  if (!db) return { data: [], error: null };
  const user = getFummsaUser();
  const { data, error } = await db
    .from('memos')
    .select('*, portal_users!from_user_id ( full_name, role )')
    .or(`to_user_id.eq.${user.profile_id},to_role.eq.${user.role}`)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Get all faculties.
 */
async function api_getFaculties() {
  if (!db) return { data: _demoFaculties(), error: null };
  const { data, error } = await db.from('faculties').select('*').order('name');
  return { data, error };
}

/**
 * Get all departments (optionally filtered by faculty).
 */
async function api_getDepartments(facultyId = null) {
  if (!db) return { data: _demoDepartments(), error: null };
  let q = db.from('departments').select('*, faculties(name)').order('name');
  if (facultyId) q = q.eq('faculty_id', facultyId);
  const { data, error } = await q;
  return { data, error };
}

/**
 * Get current academic session and semester.
 */
async function api_getCurrentSession() {
  if (!db) return { data: { session: '2024/2025', semester: 'Second Semester', semesterId: null }, error: null };
  const { data, error } = await db
    .from('semesters')
    .select('id, label, session_id, academic_sessions!session_id ( label )')
    .eq('is_current', true)
    .single();
  return { data, error };
}

/**
 * Get available courses for registration by level & semester.
 */
async function api_getAvailableCourses(level, semesterId) {
  if (!db) return { data: _demoCourses(level), error: null };
  const { data, error } = await db
    .from('courses')
    .select('*, departments ( name )')
    .eq('level', level)
    .eq('is_active', true);
  return { data, error };
}

/**
 * Change password.
 */
async function api_changePassword(newPassword) {
  if (!db) return { data: { updated: true }, error: null };
  const { data, error } = await db.auth.updateUser({ password: newPassword });
  return { data, error };
}

/**
 * Upload photo to Supabase Storage and update profile.
 */
async function api_updateProfilePhoto(userId, file) {
  if (!db) {
    const url = URL.createObjectURL(file);
    return { url, error: null };
  }
  const ext  = file.name.split('.').pop();
  const path = `avatars/${userId}.${ext}`;
  const { url, error: upErr } = await api_uploadFile('portal-assets', path, file);
  if (upErr) return { url: null, error: upErr };
  await db.from('portal_users').update({ photo_url: url }).eq('id', userId);
  return { url, error: null };
}


// ══════════════════════════════════════════════════════════════
// SECTION G — CBT APIs
// ══════════════════════════════════════════════════════════════

/**
 * Get available CBT exams for the current student.
 */
async function api_getAvailableCBTExams(studentId) {
  if (!db) return { data: _demoCBTExams(), error: null };
  const { data, error } = await db
    .from('cbt_exams')
    .select(`
      id, title, duration_mins, total_marks, pass_mark, start_time, end_time, instructions,
      courses ( code, title )
    `)
    .eq('is_active', true)
    .lte('start_time', new Date().toISOString())
    .gte('end_time', new Date().toISOString());
  return { data, error };
}

/**
 * Start a CBT exam — creates a submission row.
 */
async function api_startCBTExam(examId, studentId) {
  if (!db) return { data: { id: 'demo-sub', exam_id: examId }, error: null };

  // Check not already submitted
  const { data: existing } = await db
    .from('cbt_submissions')
    .select('id, submitted_at')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .single();

  if (existing?.submitted_at) return { data: null, error: 'You have already completed this exam.' };

  if (existing) return { data: existing, error: null }; // Resume existing

  const { data, error } = await db
    .from('cbt_submissions')
    .insert([{ exam_id: examId, student_id: studentId }])
    .select()
    .single();
  return { data, error };
}

/**
 * Get questions for an exam (options without is_correct field).
 */
async function api_getCBTQuestions(examId) {
  if (!db) return { data: _demoCBTQuestions(), error: null };
  const { data, error } = await db
    .from('cbt_questions')
    .select(`
      id, body, image_url, marks, position,
      cbt_options ( id, label, body )
    `)
    .eq('exam_id', examId)
    .order('position');
  return { data, error };
}

/**
 * Save/update an answer for a question.
 */
async function api_saveCBTAnswer(submissionId, questionId, selectedOptionId) {
  if (!db) return { data: { saved: true }, error: null };

  // Check if selected option is correct
  const { data: opt } = await db
    .from('cbt_options')
    .select('is_correct')
    .eq('id', selectedOptionId)
    .single();

  const { data, error } = await db
    .from('cbt_answers')
    .upsert([{
      submission_id:   submissionId,
      question_id:     questionId,
      selected_option: selectedOptionId,
      is_correct:      opt?.is_correct || false,
      marks_awarded:   opt?.is_correct ? 1 : 0,
    }], { onConflict: 'submission_id,question_id' })
    .select();
  return { data, error };
}

/**
 * Submit (finalize) a CBT exam.
 */
async function api_submitCBTExam(submissionId) {
  if (!db) return { data: { score: 40, percentage: 80, passed: true }, error: null };
  const { data, error } = await db.rpc('fn_submit_cbt', { p_submission_id: submissionId });
  await logActivity('cbt_submit', 'cbt_submission', submissionId);
  return { data: data?.[0] || null, error };
}

/**
 * Get CBT result for a student.
 */
async function api_getCBTResult(submissionId) {
  if (!db) return { data: _demoCBTResult(), error: null };
  const { data, error } = await db
    .from('cbt_submissions')
    .select(`
      score, percentage, passed, submitted_at, time_taken_s,
      cbt_exams ( title, total_marks, pass_mark, courses ( code, title ) )
    `)
    .eq('id', submissionId)
    .single();
  return { data, error };
}


// ══════════════════════════════════════════════════════════════
// DEMO / MOCK DATA (used when Supabase is not connected)
// ══════════════════════════════════════════════════════════════

function _demoStudentProfile() {
  return {
    id: 'demo', email: 'aisha@student.fummsa.edu.ng',
    full_name: 'Aisha Bello Muhammad', matric_no: '2023/MED/0042',
    level: 300, status: 'active', portal_locked: false,
    faculty: 'Basic Medical Sciences', department: 'Human Anatomy',
    programme: 'Medicine & Surgery (MBBS)', gender: 'female',
  };
}

function _demoCourseRegistrations() {
  return [
    { id: 'd1', status: 'active', courses: { code: 'ANAT 301', title: 'Gross Anatomy I', units: 3 } },
    { id: 'd2', status: 'active', courses: { code: 'ANAT 302', title: 'Neuroanatomy', units: 4 } },
    { id: 'd3', status: 'active', courses: { code: 'ANAT 201', title: 'Histology', units: 3 } },
  ];
}

function _demoResults() {
  return [
    { course_code:'ANAT 301', course_title:'Gross Anatomy I',    units:3, ca1_score:25, ca2_score:24, exam_score:58, total_score:72, grade:'A', grade_point:5.0, remark:'Excellent', session:'2023/2024', semester:'First Semester' },
    { course_code:'ANAT 201', course_title:'Histology',          units:3, ca1_score:22, ca2_score:20, exam_score:51, total_score:65, grade:'B', grade_point:4.0, remark:'Very Good',  session:'2023/2024', semester:'First Semester' },
    { course_code:'ANAT 202', course_title:'General Embryology', units:2, ca1_score:20, ca2_score:19, exam_score:44, total_score:55, grade:'C', grade_point:3.0, remark:'Good',       session:'2023/2024', semester:'Second Semester' },
  ];
}

function _demoInvoices() {
  return [
    { id:'i1', fee_type:'school_fees', label:'Tuition 2024/2025',  amount:400000, amount_paid:400000, status:'paid',    due_date:'2024-12-31' },
    { id:'i2', fee_type:'hostel',      label:'Hostel Fee 2024/2025',amount:120000, amount_paid:60000,  status:'partial', due_date:'2025-01-15' },
  ];
}

function _demoTransactions() {
  return [
    { reference_no:'RMT-2024-000042-SCH', amount:400000, status:'success', description:'School Fees 2024/2025', payment_date:'2024-11-05', validated:true },
    { reference_no:'RMT-2024-000042-HST', amount:60000,  status:'success', description:'Hostel Fee (Partial)',  payment_date:'2024-11-20', validated:true },
  ];
}

function _demoTxnValidation(ref) {
  return { reference_no: ref, amount: 60000, status: 'success', student_name: 'Aisha Bello Muhammad', description: 'Hostel Fee (Partial)', payment_date: new Date().toISOString() };
}

function _demoAnnouncements() {
  return [
    { id:'a1', title:'Course Registration Now Open', body:'All students must register courses before 30 June 2025.', audience:'students', priority:'normal', pinned:true,  created_at: new Date().toISOString() },
    { id:'a2', title:'Hostel Balloting Open',         body:'Submit hostel preferences before 15 July 2025.',        audience:'students', priority:'normal', pinned:false, created_at: new Date().toISOString() },
    { id:'a3', title:'1st Convocation — 30 July',    body:'Graduating students must submit clearance forms.',      audience:'all',      priority:'high',   pinned:true,  created_at: new Date().toISOString() },
  ];
}

function _demoLecturerCourses() {
  return [
    { id:'ca1', teaching_days:'Mon, Wed 8:00 AM', venue:'LH 1', courses:{ id:'c1', code:'ANAT 301', title:'Gross Anatomy I',        units:3, level:300 } },
    { id:'ca2', teaching_days:'Tue, Thu 10:00 AM',venue:'LH 2', courses:{ id:'c2', code:'ANAT 302', title:'Neuroanatomy',           units:4, level:300 } },
    { id:'ca3', teaching_days:'Wed, Fri 2:00 PM', venue:'Histo Lab', courses:{ id:'c3', code:'ANAT 201', title:'Histology',         units:3, level:200 } },
    { id:'ca4', teaching_days:'Thu 9:00 AM',      venue:'LH 1', courses:{ id:'c4', code:'ANAT 401', title:'Clinical Anatomy',      units:3, level:400 } },
  ];
}

function _demoCourseStudents() {
  return ['Aisha Bello Muhammad','Babatunde Olasubomi','Chisom Nwachukwu','Damilola Adeyinka','Emeka Obi','Fatima Sule','Gbenga Afolabi','Halima Yahaya'].map((n,i)=>({
    id:`r${i}`, status:'active',
    portal_users:{ id:`u${i}`, full_name:n, student_profiles:{ matric_no:`2023/MED/00${42+i}`, level:300 } }
  }));
}

function _demoAttendanceSummary() {
  return [{ course:'ANAT 301', classes_held:18, avg_attendance:91, below_75:4 }];
}

function _demoDeptStudents() {
  return _demoCourseStudents().map(s=>({ ...s.portal_users, level:300, faculty:'Basic Medical Sciences', department:'Human Anatomy' }));
}

function _demoDeptStaff() {
  return [
    { full_name:'Dr. Fatimah Adeyemi', staff_id:'STAFF/ANAT/2019/004', rank:'Senior Lecturer', status:'active' },
    { full_name:'Dr. Biodun Salami',   staff_id:'STAFF/ANAT/2016/002', rank:'Lecturer I',       status:'active' },
  ];
}

function _demoProgChanges() {
  return [{ id:'pc1', reason:'Personal interest', status:'pending', created_at:new Date().toISOString() }];
}

function _demoDeanApprovals() { return _demoProgChanges(); }

function _demoDisciplinary() {
  return [{ id:'d1', offence:'Academic misconduct', action_taken:'Warning issued', status:'resolved' }];
}

function _demoFacultyStats() {
  return { studentCount:1842, staffCount:94, avgGpa:3.54, passRate:83 };
}

function _demoDashboardStats() {
  return { total_students:4200, total_staff:180, pending_approvals:3, active_sessions:1, total_transactions:8420, total_revenue:3200000000, locked_portals:5 };
}

function _demoAllUsers() {
  return [
    { id:'u1', email:'aisha@student.fummsa.edu.ng', full_name:'Aisha Bello Muhammad', role:'student',   status:'active',  created_at:new Date().toISOString() },
    { id:'u2', email:'f.adeyemi@fummsa.edu.ng',     full_name:'Dr. Fatimah Adeyemi',   role:'lecturer',  status:'active',  created_at:new Date().toISOString() },
    { id:'u3', email:'new@fummsa.edu.ng',            full_name:'Dr. New Applicant',     role:'lecturer',  status:'pending', created_at:new Date().toISOString() },
  ];
}

function _demoPendingUsers() {
  return [{ id:'u8', email:'new.lecturer@fummsa.edu.ng', full_name:'Dr. Emeka Okafor', role:'lecturer', status:'pending', created_at:new Date().toISOString() }];
}

function _demoActivityLogs() {
  return [
    { id:'l1', action:'login',              entity_type:'user', created_at:new Date().toISOString(), portal_users:{ full_name:'Aisha Bello Muhammad', role:'student' } },
    { id:'l2', action:'course_registration',entity_type:'student', created_at:new Date().toISOString(), portal_users:{ full_name:'Aisha Bello Muhammad', role:'student' } },
    { id:'l3', action:'grade_submit',       entity_type:'course', created_at:new Date().toISOString(), portal_users:{ full_name:'Dr. Fatimah Adeyemi',   role:'lecturer' } },
    { id:'l4', action:'lock_portal',        entity_type:'student', created_at:new Date().toISOString(), portal_users:{ full_name:'Prof. Rasheed Musa',    role:'hod' } },
  ];
}

function _demoSystemSettings() {
  return [
    { key:'portal_maintenance',     value:'false',         description:'Maintenance mode' },
    { key:'reg_open',               value:'true',          description:'Course registration switch' },
    { key:'hostel_ballot_open',     value:'true',          description:'Hostel balloting' },
    { key:'university_name',        value:'Federal University of Medicine & Medical Sciences, Abeokuta', description:'University name' },
  ];
}

function _demoScholarships() {
  return [
    { id:'s1', name:'FUMMSA Merit Scholarship', sponsor:'University Fund', amount:200000, criteria:'CGPA ≥ 4.50', deadline:'2025-08-01', is_active:true },
    { id:'s2', name:'Niger Delta Development Bursary', sponsor:'NDDC',  amount:150000, criteria:'Niger Delta origin', deadline:'2025-07-15', is_active:true },
  ];
}

function _demoCBTExams() {
  return [{ id:'e1', title:'ANAT 301 First CA', duration_mins:60, total_marks:50, pass_mark:25, courses:{ code:'ANAT 301', title:'Gross Anatomy I' }, start_time:new Date(Date.now()-3600000).toISOString(), end_time:new Date(Date.now()+3600000).toISOString() }];
}

function _demoCBTQuestions() {
  return [1,2,3,4,5].map(i=>({
    id:`q${i}`, body:`Sample anatomy question ${i}: What is the function of structure X?`, marks:1, position:i,
    cbt_options:[
      {id:`q${i}o1`,label:'A',body:'Option A answer'},
      {id:`q${i}o2`,label:'B',body:'Option B answer'},
      {id:`q${i}o3`,label:'C',body:'Option C answer'},
      {id:`q${i}o4`,label:'D',body:'Option D answer'},
    ]
  }));
}

function _demoCBTResult() {
  return { score:38, percentage:76, passed:true, time_taken_s:2400, cbt_exams:{ title:'ANAT 301 First CA', total_marks:50, pass_mark:25, courses:{ code:'ANAT 301', title:'Gross Anatomy I' } } };
}

function _demoCourses(level) {
  return [
    { id:'c1', code:`DEPT ${level}1`, title:'Core Course I',  units:3, level, departments:{name:'Human Anatomy'} },
    { id:'c2', code:`DEPT ${level}2`, title:'Core Course II', units:2, level, departments:{name:'Human Anatomy'} },
    { id:'c3', code:`DEPT ${level}3`, title:'Elective I',     units:2, level, is_elective:true, departments:{name:'Human Anatomy'} },
  ];
}

function _demoFaculties() {
  return [
    { id:'f1', code:'BMS',  name:'Basic Medical Sciences' },
    { id:'f2', code:'CLIN', name:'Clinical Sciences' },
    { id:'f3', code:'PH',   name:'Public Health' },
  ];
}

function _demoDepartments() {
  return [
    { id:'d1', code:'ANAT', name:'Human Anatomy',  faculties:{name:'Basic Medical Sciences'} },
    { id:'d2', code:'PHYS', name:'Physiology',      faculties:{name:'Basic Medical Sciences'} },
    { id:'d3', code:'BIOC', name:'Biochemistry',    faculties:{name:'Basic Medical Sciences'} },
  ];
}