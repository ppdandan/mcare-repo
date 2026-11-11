-- Publish the services provided for the patient booking flow.
-- Use 30-minute appointments as a working default; existing rows are preserved.
INSERT INTO public.services (name, description, duration_minutes, is_active)
VALUES
  ('Pregnancy & Maternity Guidance', NULL, 30, true),
  ('Menopause Care', NULL, 30, true),
  ('OB-GYN Consultations', NULL, 30, true),
  ('Menstrual & Hormonal Health Management', NULL, 30, true),
  ('Reproductive Infections & STIs', NULL, 30, true)
ON CONFLICT (name) DO NOTHING;
