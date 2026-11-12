import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

/**
 * Route access map:
 * - Admin only: /dashboard/staff, /dashboard/analytics
 * - Clinical staff (Doctor, Nurse, Admin): /dashboard/records (DPA 2012 compliance)
 * - Financial / Clinical supervisors (Doctor, Admin): /dashboard/transactions
 * - All staff (Doctor, Nurse, Receptionist, Admin): /dashboard, /dashboard/appointments,
 *   /dashboard/schedules, /dashboard/patients, /dashboard/inquiries, /dashboard/reports
 */
const RESTRICTED_ROUTES: Record<string, string[]> = {
  "/dashboard/staff": ["admin"],
  "/dashboard/analytics": ["admin"],
  "/dashboard/transactions": ["doctor", "admin"],
  "/dashboard/records": ["doctor", "nurse", "admin"],
};

/**
 * Next.js Middleware — runs on every matched request.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth session (keep tokens fresh)
 * 2. Protect /dashboard routes (redirect to /login if not authenticated)
 * 3. Redirect /login to /dashboard if already authenticated
 * 4. Enforce server-side role check per dashboard route group
 */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // If updateSession already issued a redirect (e.g. anonymous -> /login, patient -> /book),
  // preserve it immediately.
  if (response.headers.get("location")) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  for (const [routePrefix, allowedRoles] of Object.entries(RESTRICTED_ROUTES)) {
    if (pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)) {
      // Look up current profile role using session cookies
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // Session refresh and cookie writing handled in updateSession
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role && !allowedRoles.includes(profile.role)) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/dashboard";
          return NextResponse.redirect(redirectUrl);
        }
      }
      break;
    }
  }

  return response;
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
