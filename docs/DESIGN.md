# M-Care Design System

One design language for both apps, built from `shared/theme.ts` (the single source of truth). The website maps these tokens to the daisyUI `mcareTheme` in `web/tailwind.config.ts`; the mobile app maps them to friendly names in `mobile/theme.ts` and applies them with `StyleSheet` and the shared UI kit in `mobile/components/ui/`.

## Direction

**Clean and medical, with lots of white space.** One warm rose accent carries the brand from the logo; everything else is quiet — white surfaces, soft warm-gray canvas, near-black text. Status color appears only where it means something (a badge, a KPI number, an alert). Both apps are light-only; there is no dark theme.

**The website is desktop clinic software.** A fixed sidebar with grouped, role-filtered navigation. Dense, small-type tables for records. Stat cards for the overview. Screens are built for speed of reading: tight rows, clear column headers, actions at the row level, a calendar strip for the appointment queue. It is a tool staff use all day, so it stays calm, high-contrast, and predictable.

**The mobile app is friendly and calm.** Card-based screens on white, generous spacing, a bottom tab bar with **five** labeled tabs, and 44-point minimum tap targets everywhere. It should feel like a reassuring clinic front desk: a greeting on Home, a guided four-step booking wizard, soft status badges, plain-language empty states. Never clinical-cold, never playful-loud. Notifications appear behind a bell icon in the top-right header.

## Color palette

Sampled from `logo.png` (a rose illustration on white — dominant artwork tones `#BF4C79`, `#A95475`, `#EBD1DE` deepened to an AA-safe brand ramp) and codified in `shared/theme.ts`.

### Brand

| Token | Hex | Role |
|---|---|---|
| `brand` | `#7A314F` | Primary actions, active nav, links, filled controls |
| `brandStrong` | `#642640` | Pressed/hover brand, secondary daisyUI color |
| `brandMid` | `#994B68` | Accent (icons, illustration accents, daisyUI accent) |
| `brandMark` | `#B65B7E` | Decorative accents and large marks only (see rules) |
| `brandSoft` | `#F4E9EE` | Selected backgrounds, chip fills, hover washes |
| `brandWash` | `#FBF7F9` | Barely-there rose tint for hero/empty-state areas |
| `onBrand` | `#FFFFFF` | Text/icons on any brand fill |

### Neutrals

| Token | Hex | Role |
|---|---|---|
| `surface` | `#FFFFFF` | Cards, tables, sidebar, inputs |
| `canvas` | `#FBF8F9` | Page background behind cards (web `base-200`; mobile `surface`) |
| `text` | `#262126` | Primary text |
| `textMuted` | `#5E575D` | Secondary text, table metadata |
| `textPlaceholder` | `#6B6268` | Input placeholders |
| `border` | `#DED5D9` | Card and input borders (structural, non-text) |
| `divider` | `#E9E2E5` | Row separators, hairlines |
| `shadow` | `#33232B` | Shadow tint (warm plum-gray, never pure black) |

### Status

| Token | Hex | Soft | Use |
|---|---|---|---|
| `success` | `#176B4A` | `#E8F4EE` | Approved, completed payments, healthy signals |
| `warning` | `#805500` | `#FFF4D9` | Pending review, no-show |
| `error` | `#9F3030` | `#FCECEC` | Cancelled, failed, destructive |
| `info` | `#285786` | `#EAF1F8` | Rescheduled, informational, scheduled |

Appointment status → badge mapping (used on both platforms): pending → warning, approved → success, rescheduled → info, completed → neutral, cancelled → error, no-show → warning outline.

### Contrast (WCAG, verified against these exact values)

| Pair | Ratio | Verdict |
|---|---|---|
| `text` on `surface` | 15.81:1 | AAA |
| `text` on `canvas` | 14.98:1 | AAA |
| `textMuted` on `surface` | 7.01:1 | AAA |
| `textMuted` on `canvas` | 6.64:1 | AA |
| `textMuted` on `brandSoft` | 5.92:1 | AA |
| `textPlaceholder` on `surface` | 5.88:1 | AA |
| `onBrand` on `brand` | 8.82:1 | AAA (buttons, active nav) |
| `onBrand` on `brandStrong` | 11.09:1 | AAA |
| `brand` on `surface` | 8.82:1 | AAA (links, brand text) |
| `brandStrong` on `surface` | 11.09:1 | AAA |
| `brandMid` on `surface` | 5.90:1 | AA — small text allowed |
| `brandMark` on `surface` | 4.39:1 | Large text (≥24px/19px bold) and decorative only — never small text |
| `success` on `successSoft` / on `surface` | 5.75 / 6.48:1 | AA |
| `warning` on `warningSoft` / on `surface` | 5.97 / 6.53:1 | AA |
| `error` on `errorSoft` / on `surface` | 6.24 / 7.14:1 | AA |
| `info` on `infoSoft` / on `surface` | 6.59 / 7.51:1 | AA |
| `border` on `surface` | 1.44:1 | Decorative structure only — controls always pair border with a fill or a visible text/label |

