-- =============================================================================
-- Migration 00008: Audit Logging Triggers and Access Function
-- Complies with the Philippine Data Privacy Act of 2012 by logging:
-- 1. Automatic changes (INSERT, UPDATE, DELETE) on medical_records.
-- 2. Explicit access/views via log_medical_record_access RPC function.
-- =============================================================================

-- 1. Trigger function for auditing modifications to medical records
CREATE OR REPLACE FUNCTION audit_medical_records_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'INSERT',
      'medical_records',
      NEW.id,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'UPDATE',
      'medical_records',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'DELETE',
      'medical_records',
      OLD.id,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to medical_records table
DROP TRIGGER IF EXISTS trg_audit_medical_records ON medical_records;
CREATE TRIGGER trg_audit_medical_records
  AFTER INSERT OR UPDATE OR DELETE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION audit_medical_records_change();

-- 2. RPC function for logging READ / VIEW access on sensitive medical records
CREATE OR REPLACE FUNCTION log_medical_record_access(
  p_record_id uuid,
  p_action    text DEFAULT 'VIEW'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    p_action,
    'medical_records',
    p_record_id,
    NULL,
    jsonb_build_object(
      'accessed_at', now(),
      'access_role', (SELECT role FROM profiles WHERE id = auth.uid())
    )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_medical_record_access(uuid, text) TO authenticated;

