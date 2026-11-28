import type { createClient } from "./supabase/client";

export function registeredPatients(client: ReturnType<typeof createClient>, { head = false } = {}) {
  return client.from("patients")
    .select("profile:profiles!inner(created_at)", { count: "exact", head })
    .is("deleted_at", null)
    .eq("profile.role", "patient")
    .not("profile.auth_user_id", "is", null);
}
