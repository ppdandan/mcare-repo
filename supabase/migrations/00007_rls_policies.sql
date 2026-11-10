-- =============================================================================
-- Migration 00007: Row Level Security (RLS) Policies
-- Implements strict role-based access control and complies with the
-- Philippine Data Privacy Act of 2012 (RA 10173).
-- =============================================================================

-- =============================================================================
-- 1. Enable RLS on all 11 tables
-- =============================================================================
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. PROFILES POLICIES
-- =============================================================================

-- Read: Users can view their own profile, staff can view all profiles, patients can view doctor profiles
CREATE POLICY "profiles_select_policy"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR is_staff()
    OR (role = 'doctor')
  );

-- Insert: Users can insert their own initial profile upon registration, or admin can create staff profiles
CREATE POLICY "profiles_insert_policy"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR is_admin()
  );

-- Update: Users can update their own basic details; only admin can change user roles
CREATE POLICY "profiles_update_policy"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR is_admin()
  )
  WITH CHECK (
    is_admin()
    OR (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()))
  );

-- Delete: Only admin can delete profiles
CREATE POLICY "profiles_delete_policy"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 3. PATIENTS POLICIES
-- =============================================================================

-- Read: Patient sees their own record; all staff members can view patients
CREATE POLICY "patients_select_policy"
  ON patients FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_staff()
  );

-- Insert: Patient self-registers or staff registers patient
CREATE POLICY "patients_insert_policy"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR is_staff()
  );

-- Update: Patient updates their contact/allergies; staff updates based on clinic workflow
CREATE POLICY "patients_update_policy"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_staff()
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR is_staff()
  );

-- Delete: Only admin can delete patient records
CREATE POLICY "patients_delete_policy"
  ON patients FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 4. DOCTORS POLICIES
-- =============================================================================

-- Read: Public directory for all authenticated users
CREATE POLICY "doctors_select_policy"
  ON doctors FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Admin only
CREATE POLICY "doctors_insert_policy"
  ON doctors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Update: Doctor can update their own room; Admin can update everything
CREATE POLICY "doctors_update_policy"
  ON doctors FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_admin()
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR is_admin()
  );

-- Delete: Admin only
CREATE POLICY "doctors_delete_policy"
  ON doctors FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 5. SERVICES POLICIES
-- =============================================================================

-- Read: All authenticated users can view active services; staff can view all
CREATE POLICY "services_select_policy"
  ON services FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR is_staff()
  );

-- Insert, Update, Delete: Admin only
CREATE POLICY "services_admin_insert"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "services_admin_update"
  ON services FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "services_admin_delete"
  ON services FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 6. DOCTOR SCHEDULES POLICIES
-- =============================================================================

-- Read: All authenticated users can view doctor schedules (needed for booking slots)
CREATE POLICY "doctor_schedules_select_policy"
  ON doctor_schedules FOR SELECT
  TO authenticated
  USING (true);

-- Insert, Update, Delete: The doctor or admin
CREATE POLICY "doctor_schedules_insert_policy"
  ON doctor_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    doctor_id = current_doctor_id()
    OR is_admin()
  );

CREATE POLICY "doctor_schedules_update_policy"
  ON doctor_schedules FOR UPDATE
  TO authenticated
  USING (
    doctor_id = current_doctor_id()
    OR is_admin()
  )
  WITH CHECK (
    doctor_id = current_doctor_id()
    OR is_admin()
  );

CREATE POLICY "doctor_schedules_delete_policy"
  ON doctor_schedules FOR DELETE
  TO authenticated
  USING (
    doctor_id = current_doctor_id()
    OR is_admin()
  );

-- =============================================================================
-- 7. SCHEDULE EXCEPTIONS POLICIES
-- =============================================================================

-- Read: All authenticated users can view exceptions (needed for booking slots)
CREATE POLICY "schedule_exceptions_select_policy"
  ON schedule_exceptions FOR SELECT
  TO authenticated
  USING (true);

-- Insert, Update, Delete: The doctor or admin
CREATE POLICY "schedule_exceptions_insert_policy"
  ON schedule_exceptions FOR INSERT
  TO authenticated
  WITH CHECK (
    doctor_id = current_doctor_id()
    OR is_admin()
  );

CREATE POLICY "schedule_exceptions_update_policy"
  ON schedule_exceptions FOR UPDATE
  TO authenticated
  USING (
    doctor_id = current_doctor_id()
    OR is_admin()
  )
  WITH CHECK (
    doctor_id = current_doctor_id()
    OR is_admin()
  );

