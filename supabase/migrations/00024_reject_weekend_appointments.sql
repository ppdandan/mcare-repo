-- Reject Saturday and Sunday appointments in clinic local time, even when a
-- client bypasses the booking UI or calls the database function directly.
CREATE OR REPLACE FUNCTION public.reject_weekend_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(DOW FROM NEW.start_time AT TIME ZONE 'Asia/Manila') IN (0, 6) THEN
    RAISE EXCEPTION 'Weekend appointment bookings are not allowed'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_weekend_appointment ON public.appointments;
CREATE TRIGGER trg_reject_weekend_appointment
  BEFORE INSERT OR UPDATE OF start_time ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_weekend_appointment();

-- Keep the patient RPC's error explicit, before slot lookup or insertion.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_doctor_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_duration integer;
  v_end_time timestamptz;
  v_appointment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in is required to book an appointment'
      USING ERRCODE = '42501';
  END IF;

  v_patient_id := current_patient_id();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient access is required to book an appointment'
      USING ERRCODE = '42501';
  END IF;

  IF EXTRACT(DOW FROM p_start_time AT TIME ZONE 'Asia/Manila') IN (0, 6) THEN
    RAISE EXCEPTION 'Weekend appointment bookings are not allowed'
      USING ERRCODE = '22023';
  END IF;

  SELECT s.duration_minutes INTO v_duration
  FROM public.services AS s
  WHERE s.id = p_service_id AND s.is_active = true;
  IF v_duration IS NULL OR v_duration < 1 THEN
    RAISE EXCEPTION 'The selected service is unavailable'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctors AS d WHERE d.id = p_doctor_id) THEN
    RAISE EXCEPTION 'The selected doctor is unavailable'
      USING ERRCODE = '22023';
  END IF;

  v_end_time := p_start_time + make_interval(mins => v_duration);

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_available_slots(
      p_doctor_id,
      (p_start_time AT TIME ZONE 'Asia/Manila')::date,
      v_duration,
      'Asia/Manila'
    ) AS slot
    WHERE slot.slot_start = p_start_time
      AND slot.slot_end = v_end_time
  ) THEN
    RAISE EXCEPTION 'That appointment time is unavailable; choose another slot'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.appointments (
    patient_id, doctor_id, service_id, start_time, end_time, status, notes
  ) VALUES (
    v_patient_id, p_doctor_id, p_service_id, p_start_time, v_end_time,
    'pending', NULLIF(btrim(p_notes), '')
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'That appointment time was just taken; choose another slot'
    USING ERRCODE = '23P01';
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, timestamptz, text)
  TO authenticated;
