import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceKey || !authorization) return json({ error: "Sign in is required" }, 401);

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Sign in is required" }, 401);

    const body = await request.json();
    const appointmentId = body?.appointment_id;
    if (typeof appointmentId !== "string") return json({ error: "Appointment ID is required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const [{ data: appointment, error: appointmentError }, { data: profile, error: profileError }] = await Promise.all([
      admin.from("appointments").select("id, patient_id, doctor_id").eq("id", appointmentId).single(),
      admin.from("profiles").select("role").eq("id", user.id).single(),
    ]);
    if (appointmentError || !appointment || profileError || !profile) return json({ error: "Appointment not found" }, 404);

    const { data: patient, error: patientError } = await admin.from("patients").select("profile_id").eq("id", appointment.patient_id).single();
    if (patientError || !patient) return json({ error: "Appointment not found" }, 404);

    let allowed = false;
    if (profile.role === "patient") {
      allowed = patient.profile_id === user.id;
    } else if (profile.role === "admin" || profile.role === "receptionist") {
      allowed = true;
    } else if (profile.role === "doctor") {
      const { data: doctor } = await admin.from("doctors").select("id").eq("id", appointment.doctor_id).eq("profile_id", user.id).maybeSingle();
      allowed = Boolean(doctor);
    }
    if (!allowed) return json({ error: "This role cannot dispatch appointment notifications" }, 403);

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id, user_id, title, body")
      .eq("appointment_id", appointmentId)
      .eq("user_id", patient.profile_id)
      .is("push_sent_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification) return json({ success: true, pushed: false, reason: "No pending notification" });

    const { data: token, error: tokenError } = await admin
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", patient.profile_id)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!token?.expo_push_token) return json({ success: true, pushed: false, reason: "No registered device" });

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Accept-encoding": "gzip, deflate", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token.expo_push_token,
        sound: "default",
        title: notification.title,
        body: notification.body,
        priority: "high",
        data: { notificationId: notification.id },
      }),
    });
    const pushResult = await pushResponse.json();
    const ticket = pushResult?.data;
    if (!pushResponse.ok || ticket?.status !== "ok") {
      console.error("Expo push rejected an appointment notification", pushResult?.errors ?? ticket?.message ?? "Unknown push error");
      return json({ success: false, pushed: false, reason: "Push service rejected the notification" }, 502);
    }

    const { error: markError } = await admin.from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", notification.id)
      .is("push_sent_at", null);
    if (markError) throw markError;
    return json({ success: true, pushed: true });
  } catch (error) {
    console.error("Appointment push dispatch failed", error);
    return json({ error: "The appointment notification could not be sent" }, 500);
  }
});
