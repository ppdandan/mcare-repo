-- Enforce patient booking constraints at the database boundary. Patients must
-- use book_appointment(); trusted staff retain direct inserts through RLS.
DROP POLICY IF EXISTS "appointments_insert_policy" ON public.appointments;
CREATE POLICY "appointments_insert_policy"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

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

-- Patients may submit an inquiry and read replies, but only staff can edit the
-- reply or status fields.
DROP POLICY IF EXISTS "inquiries_update_policy" ON public.inquiries;
CREATE POLICY "inquiries_update_policy"
  ON public.inquiries FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- Audit records are written only by SECURITY DEFINER audit triggers/RPCs.
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.log_medical_record_access(
  p_record_id uuid,
  p_action text DEFAULT 'VIEW'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR upper(coalesce(p_action, '')) <> 'VIEW' THEN
    RAISE EXCEPTION 'Invalid medical-record access log request'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.medical_records mr
    WHERE mr.id = p_record_id
      AND (
        mr.patient_id = current_patient_id()
        OR is_clinical_staff()
      )
  ) THEN
    RAISE EXCEPTION 'Medical record not found or access is not permitted'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(), 'VIEW', 'medical_records', p_record_id, NULL,
    jsonb_build_object(
      'accessed_at', now(),
      'access_role', (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_medical_record_access(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_medical_record_access(uuid, text)
  TO authenticated;
