# Work Progress

## Phase 0 — Verify state / bootstrap

- Confirmed branch `release-hardening`, reviewed git status and the last 15 commits, and preserved all existing worktree changes.
- Loaded dev variables from `~/.config/mcare/dev.env` only in the relevant commands; all three required variables were present. No values were printed by the checks.
- Confirmed linked ref `luccnwicirfnmyzgemzj`; migrations 00001–00021 were applied before Phase 4 migration 00022. RLS was enabled on every public table at verification.
- Mobile and web env files point to dev; production EAS profile points to `pojgizdueifvhgpbvqay`; no actual env file is tracked. `dev-backup.sql` remains untracked and must not be committed.
- Created the dev patient and admin accounts with generated passwords printed once in the terminal. The doctor account operation failed against a malformed migration-created Auth user; migration 00021 adds its missing email identity, but the Admin API still returned an error on the follow-up lookup. Doctor login remains unverified.
- Added `scripts/dev-create-user.mjs` and `docs/ADMIN_BOOTSTRAP.md`. Phase 0 is not fully complete and has not been committed.

## Phases 1–3 — Dev deployment, attack tests, and app flow tests

- Not completed or verified in this session. The user requested proceeding to Phase 4 on the assumption that these phases were done; no success is claimed here.

## Phase 4 — Privacy policy and account deletion

- Added the shared privacy policy text, mobile privacy screen, public `/privacy` and `/delete-account` pages, mobile links, and account deletion controls in patient settings.
- Added migration `00022_privacy_deletion_retention.sql`; it was applied to dev. Profiles and patient records survive auth-user deletion; the auth link is set null. `patients.deleted_at` records the deletion time. The function clears direct profile/emergency details, cancels future appointments, clears appointment notes, and removes notifications, push tokens, and inquiries.
- Deployed `delete-account` to dev. Integration checks passed: unauthenticated request returned 401; a malicious target user ID did not delete the other patient; the authenticated caller's login was deleted; the anonymized profile and deleted patient record remained.
- `npm run typecheck`, mobile TypeScript check, and web production build passed. No simulator/device flow test was run.
- Added `docs/ACCOUNT_DELETION_PLAN.md` and `docs/PLAY_CONSOLE_WORKSHEET.md`. The clinic must approve the policy, placeholders, retention period, retained fields, and handling of identifiers in historical free-text and audit payloads. The purge helper is not scheduled.
- There is no public web signup screen in the current app; the privacy link is on the web login, while the mobile login and registration screens link to it. A mobile simulator review remains outstanding.
- Committed Phase 4 as `e74e802` (`feat: add privacy policy and account deletion`). Phase 0 files and other existing work remain unstaged.

## Phase 5 — Next.js patch and audit

- Upgraded web Next.js from 15.0.0 to 15.5.29, the current latest 15.x patch, and added matching `eslint-config-next` 15.5.29 as a dev dependency. React and React DOM remain 18.3.1.
- Web TypeScript check and production build passed. A dev API smoke test passed password sign-in, booking a valid slot, reading it, cancelling it, and test-data cleanup. No browser UI sign-in/booking session was run.
- `npm audit` reported 10 web issues (9 moderate, 1 high) and 28 mobile issues (1 low, 18 moderate, 8 high, 1 critical). Non-forced `npm audit fix` could not resolve the Expo workspace peer tree: npm tried to resolve Expo 57 while this app is on SDK 52. The web-only safe fix reported no compatible updates. Force fixes would require Next 16 or Expo 58, so none were applied.
- Committed Phase 5 as `003078e` (`chore(web): patch Next.js 15`).

## Phase 6 — Expo SDK upgrade (SDK 53 step)

- Waived the Phase 0–3 completion gate at the user's direction. Created branch `expo-sdk-upgrade` from `release-hardening`.
- Upgraded the mobile app from Expo SDK 52 to SDK 53 with SDK-compatible dependencies (React 19.0.0, React Native 0.79.6). Expo Doctor passed all 18 checks. The mobile TypeScript check passed after adapting the timer type and notification handler to the new types.
- Android notification channel creation now happens before checking/requesting notification permission and before requesting a push token.
- SDK 53 was committed as `a39c182` (`chore(mobile): upgrade Expo SDK 53`).
- Starting-point check found four missing style keys in `mobile/app/(tabs)/profile.tsx`; restored them and committed as `b09d228` so the SDK 54 step started with a clean TypeScript check.

