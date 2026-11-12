# Admin dashboard migration progress

The prior progress file did not exist when this work began. This work is on `web-admin` and uses only the dev Supabase project `luccnwicirfnmyzgemzj`. The separate changes already present in `skills-lock.json` and `.agents/skills/daisyui/` were not made for this task.

## Step 1 — Audit (complete)

### Website routes and current audience

| Route | Current audience and purpose |
|---|---|
| `/` | Public landing page; currently patient-facing clinic/site information. |
| `/login` | Shared patient and staff sign-in. Patients are sent to `/book`; staff are sent to `/dashboard`. |
| `/book` | Patient booking form. |
| `/appointments` | Patient appointment list and cancellation. |
| `/transactions` | Patient transaction history. |
| `/profile` | Patient profile management. |
| `/privacy` | Public privacy policy. |
| `/delete-account` | Public deletion instructions/request page. |
| `/dashboard` | Staff overview. |
| `/dashboard/appointments` | Staff appointment list and week/month/day calendar. |
| `/dashboard/transactions` | Doctor/admin transaction management. |
| `/dashboard/schedules` | Staff schedule view and schedule exception management. |
| `/dashboard/patients` | Staff patient search, details, registration, and profile editing. |
| `/dashboard/records` | Doctor, nurse, and admin medical-record management. Receptionists are shown a restricted notice. |
| `/dashboard/inquiries` | Staff clinic inquiry management. |
| `/dashboard/analytics` | Admin-only clinic analytics/charts. |
| `/dashboard/reports` | Staff CSV and print/PDF reports. |
| `/dashboard/staff` | Admin staff account management. |

`web/src/app/layout.tsx`, `globals.css`, and `icon.png` are shared app assets/layout, not additional page routes.

### Scope comparison

- **Admin dashboard, staff authentication, patients, appointments, records, schedules, analytics, reports, transactions, and staff provisioning exist.** They are functional but do not yet form a staff-only website because the patient routes and patient sign-in are still present.
- **Appointment queue/workspace is partial.** The page has realtime refresh, list filters, calendar display, and status/reschedule controls. It lacks the requested pending queue count, patient search/date-range filters, confirmation/reason flows, available-slot calendar selection, and server-side status RPC calls. Current status actions update the table directly.
- **Patient management is partial.** Search, profile details, registration, and editing are present. The patient dashboard detail does not include that patient's appointment history.
- **Records are partial but usable.** The table has `history_of_present_illness`, `diagnosis`, and `prescription`, and the page can create/update these fields. There is no separate general medical-history field in the record schema. Patients can select only their own records under the existing RLS policy; clinical staff have access according to existing policies.
- **Schedules are partial.** Weekly schedules are read/displayed, and schedule exceptions (days/time off) can be added/removed. There is no weekly-hours editor. The slot function reads `doctor_schedules` and `schedule_exceptions` when generating slots.
- **Analytics are partial.** The admin page uses Recharts and has appointment trend/status/service/case and time/day charts plus a total patient count. It does not show patient counts per day and month as requested.
- **Reports are partial.** Date-filtered appointments, patient registry, and clinical records can be downloaded as CSV; a print-friendly view can be printed/saved as PDF. There is no transaction summary/report in the current report page.
- **Doctor transactions and admin staff creation already exist.** The transaction RPC is `record_appointment_transaction`; staff provisioning calls the `create-staff` Edge Function.

### Verified audit facts

1. **New booking status:** `pending`. Migration `00003_tables.sql` sets the default to pending, and the current `book_appointment` definition in `00024_reject_weekend_appointments.sql` explicitly inserts pending.
2. **Appointment status permissions:** there are no server-side approval/reschedule/decline/complete RPCs. The `appointments_update_policy` in `00018_production_access_hardening.sql` permits the assigned doctor, receptionist, or admin to update rows. A trigger restricts doctors to completion or notes, while receptionist/admin updates are broadly permitted by that policy. The patient update policy was removed; `cancel_my_appointment(uuid)` is an authenticated, patient-own-row cancellation RPC. Nurse cannot update appointments. Current web appointment controls use direct `.update()` calls. This is a broad table-level path, not the requested transition-specific workflow.
3. **Notifications:** migration `00011_notifications_trigger.sql` inserts an in-app notification row for every appointment status update. `send-reminders` can send recent notification rows to registered Expo push tokens. Repo code alone does not prove that function is scheduled or that a patient device has a token; status changes therefore do not have proven push delivery. Booking insertion itself does not fire the status-update trigger.
4. **Records:** medical records include history of present illness, diagnosis, and prescription fields; create/update UI exists. A distinct general medical-history record field is absent. Existing RLS permits patients to read only their own records and clinical staff according to role helpers.
5. **Calendar/reports:** an appointment week/month/day calendar view exists. Reports produce CSV files for appointments, patients, and clinical records, and a print-friendly view that can be saved as PDF. No transaction summary is included.
6. **Roles and middleware:** roles are `patient`, `doctor`, `nurse`, `receptionist`, and `admin` (`00002_enums.sql`). Middleware refreshes the Supabase session and reads `profiles.role`. Unauthenticated dashboard/patient-area requests go to `/login`; a patient requesting `/dashboard` is redirected to `/book`; nonpatients requesting patient routes go to `/dashboard`; signed-in patients on `/login` go to `/book`, and staff roles go to `/dashboard`. The dashboard layout also signs out a patient profile. Existing middleware is protected and will not be changed.

### Existing database role mapping relevant to appointments

| Role | Existing appointment capability |
|---|---|
| Admin | Read all and update all appointment rows under RLS. |
| Receptionist | Read all and update all appointment rows under RLS. |
| Doctor | Read assigned appointments and update assigned appointments; trigger limits status changes to `completed` (the trigger does not enforce that the previous status was approved). |
| Nurse | Read all appointments; no appointment update permission. |
| Patient | Read own appointments and book through `book_appointment`; cancel own eligible booking through `cancel_my_appointment`; cannot directly update after migration 00018. |

This is the baseline audit; implementation must not change existing RLS, booking function, protected Supabase connection/middleware, migrations 00001–00025, or mobile files except where Step 3 expressly allows status labels/notification text.

## Later steps

- Step 2: complete.
- Step 3: not started.
- Step 4: not started.
- Step 5: not started.
- Step 6: not started.

## Step 2 — Remove patient website side (complete)

- Replaced `/` with a clinic landing page showing the logo, clinic name/location, staff sign-in, a short patient mobile-app note with the visible `[to be added]` store-link placeholder, and public privacy/deletion links.
- Removed the patient booking, appointments, transactions, and profile page implementations. Next.js redirects those four old paths to the public `/patient-app` notice. The redirects are configured in `web/next.config.ts`, which executes before middleware, so unauthenticated visitors also reach the notice without changing the protected Supabase session/middleware files.
- Changed the website login label to staff sign-in. A patient who signs in is signed out and shown a message to use the M-Care mobile app. The existing server-side middleware role check for `/dashboard` and the dashboard layout check remain in place.
- Removed `PatientHeader.tsx` after searching and confirming its only imports were from the four removed patient route pages. Privacy and deletion pages remain unchanged and public.
- `npm --workspace=web run build` passed; it listed `/patient-app` and only staff dashboard, public policy, and login pages. `npm --workspace=web exec -- tsc --noEmit` passed. `git diff --check` passed.
