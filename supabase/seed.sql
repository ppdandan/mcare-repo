-- =============================================================================
-- Supabase Seed Data for M-Care OB-GYN Clinic Management System
-- Local test and evaluation seed with dummy users across all roles.
-- Passwords for all seeded users: Password123!
-- (Bcrypt hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi is 'password')
-- =============================================================================

-- Clean up existing data in reverse order of foreign keys
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE push_tokens CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE medical_records CASCADE;
TRUNCATE TABLE appointments CASCADE;
TRUNCATE TABLE schedule_exceptions CASCADE;
TRUNCATE TABLE doctor_schedules CASCADE;
TRUNCATE TABLE services CASCADE;
TRUNCATE TABLE doctors CASCADE;
TRUNCATE TABLE patients CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- Optional: Clean up auth users with seeded IDs if running in local Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DELETE FROM auth.users WHERE email LIKE '%@mcare.clinic' OR email LIKE '%@mcare.ph';

    -- 1. Insert auth.users for staff and patients
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
      -- Staff Accounts
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@mcare.clinic', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maria Santos (Admin)"}', now(), now()),
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'receptionist@mcare.clinic', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Reyes"}', now(), now()),
      ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nurse@mcare.clinic', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elena Cruz"}', now(), now()),
      -- Doctor Accounts
      ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dr.dizon@mcare.clinic', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Carmela Dizon"}', now(), now()),
      ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dr.lim@mcare.clinic', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Patricia Lim"}', now(), now()),
      ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dr.mercado@mcare.clinic', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Roberto Mercado"}', now(), now()),
      -- Patient Accounts
      ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient1@mcare.ph', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Bea Alonzo"}', now(), now()),
      ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient2@mcare.ph', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Clara Soriano"}', now(), now()),
      ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient3@mcare.ph', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Diana Mendoza"}', now(), now()),
      ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient4@mcare.ph', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Fatima Gomez"}', now(), now()),
      ('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient5@mcare.ph', '$2a$10$e8Z4wZ57s5bqvQhZq1qHre6wV482BvP/eTfLw7N454R7X5q8Xv5lW', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Grace Villanueva"}', now(), now());
  END IF;
END $$;

-- =============================================================================
-- 1. Profiles
-- =============================================================================
INSERT INTO profiles (id, role, full_name, phone, date_of_birth, address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin',        'Maria Santos',          '09171110001', '1982-04-12', 'Angeles City, Pampanga'),
  ('00000000-0000-0000-0000-000000000002', 'receptionist', 'Ana Reyes',             '09171110002', '1994-08-23', 'Balibago, Angeles City, Pampanga'),
  ('00000000-0000-0000-0000-000000000003', 'nurse',        'Elena Cruz, RN',        '09171110003', '1991-11-05', 'Mabalacat, Pampanga'),
  ('00000000-0000-0000-0000-000000000011', 'doctor',       'Dr. Carmela Dizon, MD', '09171110011', '1979-02-18', 'Angeles City, Pampanga'),
  ('00000000-0000-0000-0000-000000000012', 'doctor',       'Dr. Patricia Lim, MD',   '09171110012', '1984-06-30', 'San Fernando, Pampanga'),
  ('00000000-0000-0000-0000-000000000013', 'doctor',       'Dr. Roberto Mercado, MD','09171110013', '1975-09-14', 'Angeles City, Pampanga'),
  ('00000000-0000-0000-0000-000000000021', 'patient',      'Bea Alonzo',            '09181110021', '1996-03-15', 'Balibago, Angeles City, Pampanga'),
  ('00000000-0000-0000-0000-000000000022', 'patient',      'Clara Soriano',         '09181110022', '1993-07-22', 'Sto. Rosario, Angeles City, Pampanga'),
  ('00000000-0000-0000-0000-000000000023', 'patient',      'Diana Mendoza',         '09181110023', '1999-12-04', 'Dau, Mabalacat, Pampanga'),
  ('00000000-0000-0000-0000-000000000024', 'patient',      'Fatima Gomez',          '09181110024', '1990-05-19', 'San Fernando, Pampanga'),
  ('00000000-0000-0000-0000-000000000025', 'patient',      'Grace Villanueva',      '09181110025', '1988-10-09', 'Clark Freeport, Pampanga');

-- =============================================================================
-- 2. Doctors
-- =============================================================================
INSERT INTO doctors (id, profile_id, specialty, room) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'General Obstetrics & Gynecologic Ultrasound', 'Room 201 - Ultrasound Suite'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'Maternal-Fetal Medicine (High Risk Pregnancy)', 'Room 202 - Consultation A'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000013', 'Gynecologic Oncology & Preventive Health',   'Room 203 - Consultation B');

-- =============================================================================
-- 3. Patients
-- =============================================================================
INSERT INTO patients (id, profile_id, emergency_contact_name, emergency_contact_phone, blood_type, allergies, obstetric_history, privacy_consent, privacy_consent_at) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Marco Alonzo (Spouse)', '09192220001', 'O+', 'None', 'G1P0 (Primigravida, 24 weeks)', true, now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000022', 'James Soriano (Spouse)', '09192220002', 'A+', 'Penicillin', 'G2P1 (1 CS delivery 2022)', true, now()),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000023', 'Lucia Mendoza (Mother)', '09192220003', 'B+', 'None', 'G0P0 (Nulligravida, Annual checkup)', true, now()),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000024', 'Ramon Gomez (Brother)', '09192220004', 'AB+', 'Aspirin, Ibuprofen', 'G3P2 (2 Vaginal deliveries)', true, now()),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000025', 'Carlos Villanueva (Spouse)', '09192220005', 'O-', 'Sulfa drugs', 'G1P0 (14 weeks gestation)', true, now());