## Phase 6 — Expo SDK upgrade (SDK 54 step)

- Upgraded the mobile app from Expo SDK 53 to 54: Expo 54.0.38, React 19.1.0, React DOM 19.1.0, React Native 0.81.5, React Native Web 0.21.x, and SDK-matched Expo packages. Added explicit `react-dom@19.1.0` and updated `@types/react` to ~19.1.10 and TypeScript to ~5.9.2 to satisfy npm peer resolution.
- Regenerated the workspace install tree so npm hoists the mobile React 19 tree and nests the web workspace's React 18 copies; this cleared Expo Doctor's duplicate-dependency check while `web/` remains on React 18.3.1 and Next.js 15.5.29.
- Expo Doctor passed all 18 checks and the mobile TypeScript check passed. No Android or iOS folder is tracked.
- Committed SDK 54 as `637b52c` (`chore(mobile): upgrade Expo SDK 54`).
## Phase 6 — Android configuration (after SDK 54)

- Added the `expo-notifications` config plugin and declared `android.permission.POST_NOTIFICATIONS` in `app.json`. The regenerated (ignored) Android manifest contains `POST_NOTIFICATIONS` and marks `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` with `tools:node="remove"` via `blockedPermissions`. No app feature uses device external storage; only Supabase storage is referenced.
- Confirmed `mobile/lib/notifications.ts` creates the Android notification channel before checking/requesting permission and before requesting the Expo push token.
- Replaced React Native's deprecated `SafeAreaView` (a no-op on Android) with `react-native-safe-area-context`'s `SafeAreaView` in all 11 screens so edge-to-edge Android 16 content is inset from the status and navigation bars.
- `npx expo config --type introspect` reports app permissions: INTERNET, SYSTEM_ALERT_WINDOW, VIBRATE, POST_NOTIFICATIONS, plus blocked READ/WRITE_EXTERNAL_STORAGE (`tools:node="remove"`). The resolved target SDK is 36: SDK 54's React Native 0.81.5 version catalog sets `targetSdk = 36`, `compileSdk = 36`, `buildTools = 36.0.0`, and `app.json` does not override it. `expo config --type introspect` does not emit `uses-sdk`; Gradle supplies it from that catalog.
- `mobile/eas.json`: development and preview profiles point at dev ref `luccnwicirfnmyzgemzj`; only the production profile points at production ref `pojgizdueifvhgpbvqay`, is set to `environment: "production"` so it reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from EAS environment variables, builds an `app-bundle`, and auto-increments the version code. No service role key is in `app.json`, `eas.json`, or `mobile/.env`; the untracked root `.env` used by local backend scripts contains one and is not read by the app.
- `npx expo-doctor` passed 18/18, the mobile TypeScript check passed, and `npx expo export --platform android` succeeded after these changes. Committed as `0ca99ed`.
- Android 16 emulator UI review was not run: the user instructed not to start the emulator on this device and will install an EAS build on their own phone. The layout fix above is static; the device check remains outstanding.
- No EAS build was run and no Android/iOS folder is tracked.

## Requested recovery tasks

### Task 1 — Brand assets

- Added the supplied `logo.png` to the mobile and web assets. Replaced the mobile illustrated logo in login, welcome, splash, and home header; replaced the web placeholder in login and dashboard header.
- Regenerated the mobile app icon, adaptive icon foreground, and splash image from the supplied PNG while preserving aspect ratio. Updated the splash and adaptive icon backgrounds to white.
- Added the supplied `logo.svg` as the Next.js app icon/favicon and removed `PregnantWomanLogo.tsx`.
- No email templates exist in this repository.
- Mobile TypeScript check passed. Web TypeScript check remains blocked by existing workspace type conflicts (React 18/19 `ReactNode` incompatibilities), stale `.next/types` references to missing `src/app/book/page`, and Recharts JSX type errors; no packages were changed.

