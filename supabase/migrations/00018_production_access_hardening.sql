-- Restrict patient appointment changes to an explicit cancellation operation.
-- Staff retain their existing update workflow; RLS remains enabled.
DROP POLICY IF EXISTS "appointments_update_policy" ON appointments;

CREATE POLICY "appointments_update_policy"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    doctor_id = current_doctor_id()
    OR is_receptionist()
    OR is_admin()
  )
  WITH CHECK (
    doctor_id = current_doctor_id()
    OR is_receptionist()
    OR is_admin()
  );

CREATE OR REPLACE FUNCTION protect_doctor_appointment_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user_role() = 'doctor' AND (
    NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.start_time IS DISTINCT FROM OLD.start_time
    OR NEW.end_time IS DISTINCT FROM OLD.end_time
    OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'completed')
  ) THEN
    RAISE EXCEPTION 'Doctors may update notes or mark an appointment completed only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_doctor_appointment_fields ON appointments;
CREATE TRIGGER trg_protect_doctor_appointment_fields
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION protect_doctor_appointment_fields();

CREATE OR REPLACE FUNCTION cancel_my_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE appointments
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_appointment_id
     AND patient_id = current_patient_id()
     AND status IN ('pending', 'approved', 'rescheduled');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment was not found or can no longer be cancelled'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION cancel_my_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_my_appointment(uuid) TO authenticated;

-- Public signups must never be able to self-assign privileged roles via user
-- metadata. Staff roles are provisioned separately by a trusted administrator.
CREATE OR REPLACE FUNCTION handle_new_user()
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

  INSERT INTO public.profiles (id, role, full_name, phone, date_of_birth, address, created_at)
  VALUES (
    NEW.id,
    'patient',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    v_dob,
    NEW.raw_user_meta_data->>'address',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
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

-- Audit inserts must be attributable only to the authenticated caller.
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
CREATE POLICY "audit_logs_insert_policy"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
