-- Enable btree_gist extension (needed for exclusion constraints on appointments)
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- User roles for the clinic system
CREATE TYPE user_role AS ENUM (
  'patient',
  'doctor',
  'nurse',
  'receptionist',
  'admin'
);

-- Appointment lifecycle statuses
CREATE TYPE appointment_status AS ENUM (
  'pending',
  'approved',
  'rescheduled',
  'cancelled',
  'completed',
  'no_show'
);
-- =============================================================================
-- 1. profiles – extends auth.users
-- =============================================================================
CREATE TABLE profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role   NOT NULL DEFAULT 'patient',
  full_name   text        NOT NULL,
  phone       text,
  date_of_birth date,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. patients
-- =============================================================================
CREATE TABLE patients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  emergency_contact_name  text,
  emergency_contact_phone text,
  blood_type              text,
  allergies               text,
  obstetric_history       text,
  privacy_consent         boolean NOT NULL DEFAULT false,
  privacy_consent_at      timestamptz
);

-- =============================================================================
-- 3. doctors
-- =============================================================================
CREATE TABLE doctors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  specialty   text NOT NULL,
  room        text
);

-- =============================================================================
-- 4. services
-- =============================================================================
CREATE TABLE services (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text    NOT NULL UNIQUE,
  description      text,
  duration_minutes integer NOT NULL DEFAULT 30,
  is_active        boolean NOT NULL DEFAULT true
);

-- =============================================================================
-- 5. doctor_schedules
-- =============================================================================
CREATE TABLE doctor_schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid    NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday    integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time    NOT NULL,
  end_time   time    NOT NULL,
  CHECK (start_time < end_time),
  UNIQUE (doctor_id, weekday, start_time)
);

-- =============================================================================
-- 6. schedule_exceptions
-- =============================================================================
CREATE TABLE schedule_exceptions (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id      uuid    NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  exception_date date    NOT NULL,
  start_time     time,
  end_time       time,
  reason         text,
  is_blocked     boolean NOT NULL DEFAULT true
);

-- =============================================================================
-- 7. appointments (with double-booking exclusion constraint)
-- =============================================================================
CREATE TABLE appointments (
  id          uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid               NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  doctor_id   uuid               NOT NULL REFERENCES doctors(id)   ON DELETE CASCADE,
  service_id  uuid               NOT NULL REFERENCES services(id),
  start_time  timestamptz        NOT NULL,
  end_time    timestamptz        NOT NULL,
  status      appointment_status NOT NULL DEFAULT 'pending',
  notes       text,
  created_at  timestamptz        NOT NULL DEFAULT now(),
  updated_at  timestamptz        NOT NULL DEFAULT now(),
  CHECK (start_time < end_time),
  CONSTRAINT no_doctor_double_booking
    EXCLUDE USING gist (
      doctor_id WITH =,
      tstzrange(start_time, end_time) WITH &&
    ) WHERE (status <> 'cancelled')
);

-- =============================================================================
-- 8. medical_records
-- =============================================================================
CREATE TABLE medical_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id                 uuid NOT NULL REFERENCES doctors(id),
  appointment_id            uuid REFERENCES appointments(id),
  visit_date                date        NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint           text,
  history_of_present_illness text,
  blood_pressure            text,
  heart_rate                text,
  temperature               text,
  weight_kg                 numeric(5,2),
  diagnosis                 text,
  prescription              text,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 9. notifications
-- =============================================================================
CREATE TABLE notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  body       text        NOT NULL,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 10. push_tokens
-- =============================================================================
CREATE TABLE push_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text        NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 11. audit_logs
-- =============================================================================
CREATE TABLE audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  table_name  text        NOT NULL,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- updated_at trigger function & triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
-- Appointments indexes
CREATE INDEX idx_appointments_patient_id  ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id   ON appointments(doctor_id);
CREATE INDEX idx_appointments_start_time  ON appointments(start_time);
CREATE INDEX idx_appointments_status      ON appointments(status);

-- Medical records indexes
CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_medical_records_doctor_id  ON medical_records(doctor_id);

