#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'luccnwicirfnmyzgemzj';
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
assert.ok(url && new URL(url).hostname.split('.')[0] === DEV_REF, 'Refusing to run outside dev');
assert.ok(anonKey && serviceKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [];
const appointments = [];
const say = (message) => console.log(`PASS ${message}`);

async function account(role, name) {
  const email = `mcare-e2e-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  users.push(data.user.id);
  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', data.user.id);
    if (roleError) throw roleError;
  }
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return { id: data.user.id, client };
}

function dateKey(date) {
  const fields = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const v = Object.fromEntries(fields.map(({ type, value }) => [type, value]));
  return `${v.year}-${v.month}-${v.day}`;
}

async function openSlot(client, doctorId, duration, excluded) {
  const today = dateKey(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const noon = Date.UTC(year, month - 1, day, 12);
  for (let offset = 1; offset <= 120; offset += 1) {
    const date = new Date(noon + offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    if ([0, 6].includes(date.getUTCDay()) || excluded.has(key)) continue;
    const { data, error } = await client.rpc('get_available_slots', {
      p_doctor_id: doctorId,
      p_target_date: key,
      p_slot_duration_minutes: duration,
      p_timezone: 'Asia/Manila',
    });
    if (error) throw error;
    if (data?.[0]) return { ...data[0], dateKey: key };
  }
  throw new Error('No open weekday appointment slot found in the next 120 days');
}

let failure;
try {
  const [{ data: doctors, error: doctorError }, { data: services, error: serviceError }] = await Promise.all([
    admin.from('doctors').select('id, profile:profiles!inner(full_name)').eq('profile.full_name', 'Dr. Bernice Paule'),
    admin.from('services').select('id, duration_minutes').eq('is_active', true).order('name').limit(1),
  ]);
  if (doctorError) throw doctorError;
  if (serviceError) throw serviceError;
  assert.equal(doctors?.length, 1, 'Expected the dev canonical doctor');
  assert.ok(services?.length, 'Expected an active service on dev');
  const patient = await account('patient', 'M-Care E2E Patient');
  const receptionist = await account('receptionist', 'M-Care E2E Receptionist');
  const { data: patientRow, error: patientError } = await admin.from('patients').select('id').eq('profile_id', patient.id).single();
  if (patientError) throw patientError;

  const firstSlot = await openSlot(patient.client, doctors[0].id, services[0].duration_minutes, new Set());
  const { data: firstId, error: firstBookError } = await patient.client.rpc('book_appointment', {
    p_doctor_id: doctors[0].id, p_service_id: services[0].id, p_start_time: firstSlot.slot_start, p_notes: 'Temporary end-to-end booking check',
  });
  if (firstBookError) throw firstBookError;
  appointments.push(firstId);
  say('patient books a future weekday slot through book_appointment');

  const secondSlot = await openSlot(patient.client, doctors[0].id, services[0].duration_minutes, new Set([firstSlot.dateKey]));
  const { data: secondId, error: secondBookError } = await patient.client.rpc('book_appointment', {
    p_doctor_id: doctors[0].id, p_service_id: services[0].id, p_start_time: secondSlot.slot_start, p_notes: 'Temporary cancellation check',
  });
  if (secondBookError) throw secondBookError;
  appointments.push(secondId);

  const { data: queueRows, error: queueError } = await receptionist.client.from('appointments').select('id, status').eq('id', firstId).eq('status', 'pending');
  if (queueError) throw queueError;
  assert.equal(queueRows?.length, 1, 'New patient booking should appear pending in receptionist queue');
  say('pending mobile booking appears in receptionist approval queue');
  const { data: pendingNotice, error: noticeError } = await patient.client.from('notifications').select('title, appointment_id').eq('appointment_id', firstId).single();
  if (noticeError) throw noticeError;
  assert.equal(pendingNotice.appointment_id, firstId);
  assert.equal(pendingNotice.title, 'Appointment Pending Approval');

  const { error: approveError } = await receptionist.client.rpc('approve_appointment', { p_appointment_id: firstId });
  if (approveError) throw approveError;
  const { data: approved, error: approvedError } = await patient.client.from('appointments').select('status').eq('id', firstId).single();
  if (approvedError) throw approvedError;
  assert.equal(approved.status, 'approved');
  const { data: approvalNotice, error: approvalNoticeError } = await patient.client.from('notifications').select('title, appointment_id').eq('appointment_id', firstId).eq('title', 'Appointment Approved').single();
  if (approvalNoticeError) throw approvalNoticeError;
  assert.equal(approvalNotice.appointment_id, firstId);
  say('staff approval is visible to patient with an appointment notification row');

  const target = await openSlot(patient.client, doctors[0].id, services[0].duration_minutes, new Set([firstSlot.dateKey, secondSlot.dateKey]));
  const { error: takenError } = await receptionist.client.rpc('reschedule_appointment', { p_appointment_id: firstId, p_start_time: secondSlot.slot_start });
  assert.ok(takenError, 'Reschedule to an occupied slot must fail');
  say('reschedule onto the other booking fails');
  const { error: weekendError } = await receptionist.client.rpc('reschedule_appointment', { p_appointment_id: firstId, p_start_time: new Date('2030-01-06T09:00:00+08:00').toISOString() });
  assert.ok(weekendError, 'Weekend reschedule must fail');
  say('weekend reschedule fails');

  const { error: rescheduleError } = await receptionist.client.rpc('reschedule_appointment', { p_appointment_id: firstId, p_start_time: target.slot_start });
  if (rescheduleError) throw rescheduleError;
  const { data: rescheduled, error: rescheduledError } = await patient.client.from('appointments').select('status, start_time').eq('id', firstId).single();
  if (rescheduledError) throw rescheduledError;
  assert.equal(rescheduled.status, 'rescheduled');
  assert.equal(new Date(rescheduled.start_time).toISOString(), new Date(target.slot_start).toISOString());
  const { data: rescheduleNotice, error: rescheduleNoticeError } = await patient.client.from('notifications').select('title').eq('appointment_id', firstId).eq('title', 'Appointment Rescheduled').single();
  if (rescheduleNoticeError) throw rescheduleNoticeError;
  say('valid reschedule and patient notification are visible across clients');

  const reason = 'Temporary end-to-end cancellation check';
  const { error: cancelError } = await receptionist.client.rpc('cancel_appointment', { p_appointment_id: secondId, p_reason: reason });
  if (cancelError) throw cancelError;
  const { data: cancelled, error: cancelledError } = await patient.client.from('appointments').select('status, cancellation_reason').eq('id', secondId).single();
  if (cancelledError) throw cancelledError;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellation_reason, reason);
  const { data: cancelNotice, error: cancelNoticeError } = await patient.client.from('notifications').select('title').eq('appointment_id', secondId).eq('title', 'Appointment Cancelled').single();
  if (cancelNoticeError) throw cancelNoticeError;
  say('staff cancellation reason and patient notification are visible');
} catch (error) {
  failure = error;
} finally {
  if (appointments.length) {
    const { error } = await admin.from('appointments').delete().in('id', appointments);
    if (error && !failure) failure = error;
  }
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !failure) failure = error;
  }
}
if (failure) throw failure;
console.log('Dev admin workflow end-to-end checks passed; all temporary data cleaned up.');
