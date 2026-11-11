-- Publish the clinic hours supplied for Dr. Bernice Paule.
-- Weekday numbering follows doctor_schedules: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
-- The unique (doctor_id, weekday, start_time) key makes this safe to re-run.
DO $$
DECLARE
  v_doctor_id uuid;
BEGIN
  SELECT d.id INTO v_doctor_id
  FROM public.doctors d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.full_name = 'Dr. Bernice Paule'
  LIMIT 1;

  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Cannot publish clinic hours: Dr. Bernice Paule doctor record was not found';
  END IF;

  INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time)
  SELECT v_doctor_id, schedule.weekday, schedule.start_time, schedule.end_time
  FROM (VALUES
    (1, '10:00'::time, '12:00'::time), (1, '13:00'::time, '18:00'::time),
    (2, '10:00'::time, '12:00'::time), (2, '13:00'::time, '18:00'::time),
    (3, '10:00'::time, '12:00'::time), (3, '13:00'::time, '18:00'::time),
    (4, '10:00'::time, '12:00'::time), (4, '13:00'::time, '18:00'::time),
    (5, '10:00'::time, '12:00'::time), (5, '13:00'::time, '18:00'::time)
  ) AS schedule(weekday, start_time, end_time)
  ON CONFLICT (doctor_id, weekday, start_time)
  DO UPDATE SET end_time = EXCLUDED.end_time;
END;
$$;
