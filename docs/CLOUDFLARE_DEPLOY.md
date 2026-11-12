# Prepare `web/` for Cloudflare Workers

No Cloudflare deployment was performed. The requested `SETUP_APK_AND_CLOUDFLARE.md` guide was not present in the repository, so these instructions are based on the app configuration and Cloudflare's current Workers/OpenNext documentation.

## Why this uses Workers

This Next.js app is not a static export. It has no App Router route handlers, server actions, or dynamic path segments, and it does not use `generateStaticParams`. However, `web/src/middleware.ts` runs on requests to refresh Supabase sessions and enforce role-based redirects for `/dashboard`, `/book`, `/appointments`, `/transactions`, and `/profile`. Static hosting cannot run that middleware. The `cookies()` call in `web/src/lib/supabase/server.ts` is in an unused helper; the request middleware is the active server requirement.

`/privacy` and `/delete-account` are ordinary pages and are not in the middleware's protected-route checks. They do not require a logged-in session. Middleware currently checks Supabase session state for these requests but does not redirect unauthenticated visitors away from either page.

## Cloudflare configuration in this repository

- Worker name: `m-care-web`
- Wrangler config: `web/wrangler.jsonc`
- OpenNext adapter config: `web/open-next.config.ts`
- Build command: `npm --workspace=web run cf:build`
- Local Workers preview: `npm --workspace=web run cf:preview`
- Deploy script (for a later owner-run deployment): `npm --workspace=web run cf:deploy`
- Repository root is the build root because the npm workspaces and `package-lock.json` are at the repository root. Do not set the Cloudflare root directory to `web/`.

The config uses the `nodejs_compat` flag and serves `.open-next/assets` through the `ASSETS` binding. Cloudflare currently recommends vinext for new Next.js projects, but this setup uses OpenNext as requested. Revisit that recommendation before a future framework migration.

## Production environment variables

Set both names in the Cloudflare dashboard. Use them as **Workers Builds build variables** so Next.js can include the public Supabase configuration while building. Also set them under the Worker's **Settings > Variables and Secrets** so the middleware can read them at runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use the production project's URL and anon/public key only after the owner verifies the project. The anon key is exposed to website visitors by design; Supabase row-level security must protect the data. Never set or expose a service-role key. Do not put production values in `wrangler.jsonc`, source files, or committed env files. Add preview-specific values under Cloudflare's Preview settings if preview deployments are enabled.

## Owner setup steps

1. In Cloudflare, open **Workers & Pages**, create an application, and connect this Git repository as a Worker. Select branch `ui-polish` for an initial preview; choose the intended release branch before enabling production releases.
2. Keep the repository root as the build root. Set the build command to `npm ci && npm --workspace=web run cf:build`.
3. Set the deploy command to `npm --workspace=web exec -- opennextjs-cloudflare deploy --config=wrangler.jsonc`. Leave the default preview command unless a separate preview policy is needed. These dashboard commands can deploy; do not run them until the owner is ready to publish.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as build variables and as runtime Worker variables, as described above. Use only the verified production project values. Keep production values out of Git.
5. Check the Cloudflare build output and Worker logs. Confirm `/privacy` and `/delete-account` open in a private browser session without signing in. Confirm login, patient booking, and staff dashboard behavior on a preview before promoting it.
6. After Cloudflare assigns the production hostname, add that hostname to the Supabase Auth site URL and redirect URL allowlist. Configure the clinic's domain in Cloudflare only after the owner selects it.

## Local checks and limits

From the repository root:

```sh
npm --workspace=web run cf:build
npm --workspace=web exec -- wrangler deploy --config=wrangler.jsonc --dry-run --outdir=.wrangler-dry-run
```

The second command only bundles and reports the Worker; it does not deploy. Record both `Total Upload` and `gzip` from Wrangler. Do not mistake the gzip number for the enforced limit: Cloudflare removed the old 3 MiB compressed Worker limit in September 2026. Current documentation sets a 64 MiB **uncompressed** Worker limit on Free and Paid plans. The gzip size is still useful for comparison and startup considerations.

Verified locally on 2026-11-11 UTC: `npm --workspace=web run cf:build` succeeded and generated all 22 Next.js static pages plus the middleware Worker. `npx tsc --noEmit -p web/tsconfig.json` passed. Wrangler's dry run reported `Total Upload: 6701.45 KiB / gzip: 1359.07 KiB`. This is below the previous 3 MiB gzip threshold and well below today's 64 MiB uncompressed limit. The local OpenNext preview returned HTTP 200 for both `/privacy` and `/delete-account` without a login session. No deployment occurred.

The local production build uses the current local environment, which must point to the dev Supabase project for this task. Do not copy production values into a local env file. Cloudflare dashboard build/runtime settings are the source for production values.

Official references: [OpenNext on Cloudflare](https://opennext.js.org/cloudflare/get-started), [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
