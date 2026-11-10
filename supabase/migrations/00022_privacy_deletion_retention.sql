-- Preserve profile and clinical rows after deleting an auth login.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

UPDATE public.profiles AS p
SET auth_user_id = p.id
WHERE p.auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p.id);

DO $$
DECLARE fk record;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND confrelid = 'auth.users'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_user_id_uidx
  ON public.profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

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

  INSERT INTO public.profiles (id, auth_user_id, role, full_name, phone, date_of_birth, address, created_at)
  VALUES (
    NEW.id,
    NEW.id,
    'patient',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    v_dob,
    NEW.raw_user_meta_data->>'address',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    full_name = EXCLUDED.full_name,
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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a patient profile for new auth users. The nullable auth_user_id link allows later account deletion without cascading clinical records.';

-- Document-only helper for a future retention purge. Deliberately not scheduled.
CREATE OR REPLACE FUNCTION public.purge_deleted_patient_records(p_before timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.patients
  WHERE deleted_at IS NOT NULL AND deleted_at < p_before;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_deleted_patient_records(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_deleted_patient_records(timestamptz) TO authenticated;
