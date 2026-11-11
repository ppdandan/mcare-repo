import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof supabaseResponse.cookies.set>[2] }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isBookingRoute = request.nextUrl.pathname.startsWith("/book");
  const isTransactionRoute = request.nextUrl.pathname.startsWith("/transactions");
  const isAppointmentsRoute = request.nextUrl.pathname.startsWith("/appointments");
  const isProfileRoute = request.nextUrl.pathname.startsWith("/profile");
  const isPatientRoute = isBookingRoute || isTransactionRoute || isAppointmentsRoute || isProfileRoute;

  // Require a session before opening either the staff portal or patient booking.
  if (!user && (isDashboardRoute || isPatientRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Keep patient and staff areas separate while routing each role to its portal.
  if (user && (isDashboardRoute || isPatientRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isDashboardRoute && profile?.role === "patient") {
      const url = request.nextUrl.clone();
      url.pathname = "/book";
      return NextResponse.redirect(url);
    }

    if (isPatientRoute && profile?.role !== "patient") {
      const url = request.nextUrl.clone();
      url.pathname = profile ? "/dashboard" : "/login";
      return NextResponse.redirect(url);
    }
  }

  // Route an authenticated user to the matching portal from the login page.
  if (user && request.nextUrl.pathname === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "patient") {
      const url = request.nextUrl.clone();
      url.pathname = "/book";
      return NextResponse.redirect(url);
    }

    if (profile && profile.role !== "patient") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
