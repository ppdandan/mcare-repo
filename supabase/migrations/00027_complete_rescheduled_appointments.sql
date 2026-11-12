-- A rescheduled appointment remains approved for doctor completion.
CREATE OR REPLACE FUNCTION public.complete_appointment(p_appointment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.appointment_status;
BEGIN
  IF coalesce(public.current_user_role()::text, '') <> 'doctor' OR public.current_doctor_id() IS NULL THEN
    RAISE EXCEPTION 'Doctor access is required' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.appointments
  WHERE id = p_appointment_id AND doctor_id = public.current_doctor_id() FOR UPDATE;
  IF NOT FOUND OR v_status NOT IN ('approved', 'rescheduled') THEN
    RAISE EXCEPTION 'Only approved or rescheduled appointments can be completed' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('mcare.appointment_action', 'complete', true);
  UPDATE public.appointments SET status = 'completed', updated_at = now() WHERE id = p_appointment_id;
END;
$$;
