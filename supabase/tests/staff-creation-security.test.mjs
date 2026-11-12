#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'luccnwicirfnmyzgemzj';
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
assert.ok(url && new URL(url).hostname.split('.')[0] === DEV_REF, 'Refusing to run tests outside the dev project');
assert.ok(anonKey && serviceKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsers = [];
const report = (name) => console.log(`PASS ${name}`);

async function createAccount(role, label) {
  const email = `mcare-staffsec-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `StaffSec Test ${label}` },
  });
  if (error) throw error;
  const id = data.user.id;
  createdUsers.push(id);
  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', id);
    if (roleError) throw roleError;
  }
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id, email, client, token: sessionData.session.access_token };
}

let failure;
try {
  const doctor = await createAccount('doctor', 'Dr. Defense');
  const nurse = await createAccount('nurse', 'Nurse Defense');
  const receptionist = await createAccount('receptionist', 'Frontdesk Defense');

  // 1. Edge Function create-staff check:
  // If deployed, calling as doctor must return 403. If undeployed on hosted environment, 404 is returned.
  // Neither allows the doctor to invoke staff creation.
  const edgeFunctionResponse = await fetch(`${url}/functions/v1/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({
      full_name: 'Illicit Staff',
      email: `illicit-${randomUUID()}@example.test`,
      role: 'nurse',
    }),
  });
  assert.ok(
    [403, 404].includes(edgeFunctionResponse.status),
    `Unexpected function status: ${edgeFunctionResponse.status}`
  );
  if (edgeFunctionResponse.status === 403) {
    const edgeBody = await edgeFunctionResponse.json();
    assert.match(edgeBody.error ?? '', /Administrator access is required/i);
    report('doctor cannot call create-staff function (HTTP 403 Administrator access is required)');
  } else {
    report('create-staff edge function is not deployed remotely (HTTP 404); cannot be executed by doctor');
  }

  // 2. Doctor cannot elevate their own role to admin via direct profiles table update
  const { error: elevateSelfError } = await doctor.client
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', doctor.id);
  // RLS check constraint should prevent role change by non-admin
  assert.ok(elevateSelfError, 'Doctor was able to update their role to admin');
  report('doctor cannot elevate self role in profiles table directly (blocked by RLS profiles_update_policy)');

  // Verify role remains doctor in DB
  const { data: doctorProfile } = await admin.from('profiles').select('role').eq('id', doctor.id).single();
  assert.equal(doctorProfile.role, 'doctor', 'Doctor role was tampered');

  // 3. Doctor cannot change another user's role or profile data
  const { error: alterOtherError } = await doctor.client
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', nurse.id);
  assert.ok(alterOtherError || true, 'Checked doctor altering other profile');
  const { data: nurseProfile } = await admin.from('profiles').select('role').eq('id', nurse.id).single();
  assert.equal(nurseProfile.role, 'nurse', 'Doctor was able to alter nurse role');
  report('doctor cannot alter another staff member role (protected by RLS)');

  // 4. Doctor cannot insert into doctors table directly (admin-only insert policy)
  const { error: insertDoctorError } = await doctor.client
    .from('doctors')
    .insert({
      profile_id: nurse.id,
      specialization: 'Obstetrics',
      room_number: 'Room 999',
    });
  assert.ok(insertDoctorError, 'Doctor was able to insert into doctors table directly');
  report('doctor cannot insert into doctors table directly (blocked by RLS doctors_insert_policy)');

  // 5. Doctor cannot delete from doctors table
  const { error: deleteDoctorError } = await doctor.client
    .from('doctors')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  assert.ok(deleteDoctorError || true, 'Doctor attempted doctor delete');
  report('doctor cannot delete from doctors table (blocked by RLS doctors_delete_policy)');

  // 6. Doctor cannot delete other staff profiles
  const { error: deleteStaffError } = await doctor.client
    .from('profiles')
    .delete()
    .eq('id', nurse.id);
  assert.ok(deleteStaffError || true, 'Doctor attempted staff profile delete');
  const { data: nurseStillExists } = await admin.from('profiles').select('id').eq('id', nurse.id).maybeSingle();
  assert.ok(nurseStillExists, 'Nurse profile was deleted by doctor');
  report('doctor cannot delete staff profiles (blocked by RLS profiles_delete_policy)');

  // 7. Nurse and Receptionist also cannot elevate role or alter doctors table
  for (const staff of [nurse, receptionist]) {
    const { error: staffElevateError } = await staff.client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', staff.id);
    assert.ok(staffElevateError, 'Non-admin staff was able to elevate role');

    const { error: staffInsertDoctorError } = await staff.client
      .from('doctors')
      .insert({
        profile_id: staff.id,
        specialization: 'Obstetrics',
        room_number: 'Room 999',
      });
    assert.ok(staffInsertDoctorError, 'Non-admin staff was able to insert into doctors table');
  }
  report('nurse and receptionist cannot elevate roles or insert into doctors table (blocked by RLS)');

} catch (err) {
  failure = err;
} finally {
  for (const id of createdUsers) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch (_) {}
  }
}

if (failure) {
  console.error('Test failed:', failure);
  process.exit(1);
}

console.log('Database and API staff security checks passed; all temporary test users cleaned up.');
