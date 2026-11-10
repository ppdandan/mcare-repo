import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const response = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
});

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response({ error: "Account deletion is not configured" }, 503);
  }
  if (!authorization) return response({ error: "Authentication is required" }, 401);

  try {
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return response({ error: "Authentication is required" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authRecord, error: recordError } = await admin.auth.admin.getUserById(user.id);
    if (recordError || !authRecord.user) return response({ error: "Could not verify the account" }, 401);

    let body: { password?: unknown } = {};
    try { body = await request.json(); } catch { /* password is optional for a recent sign-in */ }
    const lastSignIn = authRecord.user.last_sign_in_at ? Date.parse(authRecord.user.last_sign_in_at) : 0;
    const recentSignIn = Number.isFinite(lastSignIn) && Date.now() - lastSignIn <= 10 * 60 * 1000;
    if (!recentSignIn) {
      if (typeof body.password !== "string" || !user.email) {
        return response({ error: "Please sign in again or provide your password to confirm deletion" }, 401);
      }
      const reauth = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await reauth.auth.signInWithPassword({ email: user.email, password: body.password });
      if (error || data.user?.id !== user.id) return response({ error: "Password confirmation failed" }, 401);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("id, role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "patient") {
      return response({ error: "Only patient accounts can be deleted here" }, 403);
    }
    const { data: patient, error: patientError } = await admin
      .from("patients").select("id").eq("profile_id", profile.id).maybeSingle();
    if (patientError || !patient) return response({ error: "Patient account record was not found" }, 404);

    const deletedAt = new Date().toISOString();
    const { error: appointmentError } = await admin.from("appointments")
      .update({ status: "cancelled" }).eq("patient_id", patient.id)
      .gt("start_time", deletedAt).neq("status", "cancelled");
    if (appointmentError) throw appointmentError;

    const { error: notesError } = await admin.from("appointments")
      .update({ notes: null }).eq("patient_id", patient.id);
    if (notesError) throw notesError;

    const { error: patientUpdateError } = await admin.from("patients").update({
      deleted_at: deletedAt,
      emergency_contact_name: null,
      emergency_contact_phone: null,
    }).eq("id", patient.id);
    if (patientUpdateError) throw patientUpdateError;

    const { error: profileUpdateError } = await admin.from("profiles").update({
      full_name: "Deleted patient",
      phone: null,
      address: null,
      date_of_birth: null,
    }).eq("id", profile.id);
    if (profileUpdateError) throw profileUpdateError;

    const { error: tokenError } = await admin.from("push_tokens").delete().eq("user_id", user.id);
    if (tokenError) throw tokenError;
    const { error: notificationError } = await admin.from("notifications").delete().eq("user_id", user.id);
    if (notificationError) throw notificationError;
    const { error: inquiryError } = await admin.from("inquiries").delete().eq("patient_id", patient.id);
    if (inquiryError) throw inquiryError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return response({ deleted: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return response({ error: "Account deletion could not be completed. Contact the clinic for help." }, 500);
  }
});
