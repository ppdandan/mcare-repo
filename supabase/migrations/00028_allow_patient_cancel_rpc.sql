-- Preserve the existing patient cancellation RPC while keeping direct status edits blocked.
CREATE OR REPLACE FUNCTION public.require_appointment_workflow()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.start_time IS DISTINCT FROM OLD.start_time OR
    NEW.end_time IS DISTINCT FROM OLD.end_time OR
    NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
  ) THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('mcare.appointment_action', true), '') IN
    ('approve', 'reschedule', 'cancel', 'decline', 'complete') THEN
    RETURN NEW;
  END IF;

  IF public.current_user_role() = 'patient'
     AND NEW.status = 'cancelled'
     AND OLD.patient_id = public.current_patient_id()
     AND OLD.status IN ('pending', 'approved', 'rescheduled')
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time
     AND NEW.cancellation_reason IS NOT DISTINCT FROM OLD.cancellation_reason THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Use an appointment workflow action to change status or time'
    USING ERRCODE = '42501';
END;
$$;
