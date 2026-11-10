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
- Android 16 emulator review and runtime behavior checks remain for the SDK 54 step. No EAS build was run.
- SDK 53 step is ready for its required commit.
