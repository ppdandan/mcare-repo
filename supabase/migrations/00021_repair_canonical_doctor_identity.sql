-- Migration 00015 can create the canonical doctor auth row directly when no
-- auth user exists. Add the email identity Supabase Auth expects so its Admin
-- API can manage that account. This is safe to run more than once.
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now()
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = 'bernice.paule@mcare.clinic'
  AND p.full_name = 'Dr. Bernice Paule'
  AND p.role = 'doctor'
  AND NOT EXISTS (
    SELECT 1
    FROM auth.identities AS i
    WHERE i.provider = 'email'
      AND i.provider_id = u.id::text
  );
