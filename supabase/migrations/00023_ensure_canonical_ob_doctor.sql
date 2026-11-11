-- Keep Dr. Bernice Paule's clinic entry canonical on every environment.
-- Migration 00015 creates the profile and safely consolidates legacy doctor
-- records before this migration runs; this upsert is safe to reapply.
DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT p.id INTO v_profile_id
  FROM public.profiles AS p
  WHERE p.role = 'doctor'
    AND p.full_name = 'Dr. Bernice Paule'
  ORDER BY p.id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Canonical doctor profile for Dr. Bernice Paule is missing';
  END IF;

  INSERT INTO public.doctors (profile_id, specialty, room)
  VALUES (v_profile_id, 'OB-GYNE / Sonologist', 'Consultation Room')
  ON CONFLICT (profile_id) DO UPDATE
    SET specialty = EXCLUDED.specialty,
        room = COALESCE(public.doctors.room, EXCLUDED.room);

  IF EXISTS (
    SELECT 1
    FROM public.doctors AS d
    WHERE d.profile_id <> v_profile_id
  ) THEN
    RAISE EXCEPTION 'Unexpected additional doctor records remain after canonical doctor migration';
  END IF;
END;
$$;
