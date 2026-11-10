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
- Phase 4 changes are ready for a phase-scoped commit; phase 0 files and other existing work remain unstaged.