-- Notifications composite index
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- Doctor schedules index
CREATE INDEX idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
-- =============================================================================
-- Function: get_available_slots
-- Returns available booking slots for a doctor on a given date.
-- Uses doctor_schedules, schedule_exceptions, and existing appointments.
-- Follows Asia/Manila (PHT, UTC+8) clinic local time.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_slots(
  p_doctor_id             uuid,
  p_target_date           date,
  p_slot_duration_minutes integer DEFAULT 30,
  p_timezone              text    DEFAULT 'Asia/Manila'
)
RETURNS TABLE(slot_start timestamptz, slot_end timestamptz)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY

  -- CTE 1: Get the doctor's schedule blocks for the target weekday
  WITH schedule_blocks AS (
    SELECT
      ((p_target_date + ds.start_time) AT TIME ZONE p_timezone) AS block_start,
      ((p_target_date + ds.end_time)   AT TIME ZONE p_timezone) AS block_end
    FROM doctor_schedules ds
    WHERE ds.doctor_id = p_doctor_id
      AND ds.weekday = EXTRACT(DOW FROM p_target_date)::integer
  ),

  -- CTE 2: Check for blocking schedule exceptions on that date
  blocking_exceptions AS (
    SELECT
      se.start_time AS exc_start,
      se.end_time   AS exc_end,
      se.is_blocked
    FROM schedule_exceptions se
    WHERE se.doctor_id = p_doctor_id
      AND se.exception_date = p_target_date
      AND se.is_blocked = true
  ),

  -- Check if there is an all-day block (exc_start IS NULL means whole day is blocked)
  full_day_blocked AS (
    SELECT EXISTS (
      SELECT 1
      FROM blocking_exceptions be
      WHERE be.exc_start IS NULL
    ) AS is_blocked
  ),

  -- CTE 3: Generate candidate time slots from schedule blocks
  candidate_slots AS (
    SELECT
      gs AS candidate_start,
      gs + (p_slot_duration_minutes || ' minutes')::interval AS candidate_end
    FROM schedule_blocks sb
    CROSS JOIN LATERAL generate_series(
      sb.block_start,
      sb.block_end - (p_slot_duration_minutes || ' minutes')::interval,
      (p_slot_duration_minutes || ' minutes')::interval
    ) AS gs
    WHERE NOT (SELECT is_blocked FROM full_day_blocked)
  ),

  -- Remove candidate slots that overlap with partial blocking exceptions
  after_exceptions AS (
    SELECT cs.candidate_start, cs.candidate_end
    FROM candidate_slots cs
    WHERE NOT EXISTS (
      SELECT 1
      FROM blocking_exceptions be
      WHERE be.exc_start IS NOT NULL
        AND be.exc_end IS NOT NULL
        AND tstzrange(
              (p_target_date + be.exc_start) AT TIME ZONE p_timezone,
              (p_target_date + be.exc_end)   AT TIME ZONE p_timezone
            )
            &&
            tstzrange(cs.candidate_start, cs.candidate_end)
    )
  ),

  -- CTE 4: Filter out slots that overlap with existing active appointments
  available AS (
    SELECT ae.candidate_start, ae.candidate_end
    FROM after_exceptions ae
    WHERE NOT EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.doctor_id = p_doctor_id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND tstzrange(a.start_time, a.end_time)
            &&
            tstzrange(ae.candidate_start, ae.candidate_end)
    )
  )

  -- Final: Return only future slots if target date is today
  SELECT a.candidate_start, a.candidate_end
  FROM available a
  WHERE (
    p_target_date > (now() AT TIME ZONE p_timezone)::date
    OR a.candidate_start > now()
  )
  ORDER BY a.candidate_start;
END;
$$;
-- =============================================================================
-- Migration 00006: RLS Helper Functions
-- Security definer functions executed in postgres context to safely inspect
-- the authenticated user's role and associated clinic records without recursion.
-- =============================================================================

-- 1. Get current authenticated user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 2. Role check convenience helpers
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'doctor' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_nurse()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'nurse' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_receptionist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'receptionist' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_patient()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'patient' FROM profiles WHERE id = auth.uid()), false);
$$;

-- 3. Any staff member (doctor, nurse, receptionist, admin)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role IN ('doctor', 'nurse', 'receptionist', 'admin') FROM profiles WHERE id = auth.uid()), false);
$$;

-- 4. Clinical staff member (doctor, nurse, admin - can access clinical data)
CREATE OR REPLACE FUNCTION is_clinical_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role IN ('doctor', 'nurse', 'admin') FROM profiles WHERE id = auth.uid()), false);
$$;

-- 5. Current patient ID (lookup patient table via profile_id = auth.uid())
CREATE OR REPLACE FUNCTION current_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM patients WHERE profile_id = auth.uid() LIMIT 1;
$$;

-- 6. Current doctor ID (lookup doctor table via profile_id = auth.uid())
CREATE OR REPLACE FUNCTION current_doctor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM doctors WHERE profile_id = auth.uid() LIMIT 1;
$$;
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
-- =============================================================================
-- Migration 00008: Audit Logging Triggers and Access Function
-- Complies with the Philippine Data Privacy Act of 2012 by logging:
-- 1. Automatic changes (INSERT, UPDATE, DELETE) on medical_records.
-- 2. Explicit access/views via log_medical_record_access RPC function.
-- =============================================================================

