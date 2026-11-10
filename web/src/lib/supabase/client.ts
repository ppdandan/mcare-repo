import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in Client Components (browser).
 * This client runs in the browser and is used for real-time subscriptions,
 * client-side queries, and auth state management.
 *
 * Environment variables are read at build time by Next.js and
 * injected into the client bundle (NEXT_PUBLIC_ prefix).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
