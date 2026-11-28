ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sex text
  CONSTRAINT profiles_sex_check CHECK (sex IN ('female','male','prefer_not_to_say'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
  v_consent boolean;
BEGIN
  IF NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL
     AND NEW.raw_user_meta_data->>'date_of_birth' <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::date;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
    END;
  END IF;
  v_consent := COALESCE((NEW.raw_user_meta_data->>'privacy_consent')::boolean, true);

  INSERT INTO public.profiles (id, auth_user_id, role, full_name, phone, date_of_birth, sex, address, created_at)
  VALUES (
    NEW.id,
    NEW.id,
    'patient',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    v_dob,
    NEW.raw_user_meta_data->>'sex',
    NEW.raw_user_meta_data->>'address',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    full_name = EXCLUDED.full_name,
    sex = COALESCE(EXCLUDED.sex, profiles.sex),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

  INSERT INTO public.patients (
    profile_id, emergency_contact_name, emergency_contact_phone, blood_type,
    allergies, obstetric_history, privacy_consent, privacy_consent_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'emergency_contact_name',
    NEW.raw_user_meta_data->>'emergency_contact_phone',
    NEW.raw_user_meta_data->>'blood_type',
    NEW.raw_user_meta_data->>'allergies',
    NEW.raw_user_meta_data->>'obstetric_history',
    v_consent,
    CASE WHEN v_consent THEN now() ELSE NULL END
  ) ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_patient_sex(p_profile_id uuid, p_sex text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET sex = p_sex WHERE id = p_profile_id AND role = 'patient';
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_patient_sex(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_patient_sex(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.patient_sex_breakdown()
RETURNS TABLE(label text, count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH buckets(value,label,position) AS (VALUES
    ('female','Female',1), ('male','Male',2),
    ('prefer_not_to_say','Prefer not to say',3), (NULL,'Not recorded',4)
  ), totals AS (
    SELECT p.sex, count(*) AS n FROM public.profiles p
    JOIN public.patients pt ON pt.profile_id = p.id
    WHERE p.role = 'patient' GROUP BY p.sex
  )
  SELECT b.label, coalesce(t.n,0) FROM buckets b LEFT JOIN totals t
    ON t.sex IS NOT DISTINCT FROM b.value ORDER BY b.position;
$$;
REVOKE ALL ON FUNCTION public.patient_sex_breakdown() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_sex_breakdown() TO authenticated;