### Task 2 — Canonical OB doctor

- Read the existing canonicalization migrations and checked dev before changes. Dev had exactly one doctor: Dr. Bernice Paule, `OB-GYNE / Sonologist`.
- Added idempotent migration `00023_ensure_canonical_ob_doctor.sql`; a dry run showed only 00023 pending, and it was applied to dev ref `luccnwicirfnmyzgemzj`. A follow-up read confirmed exactly one doctor with the requested name and specialty. Production ref was not queried.
- Mobile booking now assigns Dr. Bernice automatically. Removed doctor filtering from web appointments, the schedule selector, the records physician selector, and doctor account creation from staff management. Replaced the stale report sign-off name.
- Mobile TypeScript check passed. Web TypeScript still fails on the existing React 18/19 type conflict in Next/Link and Recharts components. The stale `.next` cache was isolated for the check and restored; package files were not changed.

### Task 3 — Booking calendar and Manila time

- Read dev migration 00019 and confirmed its `book_appointment` RPC validates the patient and slot but did not reject weekends. Mobile booking calls this RPC; there is no direct appointment insert in either app.
- Replaced the mobile 14-day date list with a month calendar. Past dates, weekends, and dates outside the displayed month are disabled and gray. Scheduled but unavailable times remain visible as disabled slots.
- Added migration `00024_reject_weekend_appointments.sql`, which rejects weekend appointments in Asia/Manila in both the booking RPC and a database trigger. Applied it to dev ref `luccnwicirfnmyzgemzj` and verified a Saturday insert is rejected. Production was not contacted.
- Added shared Manila date/time helpers and updated patient-facing mobile screens and web dashboard dates/times to use Asia/Manila. Booking load, slot, and submission failures show the returned error and a Retry action.
- Mobile TypeScript check passed. Web TypeScript check still fails on the stale `.next/types` reference to a removed route and existing React 18/19 Next/Link and Recharts JSX type conflicts. No packages were changed.

### Task 4 — TypeScript and dev booking verification

- Re-ran `npx tsc --noEmit` in `mobile/`: passed.
- Re-ran `npx tsc --noEmit` in `web/`: still fails on stale `.next/types` references to removed `src/app/book/page` and existing React 18/19 compatibility errors in Next layouts/links and Recharts JSX types. App manifests and packages were not changed.
- Against dev ref `luccnwicirfnmyzgemzj`, authenticated an existing patient session, booked an available weekday slot through `book_appointment`, and confirmed the patient could read back the appointment with Dr. Bernice, the requested start time, and `pending` status. Deleted the temporary appointment after verification. Production was not contacted.

## Google Play readiness — Phase 1: restore booking features

- Replayed the reviewed logo, canonical-doctor, and booking commits on `recover-features`; the task commits remain separate, and `opencode-attempt` was not merged.
- Added a patient-facing website `/book` route. Patient login now routes to it, middleware protects it by role, and the page selects Dr. Bernice automatically, loads services and weekday schedules, disables past/weekend dates and unavailable slots, displays Asia/Manila date/time, and submits through `book_appointment`. No direct appointment insert exists in either app.
- Dev project list and migration list confirmed ref `luccnwicirfnmyzgemzj` with migrations 00001–00024. Read-only dev verification found exactly one doctor (Dr. Bernice Paule, `OB-GYNE / Sonologist`) and five active services.
- Dev booking verification rejected a weekend request, accepted a weekday request through `book_appointment`, verified the patient's readback had Dr. Bernice and `pending` status, then removed the temporary appointment.
- Mobile TypeScript check passed. Web TypeScript still reports existing React 18/19 incompatibilities in Next layouts/links and Recharts JSX. The added booking route reports no TypeScript errors. Browser-driven web booking could not be run because no browser automation package or browser binary is installed here.
- Later transaction, sync, design, Play, privacy/runbook, and final-report phases remain unstarted.

## Google Play readiness — Phase 2: transaction history

