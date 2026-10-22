-- =============================================================================
-- Migration 00009: Auth Triggers for Automatic Profile & Patient Creation
-- Automatically initializes profiles and patients records upon auth.users signup.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_full_name text;
  v_phone text;
  v_dob date;
  v_address text;
  v_consent boolean;
BEGIN
  -- Extract metadata safely from raw_user_meta_data
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::user_role;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_address := NEW.raw_user_meta_data->>'address';
  v_consent := COALESCE((NEW.raw_user_meta_data->>'privacy_consent')::boolean, true);

  IF NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::date;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
    END;
  ELSE
    v_dob := NULL;
  END IF;

  -- 1. Create or update Profile
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    date_of_birth,
    address,
    created_at
  ) VALUES (
    NEW.id,
    v_role,
    v_full_name,
    v_phone,
    v_dob,
    v_address,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- 2. If Patient, create Patient record with DPA 2012 Consent timestamp
  IF v_role = 'patient' THEN
    INSERT INTO public.patients (
      profile_id,
      emergency_contact_name,
      emergency_contact_phone,
      blood_type,
      allergies,
      obstetric_history,
      privacy_consent,
      privacy_consent_at
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'emergency_contact_name',
      NEW.raw_user_meta_data->>'emergency_contact_phone',
      NEW.raw_user_meta_data->>'blood_type',
      NEW.raw_user_meta_data->>'allergies',
      NEW.raw_user_meta_data->>'obstetric_history',
      v_consent,
      CASE WHEN v_consent THEN now() ELSE NULL END
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

