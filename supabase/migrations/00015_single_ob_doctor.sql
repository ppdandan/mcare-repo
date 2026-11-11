-- Ensure one canonical OB-GYNE doctor record. Existing clinical data is moved to
-- that record before duplicate doctor rows are removed. Re-running is safe.
DO $$
DECLARE
  v_profile_id uuid;
  v_doctor_id uuid;
  v_conflict_count integer;
BEGIN
  SELECT d.profile_id INTO v_profile_id
  FROM public.doctors d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.full_name = 'Dr. Bernice Paule'
  ORDER BY d.id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    SELECT p.id INTO v_profile_id
    FROM public.profiles p
    WHERE p.full_name = 'Dr. Bernice Paule'
    ORDER BY p.id
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    SELECT u.id INTO v_profile_id
    FROM auth.users u
    WHERE lower(u.email) = 'bernice.paule@mcare.clinic'
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    SELECT d.profile_id INTO v_profile_id
    FROM public.doctors d
    ORDER BY d.id
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    v_profile_id := '00000000-0000-4000-8000-000000000015'::uuid;
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_profile_id, 'authenticated', 'authenticated',
      'bernice.paule@mcare.clinic', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"doctor","full_name":"Dr. Bernice Paule"}'::jsonb, now(), now()
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.profiles (id, role, full_name)
  VALUES (v_profile_id, 'doctor', 'Dr. Bernice Paule')
  ON CONFLICT (id) DO UPDATE
    SET role = 'doctor', full_name = 'Dr. Bernice Paule';

  INSERT INTO public.doctors (profile_id, specialty, room)
  VALUES (v_profile_id, 'OB-GYNE / Sonologist', 'Consultation Room')
  ON CONFLICT (profile_id) DO UPDATE
    SET specialty = EXCLUDED.specialty,
        room = COALESCE(public.doctors.room, EXCLUDED.room);

  SELECT d.id INTO v_doctor_id
  FROM public.doctors d
  WHERE d.profile_id = v_profile_id;

  -- Reassigning legacy appointments can violate the database exclusion rule.
  -- Abort with a useful error rather than canceling or dropping clinical data.
  SELECT count(*) INTO v_conflict_count
  FROM public.appointments a
  JOIN public.appointments b
    ON a.id < b.id
   AND a.doctor_id <> b.doctor_id
   AND a.status <> 'cancelled'
   AND b.status <> 'cancelled'
   AND tstzrange(a.start_time, a.end_time) && tstzrange(b.start_time, b.end_time);

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Cannot merge doctor records: % overlapping active appointments need review first', v_conflict_count;
  END IF;

  -- Keep only the selected doctor's own schedule and exceptions. Other
  -- doctors' schedule rows are removed by their FK cascade below.

  UPDATE public.appointments
  SET doctor_id = v_doctor_id
  WHERE doctor_id <> v_doctor_id;

  UPDATE public.medical_records
  SET doctor_id = v_doctor_id
  WHERE doctor_id <> v_doctor_id;

  DELETE FROM public.doctors
  WHERE id <> v_doctor_id;
END;
$$;