- Added and applied new migration `00025_transaction_history.sql` to dev ref `luccnwicirfnmyzgemzj`. The `transactions` table stores profile `user_id`, appointment, amount, PHP-default currency, plain payment-method label, notes, recorder, timestamp, and void metadata. It has one row per appointment, restricts appointment/profile deletion, and has RLS enabled.
- Client sessions have SELECT only: patients read only their own transactions; doctor/admin roles can read for clinic operations. Clients have no direct insert, update, or delete privileges. `record_appointment_transaction` derives the patient from the appointment, requires doctor/admin role, requires completed status, and limits doctors to their own appointments.
- Added admin-only `correct_appointment_transaction` and `void_appointment_transaction` functions. Updates are written to `audit_logs` with old/new values and reason; voided rows remain in history. Existing `admin` and `doctor` roles are used; no new role was needed.
- Added mobile Transaction History tab, patient web `/transactions` page, and doctor/admin `/dashboard/transactions` workspace. Both histories display PHP amounts to two decimals, visit/recorded dates, service, method, reference, void status, and loading/empty/error states. The clinic form records only a plain label and amount after a completed, in-person service; there is no checkout or payment gateway.
- Added `supabase/tests/transactions.test.mjs`. It passed on dev: incomplete appointment, patient RPC, direct insert/update/delete, cross-user read, duplicate transaction, and wrong-doctor attempts were rejected; patient/admin reads, doctor/admin recording, audit correction, and void history passed. Test fixtures were removed.
- Mobile TypeScript check passed. Web TypeScript check still reports 34 existing React 18/19, Next layout/link, and Recharts type errors; no errors reference the new transaction pages. No packages were changed.
- Privacy-policy transaction wording remains for Phase 5. Cross-platform appointment/transaction/profile sync verification and UI screenshot/visual work remain for later phases.

## Google Play readiness — Phase 3: cross-platform data sync

- Added the patient website `/appointments` view with refresh, clear loading/empty/error states, Asia/Manila date/time, and cancellation through `cancel_my_appointment`. Added `/profile` to read and update the same `profiles` and `patients` rows used by mobile. Both routes are session-protected and linked from the shared patient header.
- Updated mobile appointment cancellation to use `cancel_my_appointment` instead of a direct appointment-table update. Added a retry state for appointment-load failures.
- Added `supabase/tests/cross-platform-sync.test.mjs`. Against dev ref `luccnwicirfnmyzgemzj`, two independent authenticated patient sessions proved that mobile booking appears on the website, a staff reschedule appears with the same timestamp and status after both clients refresh, a website booking appears on mobile, mobile cancellation appears on the website, and both transaction-history reads return the same post-service record. The test also verified shared profile reads after an update. Manila-formatted dates were identical. All temporary dev fixtures were removed.
- `npx tsc --noEmit -p tsconfig.json` passed in `mobile/`. The web check still fails on the existing React 18/19 and Recharts/Next type incompatibilities; no errors reference the Phase 3 patient appointment/profile pages or shared header. Browser-driven UI verification remains unavailable in this environment, so the sync proof is through the real dev Supabase client flows rather than browser automation.
- Production was not contacted. No packages or migrations were changed in this phase.

## Google Play readiness — Phase 4: shared visual system

- Added shared logo-derived color, spacing, type, radius, and semantic state tokens and applied them across the mobile screens, website theme, dashboards, and public privacy/deletion pages. Standardized form controls, focus treatment, buttons, cards, responsive dashboard navigation, and accessible icon usage; replaced emoji and inconsistent glyphs with platform icons or the shared inline SVG icon set.
- Added safe-area handling to the mobile splash and privacy screens. Corrected the mobile home logo asset path after Metro bundle resolution exposed it.
- Replaced unresolved privacy-policy tokens with a clearly identified draft status and non-placeholder contact/retention wording. The policy still requires clinic review and approval; the clinic must supply/approve the effective date, official privacy contact channels, processor list and provider locations, and retention schedule.
- Removed generated screenshots at the user's request. No screenshots or visual viewport checks were produced; responsive/contrast claims are based on the shared tokens and code inspection, not browser/device measurements.
- `git diff --check` passed. Mobile `npx tsc --noEmit -p tsconfig.json` passed. Web typecheck still fails due to the workspace resolving Next and its React types from the root React 19 installation while the web app declares React 18.3.1; this produces JSX/ReactNode errors in Next layouts/links and Recharts. `next typegen` regenerated route types but did not resolve the React mismatch. Package changes are prohibited without user instruction.
- No package files, migrations, credentials, or production systems were changed in this phase.

