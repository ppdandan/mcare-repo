-- 00032: Walk-in visit reporting from mobile app
-- Allows patients to self-report walk-in visits; saved as pending for staff verification.
-- The SECURITY DEFINER function bypasses RLS (is_staff() check) so unauthenticated
-- walk-in reporting works; staff later review and approve via existing workflow.

-- Add is_walk_in column to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_walk_in boolean NOT NULL DEFAULT false;

-- Create the report_walk_in_visit SECURITY DEFINER function
-- Patients call this from mobile; it inserts a pending appointment for staff review.
DROP FUNCTION IF EXISTS public.report_walk_in_visit(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text
);
CREATE OR REPLACE FUNCTION public.report_walk_in_visit(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
BEGIN
  -- Insert as pending walk-in appointment; status stays pending for staff review
  INSERT INTO public.appointments (
    patient_id,
    doctor_id,
    service_id,
    start_time,
    end_time,
    status,
    notes,
    is_walk_in
  ) VALUES (
    p_patient_id,
    p_doctor_id,
    p_service_id,
    p_start_time,
    p_end_time,
    'pending',
    p_notes,
    true
  )
  RETURNING id INTO v_appointment_id;

  -- Record audit log entry
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    'WALK_IN_REPORT',
    'appointments',
    v_appointment_id,
    NULL,
    jsonb_build_object(
      'patient_id', p_patient_id,
      'doctor_id', p_doctor_id,
      'service_id', p_service_id,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'notes', p_notes
    )
  );

  RETURN v_appointment_id;
END;
$$;

-- Grant execute to authenticated users (patients can call it)
REVOKE ALL ON FUNCTION public.report_walk_in_visit(uuid, uuid, uuid, timestamptz, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_walk_in_visit(uuid, uuid, uuid, timestamptz, timestamptz, text)
  TO authenticated;

-- Update the appointments_insert_policy: we keep the staff-only insert for direct inserts,
-- but walk-in reports go through the SECURITY DEFINER function above, so the policy
-- still blocks patient direct inserts (which is the desired security posture).
COMMENT ON COLUMN public.appointments.is_walk_in IS 'True if this appointment was self-reported as a walk-in visit by the patient; staff review and approve/reschedule as needed.';