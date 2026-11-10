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