## Google Play readiness — Phase 5: Play configuration and privacy/deletion audit

- Confirmed the committed mobile app configuration uses Expo SDK 54, includes the `expo-notifications` plugin and Android `POST_NOTIFICATIONS` permission, and creates the Android notification channel before requesting notification permission. The SDK 54 React Native 0.81.5 Android version catalog resolves target and compile SDK 36; no SDK or package changes were made in this phase.
- Confirmed privacy policy screens/pages and account deletion flows exist, the shared policy says transaction records may be retained, and `/privacy` and `/delete-account` are public website routes. Policy approval, effective date, processor/recipient list, provider locations/safeguards, official privacy contact, and retention schedule remain clinic decisions.
- Screenshot capture was skipped as requested. No EAS production build, Play submission, or production deployment was run.

## Google Play readiness — Phase 6: production runbook and final evidence

- Added `PRODUCTION_RUNBOOK.md` with the exact migration inspection/push sequence, the five migrations 00021–00025 including `00025_transaction_history.sql`, delete-account function deployment, and owner-run website/Android publication steps. The runbook states that the website hosting provider is not configured in this repository and requires clinic confirmation.
- Mobile TypeScript check passed. Web TypeScript check remains blocked by incompatible React 18/19 type resolution; no dependency changes were authorized. Existing dev booking, transaction attack, and cross-platform sync checks are recorded above; temporary screenshot-test accounts and records were removed from dev.
- Production was not contacted, linked, or modified. Project-list inspection is the only project-list operation; no production database/function/build/deploy/submit command was executed.
- Outstanding release evidence: no screenshots/device/browser viewport test; no production migration status or deployment (intentionally); no Play Console completion; and clinic decisions listed in Phase 5 and the final report.

## Follow-up — canonical doctor seed integrity

- Final source scan found the local `supabase/seed.sql` still described three retired doctors, even though dev and the live app flows use only Dr. Bernice Paule. Updated the seed to preserve the migration-owned canonical doctor record, removed the legacy doctor accounts and rows, and assign seed schedules, sample appointments, records, notifications, and audit activity to Dr. Bernice.
- Seed sample appointment dates now resolve to weekdays in Asia/Manila so migration 00024's weekend constraint does not reject a local seed reset.
- `git diff --check` passed and a source scan confirms the seed contains no retired doctor names or obsolete doctor IDs. A local Supabase reset was not run in this environment.

## Follow-up — privacy policy transaction disclosure

- Updated the shared policy to explain that M-Care does not collect payments or payment card/wallet details; the clinic records the in-person amount and plain payment-method label after a completed service. The retention section now explicitly includes transaction records after account deletion.
- The policy still requires clinic approval of its effective date, official contact/complaint channels, processor names and locations, and retention schedule.

## Follow-up — production EAS command accuracy

- Checked the Expo EAS app-store release instructions and corrected the owner-run commands in `PRODUCTION_RUNBOOK.md` to invoke the documented `eas-cli` package and submit the latest Android build. These commands were not run.

## Follow-up — web React type alignment

- After explicit user authorization, aligned the web workspace's React, React DOM, and type declarations to the existing Expo workspace versions: React/React DOM 19.1.0, `@types/react` 19.1.17, and `@types/react-dom` 19.1.9. This removes the split React 18/19 resolution that caused website JSX/ReactNode errors. Updated only `web/package.json` and the root `package-lock.json`.
- Web `npx tsc --noEmit` passed; mobile `npx tsc --noEmit -p tsconfig.json` passed. The local Next.js website build passed lint/type checking, generated all 22 static pages, and completed successfully. No EAS/Android production build was run.
- `npm install` reported 8 workspace audit findings (7 moderate, 1 high); no automatic audit fix was run. Review them separately before release.
