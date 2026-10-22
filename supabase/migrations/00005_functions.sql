-- =============================================================================
-- Function: get_available_slots
-- Returns available booking slots for a doctor on a given date.
-- Uses doctor_schedules, schedule_exceptions, and existing appointments.
-- Follows Asia/Manila (PHT, UTC+8) clinic local time.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_slots(
  p_doctor_id             uuid,
  p_target_date           date,
  p_slot_duration_minutes integer DEFAULT 30,
  p_timezone              text    DEFAULT 'Asia/Manila'
)
RETURNS TABLE(slot_start timestamptz, slot_end timestamptz)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY

  -- CTE 1: Get the doctor's schedule blocks for the target weekday
  WITH schedule_blocks AS (
    SELECT
      ((p_target_date + ds.start_time) AT TIME ZONE p_timezone) AS block_start,
      ((p_target_date + ds.end_time)   AT TIME ZONE p_timezone) AS block_end
    FROM doctor_schedules ds
    WHERE ds.doctor_id = p_doctor_id
      AND ds.weekday = EXTRACT(DOW FROM p_target_date)::integer
  ),

  -- CTE 2: Check for blocking schedule exceptions on that date
  blocking_exceptions AS (
    SELECT
      se.start_time AS exc_start,
      se.end_time   AS exc_end,
      se.is_blocked
    FROM schedule_exceptions se
    WHERE se.doctor_id = p_doctor_id
      AND se.exception_date = p_target_date
      AND se.is_blocked = true
  ),

  -- Check if there is an all-day block (exc_start IS NULL means whole day is blocked)
  full_day_blocked AS (
    SELECT EXISTS (
      SELECT 1
      FROM blocking_exceptions be
      WHERE be.exc_start IS NULL
    ) AS is_blocked
  ),

  -- CTE 3: Generate candidate time slots from schedule blocks
  candidate_slots AS (
    SELECT
      gs AS candidate_start,
      gs + (p_slot_duration_minutes || ' minutes')::interval AS candidate_end
    FROM schedule_blocks sb
    CROSS JOIN LATERAL generate_series(
      sb.block_start,
      sb.block_end - (p_slot_duration_minutes || ' minutes')::interval,
      (p_slot_duration_minutes || ' minutes')::interval
    ) AS gs
    WHERE NOT (SELECT is_blocked FROM full_day_blocked)
  ),

  -- Remove candidate slots that overlap with partial blocking exceptions
  after_exceptions AS (
    SELECT cs.candidate_start, cs.candidate_end
    FROM candidate_slots cs
    WHERE NOT EXISTS (
      SELECT 1
      FROM blocking_exceptions be
      WHERE be.exc_start IS NOT NULL
        AND be.exc_end IS NOT NULL
        AND tstzrange(
              (p_target_date + be.exc_start) AT TIME ZONE p_timezone,
              (p_target_date + be.exc_end)   AT TIME ZONE p_timezone
            )
            &&
            tstzrange(cs.candidate_start, cs.candidate_end)
    )
  ),

  -- CTE 4: Filter out slots that overlap with existing active appointments
  available AS (
    SELECT ae.candidate_start, ae.candidate_end
    FROM after_exceptions ae
    WHERE NOT EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.doctor_id = p_doctor_id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND tstzrange(a.start_time, a.end_time)
            &&
            tstzrange(ae.candidate_start, ae.candidate_end)
    )
  )

  -- Final: Return only future slots if target date is today
  SELECT a.candidate_start, a.candidate_end
  FROM available a
  WHERE (
    p_target_date > (now() AT TIME ZONE p_timezone)::date
    OR a.candidate_start > now()
  )
  ORDER BY a.candidate_start;
END;
$$;
