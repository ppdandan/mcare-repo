CREATE OR REPLACE VIEW public.patients_by_age_group WITH (security_invoker = true) AS
SELECT coalesce(public.get_patient_age_group(p.date_of_birth), 'Unknown') AS age_group,
       count(*) AS patient_count
FROM public.patients patient
JOIN public.profiles p ON p.id = patient.profile_id
WHERE p.role = 'patient'
GROUP BY 1;
