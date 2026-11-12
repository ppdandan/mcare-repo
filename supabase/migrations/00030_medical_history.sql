-- General medical history, separate from the visit-specific HPI.
-- Existing medical_records RLS policies continue to govern this column and
-- patients can only read rows linked to their own patient profile.
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS medical_history text;
