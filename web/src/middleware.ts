import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js Middleware — runs on every matched request.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth session (keep tokens fresh)
 * 2. Protect /dashboard routes (redirect to /login if not authenticated)
 * 3. Redirect /login to /dashboard if already authenticated
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Matcher config — only run middleware on these paths.
 * We exclude static files, images, and favicon to avoid unnecessary processing.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
