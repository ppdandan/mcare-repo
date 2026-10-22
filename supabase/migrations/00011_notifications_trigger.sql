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

