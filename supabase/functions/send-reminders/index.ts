// Supabase Edge Function: Send Appointment Reminders via Expo Push Notification API
// Triggered on schedule (e.g. every 15 minutes) or via webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpoPushMessage {
  to: string;
  sound?: "default" | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "normal" | "high";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Run database function to generate 24h & 2h notification records
    const { data: generatedCount, error: rpcError } = await supabase.rpc(
      "dispatch_appointment_reminders"
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
    }

    // 2. Query recent unpushed notifications (created in last 30 minutes)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select(`
        id,
        user_id,
        title,
        body,
        created_at
      `)
      .gte("created_at", thirtyMinsAgo)
      .order("created_at", { ascending: false });

    if (notifError || !notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending reminders to dispatch.",
          generated: generatedCount || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. For each notification, look up user's Expo push token
    const pushMessages: ExpoPushMessage[] = [];

    for (const notif of notifications) {
      const { data: tokenData } = await supabase
        .from("push_tokens")
        .select("expo_push_token")
        .eq("user_id", notif.user_id)
        .maybeSingle();

      if (tokenData?.expo_push_token) {
        pushMessages.push({
          to: tokenData.expo_push_token,
          sound: "default",
          title: notif.title,
          body: notif.body,
          priority: "high",
          data: { notificationId: notif.id },
        });
      }
    }

    // 4. Send messages in batch to Expo Push Notification Service
    let sentCount = 0;
    if (pushMessages.length > 0) {
      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushMessages),
      });

      const expoData = await expoRes.json();
      sentCount = pushMessages.length;
      console.log("Expo Push Dispatch Response:", expoData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        generatedReminders: generatedCount || 0,
        pushNotificationsSent: sentCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