Rules: body text is always `text` or `textMuted` on `surface`/`canvas`. Status color is used as text-on-soft or as a filled badge with its soft color's text — never as tinted text on busy backgrounds. No color carries meaning alone; every badge also has a text label.

## Logo usage

- `logo.png` (248×289, rose illustration on transparent): login screens on both apps, web login card (rendered ~64×75), anywhere a friendly brand moment is wanted. Never recolor it; always on `surface` or `canvas`.
- `logo.svg` (30×30, dark rounded square `#2D2D2D` with white mark and a slow "breathe" opacity animation): favicon (`web/src/app/icon.svg`), app/adaptive icons. The breathe animation is favicon-only; static everywhere else.
- Clear space equal to the logo's mark width; never place the rose PNG on brand-color fills.

## Type

System font stack on both platforms (no webfont): `-apple-system, BlinkMacSystemFont, "Segoe UI", …` on web; the platform default on mobile. One shared scale in `shared/theme.ts`:

| Style | Size / line height | Web (Tailwind) | Mobile use |
|---|---|---|---|
| Caption | 12 / 18 | `text-xs` | Tab labels, badges, table meta |
| Small | 14 / 21 | `text-sm` | Table body, helper text |
| Body | 16 / 24 | `text-base` | Default reading size |
| Subhead | 18 / 26 | `text-lg` | Card titles, section leads |
| Title | 20 / 28 | `text-xl` | Screen sub-headers |
| Heading | 24 / 32 | `text-2xl` | Page/screen titles |
| Display | 30 / 38 | `text-3xl` | KPI numbers, hero moments |
| Large title | 34 / 42 | `text-4xl` | Rare; auth screens only |

Web defaults: body 16px, line-height 1.5, antialiased. Headings are semibold–extrabold with tight tracking; KPI numbers are extrabold `Display`. Weights: 400 body, 500–600 labels/buttons, 700–800 headings.

## Spacing

One scale, multiples of 4: `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40 · 5xl 48 · 6xl 64`.

- Mobile: screen side padding `lg` (16), card padding `lg`, between cards `md–lg`, section gaps `xl–2xl`, tab bar padding `sm`.
- Web: card padding `xl` (20) / header cards `2xl` (24), table cell padding `md` (12) horizontal, KPI grid gap `xl`, section rhythm `3xl` (32) between page sections, sidebar item padding `md–lg`.
- When in doubt, add white space — both apps should breathe.

## Radii

| Token | px | Use |
|---|---|---|
| `sm` | 8 | Small chips, tags |
| `md` | 12 | Buttons, inputs, stat cards, daisyUI `--rounded-btn` |
| `lg` | 16 | Mobile cards, large content cards, daisyUI `--rounded-box` |
| `xl` | 24 | Hero/header panels (web `rounded-2xl`), modals |
| `full` | 9999 | Badges, pills, avatars, status dots |

Mobile cards additionally use `borderCurve: 'continuous'` for the soft squircle look.

## Shadows & elevation

Elevation is quiet; borders do the structural work. Shadows are warm (`shadow` `#33232B` or `brandStrong`), never pure black.

- **Web:** `shadow-sm` on cards, stat cards, and header panels (the pattern in use: `bg-base-100 … border border-base-300 shadow-sm`). No hover elevation on tables; interactive rows use background change, not lift.
- **Mobile:** the shared `Card` is flat — 1px `border` + `radius.lg`, no shadow. Shadows are reserved for things that float: the primary CTA on auth screens, Home action tiles, and the booking confirm bar — `shadowColor` brand family, offset y 2–4, opacity ≈0.08–0.15, radius 4–8, Android `elevation` 1–4.
- Modals/drawers (web mobile drawer, alerts) get the strongest allowed shadow; nothing else escalates.

## Components

### Mobile UI kit (`mobile/components/ui/`) — use these, never ad-hoc styling

| Component | Behavior |
|---|---|
| `Button` | Primary (brand fill, white text), outline (brand border), destructive; 44pt min height; loading state |
| `Card` | Flat white card, 1px border, radius 16, continuous corners, padding `lg` |
| `Badge` | Status pill, soft fill + dark status text, caption size, full radius |
| `ListRow` | 44pt+ row with divider, chevron/optional trailing |
| `TextField` | Labeled input, 44pt, placeholder token color, error text slot |
| `ScreenHeader` | Screen title block; Home also has a top-bar profile icon |
| `EmptyState` | Friendly icon + title + caption, optional action |
| `ErrorState` | Title + plain-language message + Retry |
| `LoadingState` | Calm spinner + optional label |

