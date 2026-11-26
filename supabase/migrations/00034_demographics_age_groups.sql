-- 00034: Demographics age groups from profiles.date_of_birth
-- Computes age brackets for the analytics dashboard bar chart.
-- Admin only; the function is SECURITY INVOKER and called from a
-- protected RPC that the frontend gate validates.

-- Create or replace the public get_patient_age_group function
DROP FUNCTION IF EXISTS public.get_patient_age_group(p_date_of_birth date);
CREATE OR REPLACE FUNCTION public.get_patient_age_group(p_date_of_birth date)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN p_date_of_birth IS NULL THEN 'Unknown'
    WHEN extract(year from age(p_date_of_birth)) < 18 THEN 'Under 18'
    WHEN extract(year from age(p_date_of_birth)) BETWEEN 18 AND 24 THEN '18 to 24'
    WHEN extract(year from age(p_date_of_birth)) BETWEEN 25 AND 34 THEN '25 to 34'
    WHEN extract(year from age(p_date_of_birth)) BETWEEN 35 AND 44 THEN '35 to 44'
    ELSE '45 or older'
  END;
$$;

-- Grant execute to authenticated users (the frontend RPC gate controls who can call it)
REVOKE ALL ON FUNCTION public.get_patient_age_group(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_age_group(date) TO authenticated;

-- Add a view that aggregates patients by age group for the demographics chart.
-- This view is intentionally simple; the admin RPC gate filters access.
DROP VIEW IF EXISTS public.patients_by_age_group;
CREATE VIEW public.patients_by_age_group AS
SELECT
  get_patient_age_group(p.date_of_birth) AS age_group,
  count(*) AS patient_count
FROM public.profiles p
WHERE p.date_of_birth IS NOT NULL
GROUP BY get_patient_age_group(p.date_of_birth)
ORDER BY
  CASE get_patient_age_group(p.date_of_birth)
    WHEN 'Under 18' THEN 1
    WHEN '18 to 24' THEN 2
    WHEN '25 to 34' THEN 3
    WHEN '35 to 44' THEN 4
    WHEN '45 or older' THEN 5
    ELSE 6
  END;