-- 1. Trigger function for auditing modifications to medical records
CREATE OR REPLACE FUNCTION audit_medical_records_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'INSERT',
      'medical_records',
      NEW.id,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'UPDATE',
      'medical_records',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'DELETE',
      'medical_records',
      OLD.id,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to medical_records table
DROP TRIGGER IF EXISTS trg_audit_medical_records ON medical_records;
CREATE TRIGGER trg_audit_medical_records
  AFTER INSERT OR UPDATE OR DELETE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION audit_medical_records_change();

-- 2. RPC function for logging READ / VIEW access on sensitive medical records
CREATE OR REPLACE FUNCTION log_medical_record_access(
  p_record_id uuid,
  p_action    text DEFAULT 'VIEW'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    p_action,
    'medical_records',
    p_record_id,
    NULL,
    jsonb_build_object(
      'accessed_at', now(),
      'access_role', (SELECT role FROM profiles WHERE id = auth.uid())
    )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_medical_record_access(uuid, text) TO authenticated;
-- =============================================================================
-- Migration 00009: Auth Triggers for Automatic Profile & Patient Creation
-- Automatically initializes profiles and patients records upon auth.users signup.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_full_name text;
  v_phone text;
  v_dob date;
  v_address text;
  v_consent boolean;
BEGIN
  -- Extract metadata safely from raw_user_meta_data
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::user_role;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_address := NEW.raw_user_meta_data->>'address';
  v_consent := COALESCE((NEW.raw_user_meta_data->>'privacy_consent')::boolean, true);

  IF NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::date;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
    END;
  ELSE
    v_dob := NULL;
  END IF;

  -- 1. Create or update Profile
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    date_of_birth,
    address,
    created_at
  ) VALUES (
    NEW.id,
    v_role,
    v_full_name,
    v_phone,
    v_dob,
    v_address,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- 2. If Patient, create Patient record with DPA 2012 Consent timestamp
  IF v_role = 'patient' THEN
    INSERT INTO public.patients (
      profile_id,
      emergency_contact_name,
      emergency_contact_phone,
      blood_type,
      allergies,
      obstetric_history,
      privacy_consent,
      privacy_consent_at
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'emergency_contact_name',
      NEW.raw_user_meta_data->>'emergency_contact_phone',
      NEW.raw_user_meta_data->>'blood_type',
      NEW.raw_user_meta_data->>'allergies',
      NEW.raw_user_meta_data->>'obstetric_history',
      v_consent,
      CASE WHEN v_consent THEN now() ELSE NULL END
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
-- =============================================================================
-- Migration 00010: Enable Supabase Realtime for Appointments and Notifications
-- Allows mobile and web clients to subscribe to real-time changes immediately.
-- =============================================================================

-- Add tables to the supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
-- =============================================================================
-- Migration 00011: Automated Appointment Notifications & Reminder Functions
-- 1. Trigger to generate notification on appointment status change.
-- 2. Function to generate 24-hour and 2-hour reminders before appointments.
-- =============================================================================

-- 1. Trigger function on appointment status update
CREATE OR REPLACE FUNCTION notify_appointment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_doctor_name     text;
  v_service_name    text;
  v_title           text;
  v_body            text;
BEGIN
  -- Only trigger if status has changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Lookup patient auth user ID
  SELECT profile_id INTO v_patient_user_id
  FROM patients
  WHERE id = NEW.patient_id;

  IF (v_patient_user_id IS NULL) THEN
    RETURN NEW;
  END IF;

  -- Lookup doctor and service names
  SELECT p.full_name INTO v_doctor_name
  FROM doctors d
  JOIN profiles p ON p.id = d.profile_id
  WHERE d.id = NEW.doctor_id;

  SELECT s.name INTO v_service_name
  FROM services s
  WHERE s.id = NEW.service_id;

  -- Compose notification message based on status
  CASE NEW.status
    WHEN 'approved' THEN
      v_title := 'Appointment Confirmed 🎉';
      v_body  := format('Your %s appointment with %s scheduled for %s has been confirmed by clinic staff.',
                   COALESCE(v_service_name, 'visit'),
                   COALESCE(v_doctor_name, 'the doctor'),
                   to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
    WHEN 'rescheduled' THEN
      v_title := 'Appointment Rescheduled 🕒';
      v_body  := format('Your %s appointment with %s has been rescheduled to %s.',
                   COALESCE(v_service_name, 'visit'),
                   COALESCE(v_doctor_name, 'the doctor'),
                   to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
    WHEN 'cancelled' THEN
      v_title := 'Appointment Cancelled ⚠️';
      v_body  := format('Your %s appointment scheduled for %s has been cancelled.',
                   COALESCE(v_service_name, 'visit'),
                   to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
    WHEN 'completed' THEN
      v_title := 'Consultation Completed 🩺';
      v_body  := format('Your consultation record for %s has been archived. You can now view your clinical notes and prescriptions in the Records tab.',
                   COALESCE(v_service_name, 'your visit'));
    WHEN 'no_show' THEN
      v_title := 'Missed Appointment Notice';
      v_body  := format('You were marked as no-show for your %s on %s. Please re-book an available slot when ready.',
                   COALESCE(v_service_name, 'visit'),
                   to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY'));
    ELSE
      v_title := 'Appointment Update';
      v_body  := format('Status for your %s on %s is now %s.',
                   COALESCE(v_service_name, 'visit'),
                   to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY'),
                   NEW.status);
  END CASE;

  -- Insert notification row
  INSERT INTO notifications (user_id, title, body, is_read, created_at)
  VALUES (v_patient_user_id, v_title, v_body, false, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_appointment_status_change ON appointments;
CREATE TRIGGER trg_notify_appointment_status_change
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_status_change();


-- 2. Function to dispatch 24-hour and 2-hour appointment reminders
CREATE OR REPLACE FUNCTION dispatch_appointment_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  -- 24-Hour Reminders: Appointments approved and starting between 23h50m and 24h10m from now
  FOR r IN
    SELECT
      a.id AS appt_id,
      p.profile_id AS user_id,
      pr.full_name AS doctor_name,
      s.name AS service_name,
      a.start_time
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN profiles pr ON pr.id = d.profile_id
    JOIN services s ON s.id = a.service_id
    WHERE a.status = 'approved'
      AND a.start_time BETWEEN (now() + interval '23 hours 50 minutes') AND (now() + interval '24 hours 10 minutes')
      -- Avoid sending duplicate 24h reminder
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = p.profile_id
          AND n.title LIKE '%24-Hour Reminder%'
          AND n.created_at >= (now() - interval '2 days')
      )
  LOOP
    INSERT INTO notifications (user_id, title, body, is_read, created_at)
    VALUES (
      r.user_id,
      '24-Hour Appointment Reminder ⏰',
      format('Friendly reminder: You have an upcoming %s appointment tomorrow at %s with %s.',
        r.service_name,
        to_char(r.start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM'),
        r.doctor_name),
      false,
      now()
    );
    v_count := v_count + 1;
  END LOOP;

  -- 2-Hour Reminders: Appointments approved and starting between 1h50m and 2h10m from now
  FOR r IN
    SELECT
      a.id AS appt_id,
      p.profile_id AS user_id,
      pr.full_name AS doctor_name,
      s.name AS service_name,
      a.start_time
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN profiles pr ON pr.id = d.profile_id
    JOIN services s ON s.id = a.service_id
    WHERE a.status = 'approved'
      AND a.start_time BETWEEN (now() + interval '1 hour 50 minutes') AND (now() + interval '2 hours 10 minutes')
      -- Avoid sending duplicate 2h reminder
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = p.profile_id
          AND n.title LIKE '%2-Hour Reminder%'
          AND n.created_at >= (now() - interval '6 hours')
      )
  LOOP
    INSERT INTO notifications (user_id, title, body, is_read, created_at)
    VALUES (
      r.user_id,
      '2-Hour Appointment Reminder ⏰',
      format('Reminder: Your %s appointment with %s is starting in 2 hours at %s. Please arrive 15 minutes before your time.',
        r.service_name,
        r.doctor_name,
        to_char(r.start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM')),
      false,
      now()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
-- =============================================================================
-- Migration 00012: Patient Clinic Inquiries (Messaging Reception)
-- Optional feature for direct patient-to-clinic communication.
-- =============================================================================

CREATE TABLE IF NOT EXISTS inquiries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  subject     text        NOT NULL,
  message     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  reply       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_inquiries_patient_id ON inquiries(patient_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status     ON inquiries(status);

-- Enable RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "inquiries_select_policy"
  ON inquiries FOR SELECT
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR is_staff()
  );

CREATE POLICY "inquiries_insert_policy"
  ON inquiries FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = current_patient_id()
    OR is_staff()
  );

CREATE POLICY "inquiries_update_policy"
  ON inquiries FOR UPDATE
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR is_staff()
  )
  WITH CHECK (
    patient_id = current_patient_id()
    OR is_staff()
  );

-- Trigger for updated_at
CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Add to Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inquiries;
  END IF;
END $$;
