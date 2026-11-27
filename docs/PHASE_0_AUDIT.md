# Phase 0 thesis audit

Reviewed the working tree on polish-pass at fef458b, including the existing dashboard layout edit. Sources included CLAUDE.md, PROGRESS.md, TRACEABILITY.md, the branch history, both apps, shared code, migrations 00001 through 00035 and the Supabase suites. The earlier traceability matrix describes an older branch. “Implemented” below means the screen and its data path exist. Patient and staff sessions, deployed schema state and device delivery were not verified.

| Objective | Finding | Source |
|---|---|---|
| Patient registration and profile | Implemented. Registration submits patient details through the auth provider. The profile screen loads and saves personal and health details. | mobile/app/(auth)/register.tsx, mobile/app/(tabs)/profile.tsx |
| Patient booking | Implemented. The patient chooses a service and available slot. The booking function checks availability and creates a pending appointment. The schema guards against overlapping doctor appointments. | mobile/app/(tabs)/book.tsx, migrations 00003, 00024 and 00033 |
| Reminders | Partial. The backend generates 24-hour and 2-hour notices and prevents duplicate database rows. The push sender scans the latest 30 minutes without marking delivery, so overlapping runs can resend a notice. Scheduler operation and receipt on a patient device remain unverified. | migration 00020, supabase/functions/send-reminders |
| Visit history and records | Implemented. Patients can review their appointments and statuses and open medical records. | mobile/app/(tabs)/appointments.tsx and records.tsx |
| Clinic location | Implemented as requested by the owner in the project history. Find Clinic displays the address and contacts. The progress log still flags the contact email for confirmation. | mobile/app/(tabs)/clinic-finder.tsx, commit 395a42a |
| Admin patients and records | Implemented. Staff can search and edit patient details and create and update clinical records. Walk-in intake has a separate defect below. | web/src/app/dashboard/patients and records |
| Admin appointments and doctor schedules | Implemented. The list and calendar support review. Appointment actions include approval, decline, rescheduling, cancellation and completion. The schedules page manages recurring availability and exceptions. | web/src/app/dashboard/appointments and schedules, migrations 00026–00029 |
| Admin inventory and payment records | Implemented. Staff with the required permissions can create inventory items and record movements. Staff can record, correct and void payments for completed visits. The project defines payments as record keeping. | web/src/app/dashboard/inventory and transactions, migrations 00025 and 00031 |
| Demographics | Partial. The age chart counts every profile with a birth date. Its source view does not restrict the count to patients. Patients without a birth date are omitted. | migration 00034, web/src/app/dashboard/analytics/page.tsx |
| Appointment trends | Implemented. Analytics groups appointments over time and displays status, service and busy-period breakdowns. The 7-day filter includes seven days on either side of today. The 30-day and 90-day filters likewise include both future and past appointments. | web/src/app/dashboard/analytics/page.tsx |
| Inventory consumption | Partial. The report and CSV aggregate stock-out quantities by item, but only from the newest 100 movements across all items and movement types. Even a recent date range can undercount. Timestamp strings are also compared directly with Manila-offset bounds, which can misclassify movements near midnight. | web/src/app/dashboard/inventory/page.tsx, lines 98 and 204 onward |
| Payment analytics | Partial. Reports export payment totals. The analytics screen loads revenue by service, monthly totals and void rates into state. Its rendered charts never read that state. | web/src/app/dashboard/analytics/page.tsx, reports/page.tsx, migration 00035 |
| Walk-in handling | Partial. The staff interface supports patient registration and offers a visit form. The form omits the selected patient ID. The booking function derives the patient from the caller and rejects a staff account without a patient row. Staff cannot reliably record a visit for the selected patient. | web/src/app/dashboard/patients/page.tsx lines 193–212, migration 00033 |
| Patient walk-in reporting | Broken paths. The doctor lookup uses a fixed profile ID and falls back to a column absent from the doctors table. After a successful submission, the app reads an id property from a UUID string, so its push request lacks the appointment ID. The database function also accepts a patient ID without checking ownership. An authorization change requires owner approval. | mobile/app/(tabs)/appointments.tsx lines 203–275, migrations 00003 and 00032 |

The missing pieces against the stated objectives are reliable staff attribution of walk-in visits, patient-only demographic counts, complete period totals for consumption and visible payment breakdowns. Live reminder delivery and the end-to-end patient and staff workflows still need verification. No migration was created or applied.

The earlier traceability matrix also lists a breakdown by sex. The migrations have no field for it. The stated objective does not specify which demographic dimensions the clinic requires.

## Local verification

| Check | Before | After |
|---|---|---|
| Mobile TypeScript | Passed | Passed |
| Web TypeScript | First run overlapped the build and lost a generated Next.js type file. The build's type check passed. | Passed, including a standalone run before starting the second build |
| Shared TypeScript | Failed with five errors in shared/datetime.ts at lines 22 and 27. Date parts may be undefined. | Same five errors |
| Mobile lint | ESLint 9 exited before linting because it could not find its configuration. | Same |
| Web lint | Next.js prompted for initial ESLint setup and exited before linting. | Same |
| Web production build | Passed, 20 pages generated | Passed, 20 pages generated |
| Existing Supabase suites | All ten rejected the loopback URL at startup. Each requires the remote dev project. Zero workflow assertions ran. | Same |

The builds used the existing working tree, including the prior dashboard edit. No remote database was contacted.
