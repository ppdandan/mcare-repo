-- Role-checked RPCs own appointment status/time changes.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE OR REPLACE FUNCTION public.require_appointment_workflow()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.start_time IS DISTINCT FROM OLD.start_time OR
    NEW.end_time IS DISTINCT FROM OLD.end_time OR
    NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
  ) AND coalesce(current_setting('mcare.appointment_action', true), '') NOT IN
    ('approve', 'reschedule', 'cancel', 'decline', 'complete') THEN
    RAISE EXCEPTION 'Use an appointment workflow action to change status or time' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_require_appointment_workflow ON public.appointments;
CREATE TRIGGER trg_require_appointment_workflow BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.require_appointment_workflow();

CREATE OR REPLACE FUNCTION public.approve_appointment(p_appointment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.appointment_status;
BEGIN
  IF coalesce(public.current_user_role()::text, '') NOT IN ('admin', 'receptionist') THEN
    RAISE EXCEPTION 'Admin or receptionist access is required' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending appointments can be approved' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('mcare.appointment_action', 'approve', true);
  UPDATE public.appointments SET status = 'approved', cancellation_reason = NULL, updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid, p_start_time timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_duration integer;
  v_local_start timestamp;
  v_weekday integer;
  v_end_time timestamptz;
BEGIN
  IF coalesce(public.current_user_role()::text, '') NOT IN ('admin', 'receptionist') THEN
    RAISE EXCEPTION 'Admin or receptionist access is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR v_appointment.status NOT IN ('pending', 'approved', 'rescheduled') THEN
    RAISE EXCEPTION 'This appointment can no longer be rescheduled' USING ERRCODE = 'P0001';
  END IF;
  IF p_start_time IS NULL OR p_start_time <= now() THEN
    RAISE EXCEPTION 'Choose a future appointment time' USING ERRCODE = '22023';
  END IF;
  SELECT duration_minutes INTO v_duration FROM public.services
  WHERE id = v_appointment.service_id AND is_active = true;
  IF v_duration IS NULL OR v_duration < 1 THEN
    RAISE EXCEPTION 'The selected service is unavailable' USING ERRCODE = '22023';
  END IF;
  v_local_start := p_start_time AT TIME ZONE 'Asia/Manila';
  v_weekday := EXTRACT(DOW FROM v_local_start)::integer;
  IF v_weekday IN (0, 6) THEN
    RAISE EXCEPTION 'Weekend appointments are not allowed' USING ERRCODE = '22023';
  END IF;
  v_end_time := p_start_time + make_interval(mins => v_duration);

  IF NOT EXISTS (
    SELECT 1 FROM public.doctor_schedules ds
    WHERE ds.doctor_id = v_appointment.doctor_id AND ds.weekday = v_weekday
      AND v_local_start::time >= ds.start_time
      AND v_local_start::time + make_interval(mins => v_duration) <= ds.end_time
      AND mod(EXTRACT(EPOCH FROM (v_local_start::time - ds.start_time))::integer, v_duration * 60) = 0
  ) THEN
    RAISE EXCEPTION 'Choose an available slot during clinic hours' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.schedule_exceptions se
    WHERE se.doctor_id = v_appointment.doctor_id AND se.exception_date = v_local_start::date AND se.is_blocked
      AND (se.start_time IS NULL OR se.end_time IS NULL OR
        (v_local_start::time < se.end_time AND v_local_start::time + make_interval(mins => v_duration) > se.start_time))
  ) THEN
    RAISE EXCEPTION 'Choose a time outside the doctor’s blocked schedule' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id <> v_appointment.id
      AND a.doctor_id = v_appointment.doctor_id AND a.status <> 'cancelled'
      AND tstzrange(a.start_time, a.end_time) && tstzrange(p_start_time, v_end_time)
  ) THEN
    RAISE EXCEPTION 'That appointment time is already taken' USING ERRCODE = '23P01';
  END IF;
  PERFORM set_config('mcare.appointment_action', 'reschedule', true);
  UPDATE public.appointments SET start_time = p_start_time, end_time = v_end_time,
    status = 'rescheduled', cancellation_reason = NULL, updated_at = now()
  WHERE id = v_appointment.id;
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'That appointment time is already taken' USING ERRCODE = '23P01';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.appointment_status;
BEGIN
  IF coalesce(public.current_user_role()::text, '') NOT IN ('admin', 'receptionist') THEN
    RAISE EXCEPTION 'Admin or receptionist access is required' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A cancellation reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR v_status NOT IN ('pending', 'approved', 'rescheduled') THEN
    RAISE EXCEPTION 'This appointment can no longer be cancelled' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('mcare.appointment_action', 'cancel', true);
  UPDATE public.appointments SET status = 'cancelled', cancellation_reason = btrim(p_reason), updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_appointment(p_appointment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.appointment_status;
BEGIN
  IF coalesce(public.current_user_role()::text, '') NOT IN ('admin', 'receptionist') THEN
    RAISE EXCEPTION 'Admin or receptionist access is required' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A decline reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending appointments can be declined' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('mcare.appointment_action', 'decline', true);
  UPDATE public.appointments SET status = 'cancelled', cancellation_reason = btrim(p_reason), updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.appointment_status;
BEGIN
  IF coalesce(public.current_user_role()::text, '') <> 'doctor' OR public.current_doctor_id() IS NULL THEN
    RAISE EXCEPTION 'Doctor access is required' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.appointments
  WHERE id = p_appointment_id AND doctor_id = public.current_doctor_id() FOR UPDATE;
  IF NOT FOUND OR v_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved appointments can be completed' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('mcare.appointment_action', 'complete', true);
  UPDATE public.appointments SET status = 'completed', updated_at = now() WHERE id = p_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_appointment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_appointment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_appointment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_appointment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_doctor text;
  v_service text;
  v_title text;
  v_body text;
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT profile_id INTO v_user_id FROM public.patients WHERE id = NEW.patient_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.full_name INTO v_doctor FROM public.doctors d JOIN public.profiles p ON p.id = d.profile_id WHERE d.id = NEW.doctor_id;
  SELECT name INTO v_service FROM public.services WHERE id = NEW.service_id;
  v_action := coalesce(current_setting('mcare.appointment_action', true), '');

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_title := 'Appointment Pending Approval';
    v_body := format('Your %s appointment request with %s for %s is pending clinic approval.',
      coalesce(v_service, 'visit'), coalesce(v_doctor, 'the doctor'),
      to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
  ELSE
    CASE NEW.status
      WHEN 'approved' THEN
        v_title := 'Appointment Approved';
        v_body := format('Your %s appointment with %s for %s has been approved.', coalesce(v_service, 'visit'),
          coalesce(v_doctor, 'the doctor'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
      WHEN 'rescheduled' THEN
        v_title := 'Appointment Rescheduled';
        v_body := format('Your %s appointment with %s has been rescheduled to %s.', coalesce(v_service, 'visit'),
          coalesce(v_doctor, 'the doctor'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
      WHEN 'cancelled' THEN
        IF v_action = 'decline' THEN
          v_title := 'Appointment Request Declined';
          v_body := format('Your %s appointment request for %s was declined. Reason: %s', coalesce(v_service, 'visit'),
            to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'),
            coalesce(NEW.cancellation_reason, 'Please contact the clinic for details.'));
        ELSE
          v_title := 'Appointment Cancelled';
          v_body := format('Your %s appointment for %s has been cancelled. Reason: %s', coalesce(v_service, 'visit'),
            to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'),
            coalesce(NEW.cancellation_reason, 'Please contact the clinic for details.'));
        END IF;
      WHEN 'completed' THEN
        v_title := 'Appointment Completed';
        v_body := format('Your consultation record for %s is ready to view in the M-Care mobile app.', coalesce(v_service, 'your visit'));
      ELSE
        v_title := 'Appointment Update';
        v_body := format('The status of your appointment for %s is now %s.', to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY'), NEW.status);
    END CASE;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, is_read, created_at)
  VALUES (v_user_id, v_title, v_body, false, now());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_appointment_status_change ON public.appointments;
CREATE TRIGGER trg_notify_appointment_status_change AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_status_change();
