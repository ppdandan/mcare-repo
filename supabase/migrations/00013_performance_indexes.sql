-- =============================================================================
-- Migration 00013: Performance Optimization Indexes
-- Indexes for all columns filtered, searched, or sorted across Mobile and Web
-- =============================================================================

-- 1. Profiles: filtered by role, searched by full_name and phone
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- 2. Services: filtered by is_active flag and ordered by name
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);

-- 3. Doctor Schedules: filtered by doctor and weekday
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doc_weekday ON doctor_schedules(doctor_id, weekday);

-- 4. Schedule Exceptions: filtered by doctor and exception_date
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_doc_date ON schedule_exceptions(doctor_id, exception_date);

-- 5. Appointments: filtered by patient, status, and sorted by start_time
CREATE INDEX IF NOT EXISTS idx_appointments_patient_status_start ON appointments(patient_id, status, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_start ON appointments(doctor_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);

-- 6. Medical Records: filtered by visit_date, patient, and doctor
CREATE INDEX IF NOT EXISTS idx_medical_records_visit_date ON medical_records(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_appointment_id ON medical_records(appointment_id);

-- 7. Push Tokens: looked up by user_id
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
