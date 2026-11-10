# Play Console privacy worksheet draft

Clinic review is required before completing Play Console forms. Replace all placeholders and verify each provider's processing terms and locations.

## Data types observed in the current code

| Data | Where it comes from / where it goes | Purpose | Transit |
| --- | --- | --- | --- |
| Name, email, password/authentication state | Signup/login → Supabase Auth; name also goes to `profiles` | Account, identity, sign-in | HTTPS/TLS to Supabase |
| Phone, date of birth, address | Registration/profile → `profiles` | Contact and patient identity | HTTPS/TLS to Supabase |
| Emergency contact name and phone | Registration/profile → `patients` | Patient safety/contact | HTTPS/TLS to Supabase |
| Blood type, allergies, obstetric/gynecologic history | Registration/profile → `patients` | Patient record and continuity of care | HTTPS/TLS to Supabase |
| Appointment service, doctor, date/time, status, notes | Booking → `appointments` | Scheduling and clinic operations | HTTPS/TLS to Supabase |
| Clinical record fields (complaint, history, vitals, diagnosis, prescription, notes) | Clinic staff entry → `medical_records` | Clinical care and recordkeeping | HTTPS/TLS to Supabase |
| Inquiry text and clinic reply/status | Inquiry form → `inquiries` | Patient communication | HTTPS/TLS to Supabase |
| Notification content/read state | Booking and reminder processes → `notifications` | Booking updates and reminders | HTTPS/TLS to Supabase |
| Expo push token and device notification settings | Device notification registration → `push_tokens`; Expo push service receives token and message | Deliver reminders | HTTPS/TLS to Supabase and Expo push service |
| Audit action, table, record ID, timestamps and limited before/after values | Database triggers and approved access RPC → `audit_logs` | Security, accountability, troubleshooting | HTTPS/TLS to Supabase |
| Network/device data handled by providers | Supabase Auth/API/database, email delivery, Expo push | Operate account, email verification and notification services | HTTPS/TLS where supported by the provider |

The current schema does not define a payment card or payment processing feature. Do not declare payment data unless another deployed service collects it. Patient-entered appointment and inquiry text and staff-entered clinical notes may contain personal details. The clinic must verify actual production telemetry and provider-side logs before submission. TLS protects app-to-service transit; this code review does not establish encryption-at-rest settings for each provider.

## Access and sharing

Patients access their own profile, bookings, records, and notifications. Authorized clinic staff access the data needed for assigned scheduling, administrative, or clinical duties. Supabase hosts auth and database services; the configured email service sends verification messages; Expo's push service delivers device notifications. Confirm provider locations, retention, and processor agreements before publishing.

## Deletion draft

The in-app account deletion path asks for recent authentication or password confirmation, removes the auth login, clears direct profile and emergency contact fields, removes notification tokens, notifications and inquiries, clears appointment notes, and cancels future appointments. Structured clinical records and audit history remain; free-text clinical and historical audit fields may still contain identifiers and require clinic review. Retention for `RETENTION_PERIOD` requires clinic approval. The public `/delete-account` page explains how to request deletion by email. The clinic must verify that implementation and backups follow the final retention plan.

## Store listing health disclaimer draft

“M-Care is for clinic appointment scheduling and access to patient records. It does not provide medical diagnosis, treatment recommendations, or emergency care. For medical advice, contact your healthcare provider; for emergencies, contact local emergency services.”

## Clinic values to fill

- `CLINIC_NAME`
- `CLINIC_ADDRESS`
- `CLINIC_CONTACT_EMAIL`
- `RETENTION_PERIOD`
- Effective date and privacy request verification instructions
- Supabase, email, and push provider legal names, locations, and retention terms
