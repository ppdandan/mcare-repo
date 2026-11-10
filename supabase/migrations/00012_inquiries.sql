-- =============================================================================
-- Migration 00012: Patient Clinic Inquiries (Messaging Reception)
-- Optional feature for direct patient-to-clinic communication.
-- =============================================================================

CREATE TABLE IF NOT EXISTS inquiries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  subject     text        NOT NULL,
  message     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  reply       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_inquiries_patient_id ON inquiries(patient_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status     ON inquiries(status);

-- Enable RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "inquiries_select_policy"
  ON inquiries FOR SELECT
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR is_staff()
  );

CREATE POLICY "inquiries_insert_policy"
  ON inquiries FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = current_patient_id()
    OR is_staff()
  );

CREATE POLICY "inquiries_update_policy"
  ON inquiries FOR UPDATE
  TO authenticated
  USING (
    patient_id = current_patient_id()
    OR is_staff()
  )
  WITH CHECK (
    patient_id = current_patient_id()
    OR is_staff()
  );

-- Trigger for updated_at
CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Add to Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inquiries;
  END IF;
END $$;

