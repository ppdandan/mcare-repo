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

For completeness, the full post-00013 migration set is: `00014_weekday_appointments.sql`, `00015_single_ob_doctor.sql`, `00016_bernice_weekday_schedule.sql`, `00017_initial_booking_services.sql`, `00018_production_access_hardening.sql`, `00019_server_validated_booking_and_audit.sql`, `00020_idempotent_reminder_delivery.sql`, and the five files listed above (`00021_repair_canonical_doctor_identity.sql`, `00022_privacy_deletion_retention.sql`, `00023_ensure_canonical_ob_doctor.sql`, `00024_reject_weekend_appointments.sql`, `00025_transaction_history.sql`). Compare the full set with the production migration list and dry run before pushing; do not push migrations that are already applied or outside the approved release.

If the dry run includes any unexpected migration, stop and resolve the migration history before pushing. If it is correct, push the pending migrations:

```sh
npx supabase db push --linked
npx supabase migration list --linked
```

Confirm the five migrations above are recorded as applied before continuing.

## 2. Deploy Edge Functions

The repository contains these Edge Functions: `create-staff`, `delete-account`, and `send-reminders`. Deploy only the functions approved for this release, after their required database migrations succeed. The account-deletion change requires `delete-account`:

```sh
npx supabase functions deploy delete-account --project-ref pojgizdueifvhgpbvqay
```

Verify the function in the Supabase dashboard and run the clinic's approved production smoke test with a dedicated test account. Do not use a real patient's account for deletion testing.

`create-staff` and `send-reminders` are also present in the repository. Before deploying either, confirm whether it is already deployed and approved for this release, then use `npx supabase functions deploy create-staff --project-ref pojgizdueifvhgpbvqay` or `npx supabase functions deploy send-reminders --project-ref pojgizdueifvhgpbvqay` respectively. Do not deploy them solely because they are listed here.

## 3. Publish the website and Android app

The repository does not define a website production host or deployment command. Confirm the clinic's hosting provider and production environment before publishing the website. Ensure its Supabase URL and anon key belong to `pojgizdueifvhgpbvqay`; never put a service-role key in a client environment.

After the clinic has configured and reviewed the EAS `production` environment and Android signing credentials, the owner may build and submit manually:

```sh
cd mobile
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production --latest
```

These EAS commands were intentionally not run for this readiness task. Complete the Play Console declarations, store listing, privacy and deletion URLs, screenshots, content rating, data-safety answers, and review submission manually.