-- =============================================================================
-- 4. Services
-- =============================================================================
INSERT INTO services (id, name, description, duration_minutes, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Prenatal Checkup',             'Comprehensive maternal and fetal wellness evaluation including fundic height, fetal heart tone, and nutritional guidance.', 30, true),
  ('30000000-0000-0000-0000-000000000002', 'Obstetric & Pelvic Ultrasound',  'High-resolution 2D/3D diagnostic ultrasound for fetal biometry, amniotic fluid assessment, and pelvic anatomy.', 45, true),
  ('30000000-0000-0000-0000-000000000003', 'Pap Smear & Cervical Screening', 'Preventative cervical cytology screening with visual inspection with acetic acid (VIA).', 30, true),
  ('30000000-0000-0000-0000-000000000004', 'Family Planning Consultation',   'Contraceptive counseling, birth control prescription, and IUD/implant evaluation.', 30, true),
  ('30000000-0000-0000-0000-000000000005', 'General OB-GYN Consultation',    'Diagnosis and treatment for menstrual disorders, pelvic pain, infections, and menopause management.', 30, true);

-- =============================================================================
-- 5. Doctor Schedules (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
-- =============================================================================
INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time) VALUES
  -- Dr. Carmela Dizon: Monday (1), Wednesday (3), Friday (5): 09:00 - 16:00
  ('10000000-0000-0000-0000-000000000001', 1, '09:00:00', '16:00:00'),
  ('10000000-0000-0000-0000-000000000001', 3, '09:00:00', '16:00:00'),
  ('10000000-0000-0000-0000-000000000001', 5, '09:00:00', '16:00:00'),
  -- Dr. Patricia Lim: Tuesday (2), Thursday (4), Saturday (6): 09:00 - 15:00
  ('10000000-0000-0000-0000-000000000002', 2, '09:00:00', '15:00:00'),
  ('10000000-0000-0000-0000-000000000002', 4, '09:00:00', '15:00:00'),
  ('10000000-0000-0000-0000-000000000002', 6, '09:00:00', '14:00:00'),
  -- Dr. Roberto Mercado: Monday (1), Wednesday (3), Thursday (4): 13:00 - 18:00
  ('10000000-0000-0000-0000-000000000003', 1, '13:00:00', '18:00:00'),
  ('10000000-0000-0000-0000-000000000003', 3, '13:00:00', '18:00:00'),
  ('10000000-0000-0000-0000-000000000003', 4, '13:00:00', '18:00:00');

-- =============================================================================
-- 6. Schedule Exceptions (Sample leave / blocked hours)
-- =============================================================================
INSERT INTO schedule_exceptions (doctor_id, exception_date, start_time, end_time, reason, is_blocked) VALUES
  ('10000000-0000-0000-0000-000000000001', CURRENT_DATE + interval '7 days', NULL, NULL, 'Attending Philippine Obstetrical & Gynecological Society (POGS) Annual Congress', true),
  ('10000000-0000-0000-0000-000000000002', CURRENT_DATE + interval '3 days', '13:00:00', '15:00:00', 'Hospital Emergency Rounds at AUF Medical Center', true);

-- =============================================================================
-- 7. Appointments (Sample records covering all required statuses)
-- =============================================================================
INSERT INTO appointments (id, patient_id, doctor_id, service_id, start_time, end_time, status, notes) VALUES
  -- Completed past appointments
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   (CURRENT_DATE - interval '14 days' + time '09:30:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE - interval '14 days' + time '10:00:00') AT TIME ZONE 'Asia/Manila',
   'completed', 'Routine first trimester follow-up. Fetal heart beat confirmed.'),

  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   (CURRENT_DATE - interval '10 days' + time '10:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE - interval '10 days' + time '10:45:00') AT TIME ZONE 'Asia/Manila',
   'completed', 'Pelvic ultrasound performed. Biometry normal.'),

  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
   (CURRENT_DATE - interval '7 days' + time '14:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE - interval '7 days' + time '14:30:00') AT TIME ZONE 'Asia/Manila',
   'completed', 'Routine Pap smear screening. Specimen sent to laboratory.'),

  -- Past no-show
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005',
   (CURRENT_DATE - interval '5 days' + time '11:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE - interval '5 days' + time '11:30:00') AT TIME ZONE 'Asia/Manila',
   'no_show', 'Patient did not answer confirmation phone call.'),

  -- Cancelled appointment
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   (CURRENT_DATE - interval '2 days' + time '09:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE - interval '2 days' + time '09:30:00') AT TIME ZONE 'Asia/Manila',
   'cancelled', 'Cancelled by patient due to transportation conflict.'),

  -- Approved upcoming appointments
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   (CURRENT_DATE + interval '1 days' + time '10:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE + interval '1 days' + time '10:45:00') AT TIME ZONE 'Asia/Manila',
   'approved', 'Follow-up anomaly scan at 24 weeks.'),

  ('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   (CURRENT_DATE + interval '2 days' + time '11:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE + interval '2 days' + time '11:30:00') AT TIME ZONE 'Asia/Manila',
   'approved', 'High risk checkup for previous CS.'),

  -- Pending appointments (requested by patients from mobile app)
  ('40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005',
   (CURRENT_DATE + interval '4 days' + time '14:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE + interval '4 days' + time '14:30:00') AT TIME ZONE 'Asia/Manila',
   'pending', 'Patient requested consultation for irregular cycle.'),

  ('40000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004',
   (CURRENT_DATE + interval '5 days' + time '09:30:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE + interval '5 days' + time '10:00:00') AT TIME ZONE 'Asia/Manila',
   'pending', 'Family planning and subdermal implant inquiry.'),

  -- Rescheduled appointment
  ('40000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   (CURRENT_DATE + interval '6 days' + time '11:00:00') AT TIME ZONE 'Asia/Manila',
   (CURRENT_DATE + interval '6 days' + time '11:30:00') AT TIME ZONE 'Asia/Manila',
   'rescheduled', 'Moved from earlier slot due to patient request.');

-- =============================================================================
-- 8. Medical Records
-- =============================================================================
INSERT INTO medical_records (id, patient_id, doctor_id, appointment_id, visit_date, chief_complaint, history_of_present_illness, blood_pressure, heart_rate, temperature, weight_kg, diagnosis, prescription, notes) VALUES
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   CURRENT_DATE - interval '14 days',
   'Mild nausea and morning sickness; routine prenatal checkup',
   'Patient is a 28 y/o G1P0 at 22 weeks age of gestation presenting for routine evaluation.',
   '110/70', '76 bpm', '36.6 C', 58.50,
   'Single live intrauterine pregnancy at 22 weeks age of gestation, physiologically normal',
   '1. Ferrous Sulfate + Folic Acid 1 tab OD after meal\n2. Calcium Carbonate 500mg 1 tab BID\n3. Multivitamins for pregnancy 1 cap OD',
   'Encouraged adequate hydration and continued maternal milk supplementation. Advised anomaly scan next visit.'),

  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002',
   CURRENT_DATE - interval '10 days',
   'Lower abdominal heaviness and request for pelvic ultrasound',
   'Patient is a 31 y/o G2P1 (previous CS 2022) with mild discomfort upon prolonged standing.',
   '120/80', '80 bpm', '36.8 C', 64.20,
   'Normal pelvic sonogram. Prior lower uterine segment scar intact.',
   '1. Paracetamol 500mg PRN for pain (max 3x daily)\n2. Rest and abdominal binder support',
   'Follow-up in 2 weeks or sooner if severe cramping or vaginal spotting occurs.'),

  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003',
   CURRENT_DATE - interval '7 days',
   'Annual cervical cancer screening; no acute symptoms',
   'Patient is a 25 y/o nulligravida seeking routine preventive health screening.',
   '115/75', '72 bpm', '36.5 C', 52.00,
   'Cervix smooth, no lesions or signs of infection; Pap smear specimen obtained',
   'None required pending cytology laboratory results.',
   'Lab results expected within 5-7 business days. Patient instructed on accessing mobile portal.');

