# Local integration tests

Use a disposable local Docker stack. Run these commands in Bash from the repository root with Docker Engine running and Supabase CLI 3.4.0 on PATH. The project disables the clinic seed file. The CLI applies the numbered SQL migrations during first startup.

```bash
docker info >/dev/null
supabase start >/dev/null
```

To rebuild the disposable local database from scratch, run the following command. This erases its local data.

```bash
supabase db reset --no-seed
```

Load the running stack's URL and keys into this shell. Keep shell tracing off. Use the same shell to launch the web dashboard and the suites.

```bash
set +x
unset API_URL ANON_KEY SERVICE_ROLE_KEY
eval "$(supabase status -o env)"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export MCARE_LOCAL_WEB_ORIGIN=http://127.0.0.1:3020
node --input-type=module -e "import {localOrigin} from './supabase/tests/local-origin.mjs'; localOrigin(process.env.SUPABASE_URL)"
npm --workspace=web run dev -- --hostname 127.0.0.1 --port 3020 &
web_pid=$!
until curl -fsS "$MCARE_LOCAL_WEB_ORIGIN/login" >/dev/null; do kill -0 "$web_pid" || break; sleep 1; done
node --test --test-concurrency=1 supabase/tests/*.test.mjs
kill "$web_pid"
supabase stop
```

For subsequent pending migrations on this local stack, run `supabase migration up`. The suites use local Auth, PostgREST and Edge Functions. The route suite also needs the web server. Previously each suite compared the first hostname segment with a hosted development project ID. Both the API and web origins now accept loopback HTTP only.
