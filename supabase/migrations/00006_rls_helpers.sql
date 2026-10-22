-- =============================================================================
-- Migration 00006: RLS Helper Functions
-- Security definer functions executed in postgres context to safely inspect
-- the authenticated user's role and associated clinic records without recursion.
-- =============================================================================

-- 1. Get current authenticated user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 2. Role check convenience helpers
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'doctor' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_nurse()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'nurse' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_receptionist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'receptionist' FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_patient()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'patient' FROM profiles WHERE id = auth.uid()), false);
$$;

-- 3. Any staff member (doctor, nurse, receptionist, admin)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role IN ('doctor', 'nurse', 'receptionist', 'admin') FROM profiles WHERE id = auth.uid()), false);
$$;

-- 4. Clinical staff member (doctor, nurse, admin - can access clinical data)
CREATE OR REPLACE FUNCTION is_clinical_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role IN ('doctor', 'nurse', 'admin') FROM profiles WHERE id = auth.uid()), false);
$$;

-- 5. Current patient ID (lookup patient table via profile_id = auth.uid())
CREATE OR REPLACE FUNCTION current_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM patients WHERE profile_id = auth.uid() LIMIT 1;
$$;

-- 6. Current doctor ID (lookup doctor table via profile_id = auth.uid())
CREATE OR REPLACE FUNCTION current_doctor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM doctors WHERE profile_id = auth.uid() LIMIT 1;
$$;

