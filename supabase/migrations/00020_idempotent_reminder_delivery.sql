-- Give each appointment reminder a stable identity so concurrent or repeated
-- scheduler calls cannot create duplicate reminders. RLS remains enabled.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reminder_kind text,
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_reminder_kind_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_reminder_kind_check
      CHECK (reminder_kind IS NULL OR reminder_kind IN ('24h', '2h'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_appointment_reminder_unique
  ON public.notifications (appointment_id, reminder_kind)
  WHERE appointment_id IS NOT NULL AND reminder_kind IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dispatch_appointment_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_inserted integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT a.id AS appt_id, p.profile_id AS user_id, pr.full_name AS doctor_name,
           s.name AS service_name, a.start_time
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.patient_id
    JOIN public.doctors d ON d.id = a.doctor_id
    JOIN public.profiles pr ON pr.id = d.profile_id
    JOIN public.services s ON s.id = a.service_id
    WHERE a.status = 'approved'
      AND a.start_time BETWEEN now() + interval '23 hours 50 minutes'
                           AND now() + interval '24 hours 10 minutes'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, appointment_id, reminder_kind)
    VALUES (r.user_id, '24-Hour Appointment Reminder',
      format('Friendly reminder: You have an upcoming %s appointment tomorrow at %s with %s.',
        r.service_name, to_char(r.start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM'), r.doctor_name),
      r.appt_id, '24h')
    ON CONFLICT (appointment_id, reminder_kind)
      WHERE appointment_id IS NOT NULL AND reminder_kind IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  FOR r IN
    SELECT a.id AS appt_id, p.profile_id AS user_id, pr.full_name AS doctor_name,
           s.name AS service_name, a.start_time
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.patient_id
    JOIN public.doctors d ON d.id = a.doctor_id
    JOIN public.profiles pr ON pr.id = d.profile_id
    JOIN public.services s ON s.id = a.service_id
    WHERE a.status = 'approved'
      AND a.start_time BETWEEN now() + interval '1 hour 50 minutes'
                           AND now() + interval '2 hours 10 minutes'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, appointment_id, reminder_kind)
    VALUES (r.user_id, '2-Hour Appointment Reminder',
      format('Reminder: Your %s appointment with %s is starting in 2 hours at %s. Please arrive 15 minutes before your time.',
        r.service_name, r.doctor_name, to_char(r.start_time AT TIME ZONE 'Asia/Manila', 'HH12:MI AM')),
      r.appt_id, '2h')
    ON CONFLICT (appointment_id, reminder_kind)
      WHERE appointment_id IS NOT NULL AND reminder_kind IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_appointment_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_appointment_reminders() TO service_role;
