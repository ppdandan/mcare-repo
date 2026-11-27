DROP FUNCTION IF EXISTS public.report_walk_in_visit(uuid, uuid, uuid, timestamptz, timestamptz, text);

CREATE OR REPLACE FUNCTION public.report_walk_in_visit(
  p_doctor_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
  v_patient_id uuid := public.current_patient_id();
BEGIN
  IF NOT public.is_patient() OR v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient access is required' USING ERRCODE = '42501';
  END IF;
  -- Insert as pending walk-in appointment; status stays pending for staff review
  INSERT INTO public.appointments (
    patient_id,
    doctor_id,
    service_id,
    start_time,
    end_time,
    status,
    notes,
    is_walk_in
  ) VALUES (
    v_patient_id,
    p_doctor_id,
    p_service_id,
    p_start_time,
    p_end_time,
    'pending',
    p_notes,
    true
  )
  RETURNING id INTO v_appointment_id;

  -- Record audit log entry
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    'WALK_IN_REPORT',
    'appointments',
    v_appointment_id,
    NULL,
    jsonb_build_object(
      'patient_id', v_patient_id,
      'doctor_id', p_doctor_id,
      'service_id', p_service_id,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'notes', p_notes
    )
  );

  RETURN v_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_book_walk_in(
  p_patient_id uuid,
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
  v_duration integer;
  v_end_time timestamptz;
  v_appointment_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access is required' USING ERRCODE = '42501';
  END IF;

  SELECT s.duration_minutes INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id AND s.is_active = true;
  IF v_duration IS NULL OR v_duration < 1 THEN
    RAISE EXCEPTION 'The selected service is unavailable'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = p_doctor_id) THEN
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

  -- Double-booking guard: the GiST exclusion constraint (no_doctor_double_booking)
  -- is enforced by PostgreSQL on every INSERT, regardless of is_walk_in.
  -- It triggers exclusion_violation which we catch below.

  INSERT INTO public.appointments (
    patient_id, doctor_id, service_id, start_time, end_time, status, notes, is_walk_in
  ) VALUES (
    p_patient_id, p_doctor_id, p_service_id, p_start_time, v_end_time,
    'pending', NULLIF(btrim(p_notes), ''),
    true
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'That appointment time was just taken; choose another slot'
    USING ERRCODE = '23P01';
END;
$$;

-- Permissions: authenticated users (including staff) can execute
REVOKE ALL ON FUNCTION public.report_walk_in_visit(uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_walk_in_visit(uuid, uuid, timestamptz, timestamptz, text) TO authenticated;
REVOKE ALL ON FUNCTION public.staff_book_walk_in(uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_book_walk_in(uuid, uuid, uuid, timestamptz, text) TO authenticated;
