#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'luccnwicirfnmyzgemzj';
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
assert.ok(url && new URL(url).hostname.split('.')[0] === DEV_REF, 'Refusing to run outside the dev Supabase project');
assert.ok(anonKey && serviceRoleKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUserIds = [];
const createdAppointmentIds = [];
const report = (message) => console.log(`PASS ${message}`);

function nextManilaDateForDay(targetDay) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const base = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
  const offset = (targetDay - base.getUTCDay() + 7) % 7 || 7;
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

let failure;
try {
  const [{ data: doctors, error: doctorError }, { data: services, error: serviceError }] = await Promise.all([
    admin.from('doctors').select('id, profile:profiles!inner(full_name)').eq('profile.full_name', 'Dr. Bernice Paule'),
    admin.from('services').select('id, duration_minutes').eq('is_active', true).order('name').limit(1),
  ]);
  if (doctorError) throw doctorError;
  if (serviceError) throw serviceError;
  assert.equal(doctors?.length, 1, 'Expected exactly one canonical doctor on dev');
  assert.ok(services?.length, 'An active service is required for weekend booking checks');

  const email = `mcare-weekend-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: 'M-Care Weekend Test' },
  });
  if (userError) throw userError;
  const userId = userData.user.id;
  createdUserIds.push(userId);

  const { data: patient, error: patientError } = await admin.from('patients').select('id').eq('profile_id', userId).single();
  if (patientError) throw patientError;
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  for (const { name, day } of [{ name: 'Saturday', day: 6 }, { name: 'Sunday', day: 0 }]) {
    const date = nextManilaDateForDay(day);
    const start = new Date(`${date}T10:00:00+08:00`);
    const startTime = start.toISOString();
    const endTime = new Date(start.getTime() + services[0].duration_minutes * 60_000).toISOString();

    const { data: bookingId, error: bookingError } = await client.rpc('book_appointment', {
      p_doctor_id: doctors[0].id,
      p_service_id: services[0].id,
      p_start_time: startTime,
    });
    if (bookingId) createdAppointmentIds.push(bookingId);
    assert.ok(bookingError, `${name} RPC booking unexpectedly succeeded`);
    assert.match(bookingError.message, /weekend/i, `${name} RPC failed for an unrelated reason`);
    report(`${name} booking RPC is rejected`);

    const { data: inserted, error: insertError } = await admin.from('appointments').insert({
      patient_id: patient.id,
      doctor_id: doctors[0].id,
      service_id: services[0].id,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
    }).select('id').single();
    if (inserted?.id) createdAppointmentIds.push(inserted.id);
    assert.ok(insertError, `${name} direct database insert unexpectedly succeeded`);
    assert.match(insertError.message, /weekend/i, `${name} direct insert failed for an unrelated reason`);
    report(`${name} direct database insert is rejected`);
  }
} catch (error) {
  failure = error;
} finally {
  const cleanupErrors = [];
  if (createdAppointmentIds.length) {
    const { error } = await admin.from('appointments').delete().in('id', createdAppointmentIds);
    if (error) cleanupErrors.push(error.message);
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(error.message);
  }
  if (cleanupErrors.length) failure ??= new Error(`Temporary fixture cleanup failed: ${cleanupErrors.join('; ')}`);
  else if (createdUserIds.length) report('temporary weekend-test account and appointments cleaned up');
}

if (failure) {
  console.error(`FAIL ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log('All weekend booking protections passed.');
}
