# Final readiness report

Scope was limited to `recover-features` and dev Supabase ref `luccnwicirfnmyzgemzj`. Production ref `pojgizdueifvhgpbvqay` was not queried or changed. No web browsing, screenshots, device checks, production builds, migrations, or deployments were performed. `docs/AGENT_PROMPT.md` was not present in this checkout.

## What is proven

- `git branch --show-current` returned `recover-features`; initial `git status --short --branch` showed a clean worktree tracking `origin/recover-features`.
- Read `shared/privacy-policy.ts`: its Retention section explicitly says clinical records, **transaction records**, and audit history may be retained after account deletion in restricted form. The Information collected section describes the transaction amount, currency, payment-method label, notes, and recorder.
- Compared `find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\\n' | sort -V` and the function directory listing with `PRODUCTION_RUNBOOK.md`. The repository has migrations `00014_weekday_appointments.sql` through `00025_transaction_history.sql`, and Edge Functions `create-staff`, `delete-account`, and `send-reminders`. The runbook now names the full migration set and all three functions.
- In `mobile/`, `npx expo config --type introspect --json` returned permissions `android.permission.POST_NOTIFICATIONS` and `android.permission.INTERNET`; blocked permissions are `android.permission.READ_EXTERNAL_STORAGE` and `android.permission.WRITE_EXTERNAL_STORAGE`. The resolved Android target SDK is **36**, from `node_modules/react-native/gradle/libs.versions.toml` (`targetSdk = "36"`).
- `npm audit --omit=dev` in `web/` completed with 2 findings: 1 moderate and 1 high. The high finding is PostCSS (nested under Next.js), which is build/CSS processing tooling and is not application website code shipped to visitors. The audit's available fix requires Next.js 16, a major upgrade.
- `npm audit --omit=dev` in `mobile/` completed with 19 findings: 1 low, 13 moderate, and 5 high. High findings: `decode-uri-component` through `query-string` (in the mobile production dependency tree, so it is eligible for app bundling; repository source does not import `query-string`, so actual bundle inclusion is unproven; the listed fix is `query-string@10`, a major); `deepmerge` through Expo config/CLI dependencies (build tooling); `image-size` (transitive Expo asset/config tooling, used during build rather than shipped app behavior; audit says `npm audit fix` can resolve it); and PostCSS (Metro/build CSS tooling). Expo's config dependency chain also shows affected `@expo/config`, CLI, config plugins, and Metro packages; the broad listed fix upgrades to Expo SDK 58, a major SDK change. No package upgrades were applied.
- `git diff --check` passed after the report and progress update were written.

## What is not proven

- No screenshots were captured, as instructed. No phone/tablet layout, responsive browser layout, accessibility contrast, or visual viewport checks were made.
- No production migration status, production function state, website host/configuration, EAS production build, Play upload, or Play Console declaration was verified.
- The audits report dependency advisories; they do not prove exploitability in M-Care's usage. The mobile advisory fix path for `image-size` was identified by npm but not applied or re-audited.
- `expo config --type introspect` reported permissions but did not print `targetSdk`; SDK 36 was verified separately from the installed React Native version catalog.
- `docs/AGENT_PROMPT.md` could not be reviewed because it is absent.

## Every placeholder to fill or verify

- `RETENTION_PERIOD` — select and document the approved schedule in the policy, worksheet, and deletion plan. This remains an open clinic decision.
- Policy effective date — set after clinic approval.
- Official privacy, complaint, and deletion-request channels and identity-verification instructions — specify them in the policy and public deletion page.
- Provider/processor legal names, service roles, processing/storage locations, safeguards, retention terms, and relevant agreements — verify for Supabase, email delivery, Expo push, and any other production provider; publish the approved recipient list.
- Play listing and declarations — supply final listing text/assets, privacy and deletion URLs, screenshots, content rating responses, data-safety answers, and current release/version details.
- Confirm whether the repository's current statement that in-person payments only are recorded remains accurate for the deployed service configuration.

## Clinic decisions required

- Approve the privacy policy, effective date, public clinic identity/contact details (M-Care; Balibago, Angeles City; dposadas003@gmail.com), complaint route, and deletion-request verification procedure.
- Set retention periods and approve which profile, clinical, transaction, and audit fields remain after account deletion, including backup expiry.
- Decide how to handle identifying details that may remain in historical free-text clinical notes or audit before/after payloads, and whether retained fields are necessary for care or legal duties.
- Confirm payment collection practices and approve the transaction wording and Play Console financial-data declarations accordingly.
- Approve the provider/recipient list, provider locations, safeguards, and processing terms.
- Confirm website production hosting and environment ownership, EAS production environment/signing setup, and whether `create-staff` or `send-reminders` need production deployment for this release.
- Review and approve the Google Play store listing, health disclaimer, content rating, data-safety answers, account-deletion disclosures, and release submission.

## Owner-only steps, in order

1. Fill the placeholders and resolve every clinic decision above; approve and publish the privacy and deletion disclosures.
2. Confirm production project identity and secret-store access. Follow `PRODUCTION_RUNBOOK.md` to inspect the production migration list and dry run; reconcile the full migration set before pushing only approved pending migrations.
3. Deploy/verify only the approved Edge Functions (`delete-account` for the deletion change; `create-staff` and `send-reminders` only if confirmed needed), then run approved smoke checks with dedicated test accounts.
4. Configure the website production host/environment for production ref `pojgizdueifvhgpbvqay` and publish the website.
5. Configure EAS production environment and Android signing, build the Android app, and review the generated artifact and release metadata.
6. Complete Play Console listing, privacy/deletion URLs, screenshots, content rating, health-app disclosures, and data-safety declarations using the clinic-approved facts; upload the build, submit for review, and monitor the review outcome.

## Known risks

- Production is intentionally untouched and requires owner execution and clinic approval.
- High dependency advisories remain. The website PostCSS and mobile Expo/PostCSS build-tooling fixes listed by npm require a major Next/Expo upgrade; the bundled mobile `query-string` path requires a major `query-string` upgrade. Do not resolve these through forced upgrades without a planned compatibility release. Review the separately fixable `image-size` advisory before the next build.
- Patient/clinical free-text and historical audit payloads can contain identifiers that the current deletion flow does not reliably scrub.
- The final user experience and device layouts remain unreviewed on screenshots or physical devices.
