# Production release runbook

This runbook is for the clinic owner to review and execute after approving the final report. None of these commands were run during dev readiness work. Verify every displayed project reference before proceeding; stop if the linked reference is not `pojgizdueifvhgpbvqay`.

## 1. Review and push database migrations

Run from the repository root with the Supabase CLI authenticated. Do not source the dev environment file for production. Use the production database password from the clinic's approved secret store only when the CLI requests it.

```sh
npx supabase projects list
npx supabase link --project-ref pojgizdueifvhgpbvqay
npx supabase migration list --linked
npx supabase db push --dry-run --linked
```

Review the dry-run output. It must show only the migrations approved for production. The release includes these new migrations, in order, after confirming their application status:

1. `supabase/migrations/00021_repair_canonical_doctor_identity.sql`
2. `supabase/migrations/00022_privacy_deletion_retention.sql`
3. `supabase/migrations/00023_ensure_canonical_ob_doctor.sql`
4. `supabase/migrations/00024_reject_weekend_appointments.sql`
5. `supabase/migrations/00025_transaction_history.sql`

If the dry run includes any unexpected migration, stop and resolve the migration history before pushing. If it is correct, push the pending migrations:

```sh
npx supabase db push --linked
npx supabase migration list --linked
```

Confirm the five migrations above are recorded as applied before continuing.

## 2. Deploy the account-deletion function

The database migration creates the supporting privacy/deletion records and policies. Deploy the matching Edge Function only after the database migration push succeeds:

```sh
npx supabase functions deploy delete-account --project-ref pojgizdueifvhgpbvqay
```

Verify the function in the Supabase dashboard and run the clinic's approved production smoke test with a dedicated test account. Do not use a real patient's account for deletion testing.

## 3. Publish the website and Android app

The repository does not define a website production host or deployment command. Confirm the clinic's hosting provider and production environment before publishing the website. Ensure its Supabase URL and anon key belong to `pojgizdueifvhgpbvqay`; never put a service-role key in a client environment.

After the clinic has configured and reviewed the EAS `production` environment and Android signing credentials, the owner may build and submit manually:

```sh
cd mobile
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production --latest
```

These EAS commands were intentionally not run for this readiness task. Complete the Play Console declarations, store listing, privacy and deletion URLs, screenshots, content rating, data-safety answers, and review submission manually.