CREATE POLICY "schedule_exceptions_delete_policy"
  ON schedule_exceptions FOR DELETE
  TO authenticated
  USING (
    doctor_id = current_doctor_id()
    OR is_admin()
  );

-- =============================================================================
-- 8. APPOINTMENTS POLICIES
-- =============================================================================

-- Read:
-- - Patient: views only their own appointments
-- - Doctor: views appointments assigned to them
-- - Receptionist, Nurse, Admin: views all appointments
CREATE POLICY "appointments_select_policy"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR doctor_id = current_doctor_id()
    OR is_receptionist()
    OR is_nurse()
    OR is_admin()
  );

-- Insert:
-- - Patient: books for themselves
-- - Staff: books for any patient
CREATE POLICY "appointments_insert_policy"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = current_patient_id()
    OR is_staff()
  );

-- Update:
-- - Patient: can update (e.g. cancel) their own appointment
-- - Receptionist / Admin: can approve, reschedule, cancel, or mark no-show
-- - Doctor: can mark completed or update notes
CREATE POLICY "appointments_update_policy"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR doctor_id = current_doctor_id()
    OR is_receptionist()
    OR is_admin()
  )
  WITH CHECK (
    patient_id = current_patient_id()
    OR doctor_id = current_doctor_id()
    OR is_receptionist()
    OR is_admin()
  );

-- Delete: Admin only
CREATE POLICY "appointments_delete_policy"
  ON appointments FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 9. MEDICAL RECORDS POLICIES (DPA 2012 COMPLIANT)
-- Note: Receptionists CANNOT view or edit sensitive medical records.
-- Only clinical staff (Doctors, Nurses, Admin) and the patient themselves can access.
-- =============================================================================

-- Read:
-- - Patient: reads only their own medical records
-- - Clinical staff (Doctor, Nurse, Admin): reads clinical records
CREATE POLICY "medical_records_select_policy"
  ON medical_records FOR SELECT
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR is_clinical_staff()
  );

-- Insert:
-- - Doctors: can write diagnoses and prescriptions
-- - Nurses: can record vitals and triage history
-- - Admin: can insert
CREATE POLICY "medical_records_insert_policy"
  ON medical_records FOR INSERT
  TO authenticated
  WITH CHECK (
    is_doctor()
    OR is_nurse()
    OR is_admin()
  );

-- Update:
-- - Doctors: update diagnosis, prescription, notes
-- - Nurses: update vitals and triage history
-- - Admin: update
CREATE POLICY "medical_records_update_policy"
  ON medical_records FOR UPDATE
  TO authenticated
  USING (
    is_doctor()
    OR is_nurse()
    OR is_admin()
  )
  WITH CHECK (
    is_doctor()
    OR is_nurse()
    OR is_admin()
  );

-- Delete: Admin only (records are protected from deletion for clinical integrity)
CREATE POLICY "medical_records_delete_policy"
  ON medical_records FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 10. NOTIFICATIONS POLICIES
-- =============================================================================

-- Read: User sees only their own notifications
CREATE POLICY "notifications_select_policy"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert: Staff can send notifications, or system triggers
CREATE POLICY "notifications_insert_policy"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_staff()
  );

-- Update: User marks their own notification as read
CREATE POLICY "notifications_update_policy"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete: User can dismiss their own notification
CREATE POLICY "notifications_delete_policy"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- 11. PUSH TOKENS POLICIES
-- =============================================================================

-- Read: User views their own token, admin views all
CREATE POLICY "push_tokens_select_policy"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
  );

-- Insert: User registers their own push token
CREATE POLICY "push_tokens_insert_policy"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update: User updates their own token
CREATE POLICY "push_tokens_update_policy"
  ON push_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete: User deletes their token on logout
CREATE POLICY "push_tokens_delete_policy"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- 12. AUDIT LOGS POLICIES
-- =============================================================================

-- Read: Only Admin can review the audit trail
CREATE POLICY "audit_logs_select_policy"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_admin());

-- Insert: Authenticated users can log their actions/views
CREATE POLICY "audit_logs_insert_policy"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR auth.uid() IS NOT NULL
  );

-- Immutability: UPDATE and DELETE are completely disallowed for audit integrity
-- No policies granted for UPDATE or DELETE on audit_logs.