### Web (daisyUI on `mcareTheme`, one light theme)

| Pattern | Behavior |
|---|---|
| Sidebar + `dashboard/layout.tsx` | Fixed left nav, grouped sections, role-filtered; active item `bg-primary text-primary-content`; mobile drawer with overlay |
| Stat card | White card, border + `shadow-sm`, uppercase caption label + icon, `Display` number, caption sub-line |
| Dense table | `text-xs/sm`, header row muted uppercase, row dividers `divider`, 10-row pagination, per-row actions |
| Status badge | daisyUI badge mapped per the status table above |
| Calendar strip | Week/month toggle, weekdays only navigable, today highlighted brand |
| Form controls | 44px min-height inputs (global CSS), radius 12, focus ring `--mcare-focus` (brand), visible `focus-visible` rings |
| Loading / empty / error | Full-page and inline variants, Retry on errors; nothing spins forever |
| Buttons | `btn-primary` (brand), outline, neutral; uppercase-ish label weight 600; icon+label rows |
| Modal / drawer | White panel, radius `xl`, overlay, focus-trapped |

## Iconography

Single lightweight inline line-icon set (web `Icon` component), 1.5–2px stroke, 20px default (`size.icon`), 18px in table rows, currentColor only. No filled/mixed icon styles. Medical icons allowed: stethoscope, clock, check-circle, users, calendar.

## Motion

Minimal and purposeful. Web: 150–200ms ease-out on hover/active/background changes; the overview live-ping is the only ambient animation. Mobile: default platform animations, pull-to-refresh, no custom transitions between wizard steps beyond standard fades. Favicon breathe loop (2.5s) stays in the SVG only.

## Screen layouts (plain words)

### Website — staff dashboard

- **Login** — centered white card on canvas, logo top, email + password, toggle to 6-digit email OTP mode, error and success lines inline. Patients who log in here are signed out and pointed to the app.
- **Dashboard shell** — fixed left sidebar with grouped nav (Workspace: Overview, Appointments, Doctor Schedules; Care: Patients, Medical Records, Patient Inquiries; Operations: Transactions, Analytics, Reports & Export; Administration: Staff Management), each item role-filtered; a "Clinic staff account" badge; content column on canvas.
- **Overview** — header panel ("Today's Clinic Overview", live pulse dot, "Open Live Calendar" button) then four stat cards: Pending Triage (amber), Confirmed Bookings (green), Consultations Today (brand), Registered Patients (neutral) — Manila-time day boundaries, realtime updates. Today's schedule and recent activity follow.
- **Appointments** — header + list/week/month view toggle; week strip with weekday-only navigation; filter and sort controls; a dense 10-per-page table (patient, service, doctor, date/time, status badge) with row actions approve / decline / cancel / reschedule / complete, shown by role. This is the workhorse screen; density beats decoration.
- **Patients** — search bar with result stats, dense paginated table (name, phone, blood type, emergency contact), row detail actions by role.
- **Medical Records** — role capability line under the header; dense table (visit date, patient, physician, vitals, diagnosis, Rx, chart actions); edit modal with role-separated clinical fields (nurse: vitals/triage; doctor: diagnosis/Rx); every view audit-logged.
- **Doctor Schedules** — two-column: weekly-hours form plus per-weekday schedule lists; blocked-date exceptions below with reasons.
- **Inquiries** — table with status badges (open/replied/closed), reply composer on selection, realtime refresh.
- **Transactions** — record-a-transaction form for completed visits (doctor/admin), table with amounts in PHP, void action with required reason; audit-backed.
- **Analytics** (admin) — chart cards (recharts area/line/bar/pie: trends, status mix, top services, registrations), each titled with a takeaway, brand-led chart colors.
- **Reports & Export** — date-range pickers, summary tables, and CSV download buttons for appointments/patients/records/transactions.
- **Staff Management** (admin) — invite form (name, email, role) and a searchable staff table with role badges.
- **Public pages** (privacy, delete-account, patient-app notice, landing) — single quiet article column (max ~3xl), generous whitespace, brand links; no dashboard chrome.

### Mobile — patient app

