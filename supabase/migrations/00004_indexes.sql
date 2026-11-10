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
