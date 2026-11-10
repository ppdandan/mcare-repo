# Account deletion and retention proposal

**Clinic approval required before production.** This proposal changes the default deletion flow but does not choose the clinic's retention period.

## Foreign key impact found in migrations

| Child column | References | Delete rule | Consequence before migration 00022 |
| --- | --- | --- | --- |
| `profiles.id` | `auth.users.id` | `CASCADE` | Deleting a login deletes its profile. |
| `patients.profile_id` | `profiles.id` | `CASCADE` | Deleting a patient profile deletes the patient row, appointments, medical records, and inquiries that reference it. |
| `doctors.profile_id` | `profiles.id` | `CASCADE` | Deleting a doctor profile removes its doctor row, schedules, exceptions, and appointments; medical records referencing the doctor can prevent the deletion. |
| `notifications.user_id` | `auth.users.id` | `CASCADE` | Account deletion removes notification rows. |
| `push_tokens.user_id` | `auth.users.id` | `CASCADE` | Account deletion removes push tokens. |
| `audit_logs.user_id` | `auth.users.id` | `SET NULL` | Audit history is retained and attribution is cleared. |

The dev catalog also showed Supabase-managed auth references: `auth.identities`, `auth.sessions`, `auth.mfa_factors`, `auth.one_time_tokens`, `auth.oauth_authorizations`, `auth.oauth_consents`, `auth.webauthn_credentials`, `auth.webauthn_challenges`, and `auth.mfa_recovery_code_sets` cascade with the login; `auth.scim_users.user_id` uses `SET NULL`. These are authentication state, not clinic clinical records. After migration 00022, `profiles.auth_user_id → auth.users.id` uses `SET NULL`.

The clinical cascade paths are `profiles → patients → appointments/medical_records/inquiries` and `profiles → doctors → schedules/exceptions/appointments`. The appointment foreign key on medical records has no delete cascade and may block appointment deletion when a clinical record references it.

Migration `00022_privacy_deletion_retention.sql` removes the auth foreign key from the immutable profile ID and adds a nullable `profiles.auth_user_id` foreign key with `ON DELETE SET NULL`. It adds `patients.deleted_at`. Existing app authorization continues to use the profile ID for active users; deleting the login nulls the auth link while preserving the profile and clinical references.

## Proposed deletion behavior

1. Require the patient to be authenticated and either signed in within the last 10 minutes or confirm the password.
2. Cancel future appointments, clear appointment free-text notes, and delete inquiries, notifications, and push tokens.
3. Clear the profile name, phone, address, date of birth, and emergency contact details. Set `patients.deleted_at`.
4. Delete the auth login. The profile and patient identifiers remain so appointments, clinical records, and audit history do not cascade away. Audit attribution becomes null under its existing foreign key.
5. Retain de-identified clinical data for **`RETENTION_PERIOD`**, after clinic and legal review. The app currently keeps allergies, obstetric history, blood type, and record content; the clinic must decide whether each field is necessary for continuity of care and the approved retention purpose.
6. The migration documents `public.purge_deleted_patient_records(p_before)` as an admin-only later purge helper. It is not scheduled. A clinic-approved retention schedule and operational review are required before anyone calls it.

Migration 00022 and the Edge Function are a technical proposal, not a substitute for clinic approval. The schema has free-text clinical fields that may contain names or contact details; this code does not inspect or redact arbitrary identifiers in clinical notes or historical audit payloads. The clinic must review that limitation and approve the retention period, retained fields, request verification procedure, and whether this handling satisfies its recordkeeping obligations before production.
