import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const allowedOrigin = Deno.env.get("WEB_APP_ORIGIN") ?? "";
const headersFor = (origin: string | null) => ({
  ...(origin && allowedOrigin && origin === allowedOrigin
    ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" }
    : {}),
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

serve(async (request) => {
  const headers = headersFor(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization) {
    return Response.json({ error: "Staff provisioning is not configured" }, { status: 503, headers });
  }

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: "Authentication is required" }, { status: 401, headers });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || callerProfile?.role !== "admin") {
      return Response.json({ error: "Administrator access is required" }, { status: 403, headers });
    }

    const body = await request.json();
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const role = body.role;
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !["admin", "nurse", "receptionist"].includes(role)) {
      return Response.json({ error: "Enter a valid name, email, and staff role" }, { status: 400, headers });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, phone: phone || null, role: "patient" },
    });
    if (inviteError || !invited.user) {
      return Response.json({ error: inviteError?.message ?? "Could not invite this staff member" }, { status: 400, headers });
    }

    const { error: roleError } = await adminClient.from("profiles")
      .update({ role, full_name: fullName, phone: phone || null })
      .eq("id", invited.user.id);
    if (roleError) {
      await adminClient.auth.admin.deleteUser(invited.user.id);
      return Response.json({ error: "The invitation could not be assigned a staff role" }, { status: 500, headers });
    }

    return Response.json({ user_id: invited.user.id, email, role, invite_sent: true }, { status: 201, headers });
  } catch (error) {
    console.error("Staff invite failed", error);
    return Response.json({ error: "Staff invitation failed. Try again or contact the administrator." }, { status: 500, headers });
  }
});
