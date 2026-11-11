-- Enforce clinic weekday booking rules for all API clients, including direct inserts.
-- NOT VALID preserves any existing legacy rows while enforcing the rule for all new
-- inserts and changed rows. Asia/Manila is explicit so the result is independent of
-- the database session timezone.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_weekdays_only'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_weekdays_only
      CHECK (EXTRACT(ISODOW FROM start_time AT TIME ZONE 'Asia/Manila') BETWEEN 1 AND 5)
      NOT VALID;
  END IF;
END;
$$;

-- Do not return availability for a weekend even if a legacy schedule includes one.
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_doctor_id uuid,
  p_target_date date,
  p_slot_duration_minutes integer DEFAULT 30,
  p_timezone text DEFAULT 'Asia/Manila'
)
RETURNS TABLE(slot_start timestamptz, slot_end timestamptz)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_timezone <> 'Asia/Manila' OR EXTRACT(ISODOW FROM p_target_date) IN (6, 7) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH schedule_blocks AS (
    SELECT ((p_target_date + ds.start_time) AT TIME ZONE p_timezone) AS block_start,
           ((p_target_date + ds.end_time) AT TIME ZONE p_timezone) AS block_end
    FROM public.doctor_schedules ds
    WHERE ds.doctor_id = p_doctor_id
      AND ds.weekday = EXTRACT(DOW FROM p_target_date)::integer
  ),
  blocking_exceptions AS (
    SELECT se.start_time AS exc_start, se.end_time AS exc_end
    FROM public.schedule_exceptions se
    WHERE se.doctor_id = p_doctor_id
      AND se.exception_date = p_target_date
      AND se.is_blocked = true
  ),
  full_day_blocked AS (
    SELECT EXISTS (SELECT 1 FROM blocking_exceptions WHERE exc_start IS NULL) AS is_blocked
  ),
  candidate_slots AS (
    SELECT gs AS candidate_start,
           gs + (p_slot_duration_minutes || ' minutes')::interval AS candidate_end
    FROM schedule_blocks sb
    CROSS JOIN LATERAL generate_series(
      sb.block_start,
      sb.block_end - (p_slot_duration_minutes || ' minutes')::interval,
      (p_slot_duration_minutes || ' minutes')::interval
    ) AS gs
    WHERE NOT (SELECT is_blocked FROM full_day_blocked)
  ),
  after_exceptions AS (
    SELECT cs.candidate_start, cs.candidate_end
    FROM candidate_slots cs
    WHERE NOT EXISTS (
      SELECT 1 FROM blocking_exceptions be
      WHERE be.exc_start IS NOT NULL AND be.exc_end IS NOT NULL
        AND tstzrange(
          (p_target_date + be.exc_start) AT TIME ZONE p_timezone,
          (p_target_date + be.exc_end) AT TIME ZONE p_timezone
        ) && tstzrange(cs.candidate_start, cs.candidate_end)
    )
  )
  SELECT ae.candidate_start, ae.candidate_end
  FROM after_exceptions ae
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id
      AND a.status <> 'cancelled'
      AND tstzrange(a.start_time, a.end_time) && tstzrange(ae.candidate_start, ae.candidate_end)
  )
    AND (p_target_date > (now() AT TIME ZONE p_timezone)::date OR ae.candidate_start > now())
  ORDER BY ae.candidate_start;
END;
$$;
