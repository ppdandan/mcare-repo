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
