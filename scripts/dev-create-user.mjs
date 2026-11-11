#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const allowedRoles = new Set(["patient", "admin", "doctor", "nurse", "receptionist"]);
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) throw new Error(`Expected --name=value argument, got ${arg}`);
    return [match[1], match[2]];
  }),
);

const email = args.email?.trim().toLowerCase();
const role = args.role?.trim().toLowerCase();
const fullName = args["full-name"]?.trim();
if (!email || !fullName || !role || !allowedRoles.has(role)) {
  console.error("Usage: node scripts/dev-create-user.mjs --email=... --full-name=... --role=patient|admin|doctor|nurse|receptionist");
  process.exit(2);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SERVICE_ROLE_KEY must be set in the environment.");
  process.exit(2);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = `${randomBytes(30).toString("base64url")}aA1!`;
const metadata = { full_name: fullName, role: "patient" };

let user;
const { data: listed, error: listError } = await client.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw new Error(`Could not check dev account: ${listError.message}`);
const existing = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);

if (existing) {
  const { data, error } = await client.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { ...existing.user_metadata, ...metadata },
  });
  if (error) throw new Error(`Could not update dev account: ${error.message}`);
  user = data.user;
} else {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw new Error(`Could not create dev account: ${error.message}`);
  user = data.user;
}

const { error: profileError } = await client
  .from("profiles")
  .update({ role, full_name: fullName })
  .eq("id", user.id);
if (profileError) {
  throw new Error(`Account exists, but its profile role could not be set: ${profileError.message}`);
}

console.log(`Email: ${email}`);
console.log(`Role: ${role}`);
console.log(`Generated password: ${password}`);
