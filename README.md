# M-Care Clinic System

**M-Care OB-GYN and Ultrasound Clinic** — Balibago, Angeles City

## Mobile App (Patient-Facing)
- **Framework**: React Native + Expo SDK 54
- **Package**: `com.dandan03.mcare` (Android)
- **Routing**: Expo Router with nested `(tabs)` route groups
- **Screens**:
  - **Auth**: Welcome, Login, Welcome screen
  - **Home**: Greeting, upcoming appointment, action shortcuts (Book Appointment, My Clinic Visits, Message Clinic Staff)
  - **Booking**: 5-step wizard — service → date → time → review → confirm; rejects weekends and double-bookings via DB GiST constraint
  - **Appointments**: Upcoming/history tabs, realtime status updates, cancel with confirmation
  - **Records**: Read-only medical records; every view triggers DPA 2012 audit log RPC; verified chart badge; RLS-scoped to signed-in patient
  - **Profile**: Personal details, emergency contact, blood type chips, allergies, obstetric history; save and sign-out
  - **Notifications**: Live alerts for appointment confirmations, reschedules, visit reminders; mark all as read
  - **Transactions**: Read-only payment history records; view voided/active transactions; records only, no payments collected
  - **Inquiry**: Messaging channel to clinic staff

- **Timezone**: Asia/Manila; bookings weekdays only; database enforces this
- **Doctor**: Dr. Bernice Paule, OB-GYNE / Sonologist (sole practitioner)
- **Push notifications**: Via Expo push token registration
- **Design tokens**: Shared `shared/theme.ts` — color, typography, spacing, radius

## Web Admin & Staff Dashboard
- **Framework**: Next.js 15 with daisyUI
- **Hosting**: Cloudflare Workers via OpenNext
- **Auth**: Supabase Auth (session protected; do not modify `web/src/lib/supabase`, middleware, env vars, wrangler.jsonc, open-next.config.ts)
- **Screens**:
  - **Dashboard layout**: Fixed, retractable sidebar (collapsed `w-16` / expanded `w-72`); content auto-adjusts
  - **Patients**: Search, paginated table, walk-in patient registration (temp password via `supabase.auth.signUp`)
  - **Appointments**: Approval workflow with role checks; calendar views (day/week/month); 23P01 overlap handling; realtime sync
  - **Medical records**: Role-separated editing (nurse: vitals; doctor: diagnosis/Rx); audit-logged views; RLS-protected
  - **Inventory**: (Gap — not yet implemented; requires migration `inventory_items` table)
  - **Schedules**: Doctor schedule management
  - **Analytics**: Registration trends, appointment trends, status distribution, top services; 7d/30d/90d/all filters
  - **Reports**: Transaction summary CSV export (count, not-voided amount, voided count per date range)
  - **Inventory**: (Gap — not yet implemented)

- **RLS**: Enabled on every table; policies enforce role-based access (staff vs patient vs public)
- **Edge Functions**: `get_available_slots`, `book_appointment`, `delete-account`, `log_medical_record_access`
- **Timezone**: Asia/Manila for all appointment boundaries

## Shared Types
- **Package**: `@m-care/shared` — color tokens, typography scale, spacing scale, radius values, format utilities (`formatManilaDate`, `formatManilaDateTime`, `formatAmount`)
- **Types**: `AppointmentWithDetails`, `MedicalRecordWithDetails`, `TransactionWithAppointment`, `Notification`, `PatientProfile`, `DoctorProfile`, `Service`

## Database (Supabase)
- **Migrations**: 00001 through 00031 applied on dev ref `luccnwicirfnmyzgemzj` (Singapore)
- **Key tables**: `profiles`, `patients`, `doctors`, `services`, `appointments`, `medical_records`, `transactions`, `inventory_items` (gap)
- **RLS policies**: `00007_rls_policies.sql` — patient-scoped selects, staff inserts/updates, void restrictions
- **Audit trigger**: `00008_audit_trigger.sql` — logs every medical record view via `log_medical_record_access` RPC (RA 10173 / DPA 2012 compliance)
- **Constraints**: GiST `no_doctor_double_booking` on appointments; CHECK on transaction void metadata; weekend rejection in `book_appointment` RPC
- **No payments collected**: Transactions are record-only; amounts stored as PHP (Philippine Peso)

## Traceability Gaps (from thesis audit)
| Gap | Priority | Leanest build |
|---|---|---|
| Inventory feature | Large | New migration `inventory_items` + consumption RPC + web + analytics BarChart |
| Walk-in visit creation | Small | "New walk-in visit" modal on appointments page through staff RPC |
| Clinic info + location + contact | Small | Mobile screen: address, phone, email, hours, "Open in Maps" |
| Demographics analytics | Medium | Add `sex` column to patients DB + age/sex charts in Analytics |
| Payment analytics charts | Small | Revenue-per-day AreaChart + payment-method PieChart in Analytics |