- **Welcome** — logo, app name, one-line reassurance, primary Sign In, outline Create Account, privacy link. Lots of white space.
- **Login / Register** — logo top; labeled TextFields in a Card; primary Button (soft brand shadow); password ↔ OTP toggle; consent checkbox on register; privacy link at the foot.
- **Home** — ScreenHeader greeting with profile icon (top bar), the next appointment as a highlight Card with status Badge, two large action tiles ("My Clinic Visits", "Message Clinic Staff"), attending-doctor line; pull-to-refresh; realtime updates.
- **Book** — the guided four-step wizard with visible progress: 1 Choose Service → 2 Choose Appointment Date (month calendar; weekends and past days grayed and unselectable) → 3 Choose Time (slot chips grid; unavailable grayed with a label, selected filled brand) → 4 Review & Confirm (summary Card: Patient, Service, Attending Doctor, Room/Clinic, Date, Time) → Confirm & Book. Errors offer Retry and return to the relevant step; success celebrates briefly, then offers "View My Visits".
- **Visits** — status filter chips, appointment Cards (service, formatted Manila date/time, status Badge), Cancel with a clear two-line confirm dialog for eligible visits.
- **Transactions** — Cards with service, PHP amount, status Badge, date; read-only history of in-person payments.
- **Records** — read-only visit cards; opening one is audit-logged; plain explanation of what records are.
- **Alerts** — notification ListRows with unread dot, tap to mark read, Mark-all-as-read; push notifications feed the same list.
- **Profile** — grouped form Cards (personal, emergency contact, health: blood type, allergies, obstetric history), Save, Sign out, Delete account (destructive, double-confirm with what is removed vs kept), privacy link.
- **Inquiry** — subject + message to clinic staff, sent history with clinic replies.
- **Tab bar** — Home, Book, Visits, Transactions, Records; caption-size labels; Alerts lives behind a bell icon in the top-right header; Profile lives behind the Home top-bar icon.

## Planned features (NOT BUILT YET)

### Website — Inventory Management (Admin)

- **Inventory List** — Table showing all medical consumables (gloves, syringes, etc.) with columns: Item Name, Category, Current Stock, Minimum Stock Level, Location, Last Updated. Each row has edit action to open dialog. Low stock items show a yellow/red badge based on threshold.
- **Stock In** — Dialog from Inventory List "Add Stock" button. Form with item selector, quantity input, batch number field, expiry date picker, notes. After submit, row updates with new quantity and timestamp.
- **Stock Out** — Dialog from Inventory List "Use Stock" button. Form with item selector, quantity, used-by (patient/doctor), reason dropdown, timestamp. Updates stock level and logs consumption.
- **Adjustment** — Dialog for manual corrections. Form with item, adjustment type (+/-), quantity, reason, admin approval field. Used for damaged/expired items.
- **Consumption Report** — Date-range report showing total items used, categorized by type. Export to CSV button. Columns: Item, Total Used, By Service, Average Daily, Trend indicator.

### Mobile — Walk-in Visit Dialog (Planned)

- Dialog from Appointments screen "Report a walk-in visit" button. Form with: Visit Date (date picker), Service (dropdown), Notes field, Consent checkbox for "I was seen without prior booking". On submit, creates pending appointment record and notifies clinic. Shows success message with clinic contact if follow-up needed.

### Mobile & Website — Clinic Info Screen (Planned)

- **Mobile** — New screen accessible from Profile menu. Displays: Clinic Name "M-Care OB-GYN and Ultrasound Clinic", Address "Balibago, Angeles City", Phone number with tap-to-call button, Operating Hours table (Mon-Fri 8AM-5PM), Doctor info "Dr. Bernice Paule, OB-GYN/Sonologist", Emergency contact "Call 911 or clinic directly", Get Directions button (opens maps with address).
- **Website** — Section on landing page (below the main card) showing same info in 2-column layout: left column with logo + name, right column with contact details in grid. Get directions button links to Google Maps.

### Website & Mobile — Analytics Views (Planned)

- **Patient Demographics** — Dashboard section showing age distribution (bar chart), gender split (pie chart), registration trend over time (line chart), consultation frequency by blood type. Filterable by date range.
- **Payment Summaries** — Monthly revenue report (area chart showing PHP totals), average transaction by service, payment status breakdown (completed/pending/refunded), top revenue-generating services.

## Accessibility rules (binding)

1. All text meets WCAG AA at minimum per the table above; body text targets AAA.
2. Tap/click targets ≥ 44pt/44px on both platforms (mobile `size.tapTarget`; web `min-h-11` controls).
3. Visible `focus-visible` rings on all web interactive elements; screen-reader roles/labels on mobile touches (`accessibilityRole`, `accessibilityState`).
4. Color never carries meaning alone — status always has a text label.
5. Loading states end in ErrorState with Retry within the request timeout; nothing spins forever.
6. Manila time is presented in plain words everywhere a date/time is shown.

## Decisions this document fixes (confirm or veto)

1. Light theme only — no dark mode in either app.
2. System fonts only — no purchased/web fonts.
3. `brandMark` is decorative/large-text only.
4. Shadows stay quiet (web `shadow-sm`; mobile flat cards, shadow on floating CTAs only).
5. Mobile bottom tabs stay at **five** with Profile off the bar and Alerts moved to header bell icon.