-- =============================================================================
-- 9. Notifications
-- =============================================================================
INSERT INTO notifications (user_id, title, body, is_read, created_at) VALUES
  ('00000000-0000-0000-0000-000000000021', 'Appointment Approved', 'Your Obstetric & Pelvic Ultrasound appointment for tomorrow has been approved.', false, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000021', 'Appointment Reminder', 'Friendly reminder: You have an upcoming visit tomorrow at 10:00 AM with Dr. Carmela Dizon.', false, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000022', 'Appointment Approved', 'Your Prenatal Checkup with Dr. Patricia Lim has been confirmed.', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000023', 'Booking Request Received', 'We have received your booking request for General Consultation. Staff will review shortly.', true, now() - interval '2 days');

-- =============================================================================
-- 10. Audit Logs
-- =============================================================================
INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, created_at) VALUES
  ('00000000-0000-0000-0000-000000000011', 'INSERT', 'medical_records', '50000000-0000-0000-0000-000000000001', NULL, '{"action":"Created initial medical record for Bea Alonzo"}'::jsonb, now() - interval '14 days'),
  ('00000000-0000-0000-0000-000000000011', 'VIEW', 'medical_records', '50000000-0000-0000-0000-000000000001', NULL, '{"access_role":"doctor","purpose":"Clinical review before follow-up"}'::jsonb, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000002', 'UPDATE', 'appointments', '40000000-0000-0000-0000-000000000006', '{"status":"pending"}'::jsonb, '{"status":"approved","staff":"Ana Reyes"}'::jsonb, now() - interval '2 hours');

