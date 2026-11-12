#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'luccnwicirfnmyzgemzj';
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
assert.ok(url && new URL(url).hostname.split('.')[0] === DEV_REF, 'Refusing to run outside the dev Supabase project');
assert.ok(anonKey && serviceKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const userIds = [];
const appointmentIds = [];
const doctorIds = [];
const transactionIds = [];
const auditRecordIds = [];
const say = (message) => console.log(`PASS ${message}`);

async function makeAccount(label, role = 'patient') {
  const email = `mcare-sync-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `M-Care Sync ${label}` } });
  if (error) throw error;
  userIds.push(data.user.id);
  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', data.user.id);
    if (roleError) throw roleError;
  }
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, password, client };
}

function dateKeyInManila(date) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function findOpenSlot(client, doctorId, duration, excluded = new Set()) {
  const today = dateKeyInManila(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12));
  for (let offset = 1; offset <= 120; offset += 1) {
    const date = new Date(base.getTime() + offset * 86400000);
    const dateKey = date.toISOString().slice(0, 10);
    if ([0, 6].includes(date.getUTCDay()) || excluded.has(dateKey)) continue;
    const { data, error } = await client.rpc('get_available_slots', {
      p_doctor_id: doctorId, p_target_date: dateKey,
      p_slot_duration_minutes: duration, p_timezone: 'Asia/Manila',
    });
    if (error) throw error;
    const slot = data?.[0];
    if (slot) return { ...slot, dateKey };
  }
  throw new Error('No open weekday slot found in the next 120 days');
}

async function readAppointments(client, patientId) {
  const { data, error } = await client.from('appointments').select('id, doctor_id, service_id, start_time, end_time, status').eq('patient_id', patientId);
  if (error) throw error;
  return data ?? [];
}

async function book(client, doctorId, serviceId, slot) {
  const { data, error } = await client.rpc('book_appointment', {
    p_doctor_id: doctorId, p_service_id: serviceId, p_start_time: slot.slot_start, p_notes: 'Temporary cross-platform sync verification',
  });
  if (error) throw error;
  appointmentIds.push(data);
  return data;
}

async function main() {
  const [{ data: doctors, error: doctorError }, { data: services, error: serviceError }] = await Promise.all([
    admin.from('doctors').select('id, profile:profiles!inner(full_name)').eq('profile.full_name', 'Dr. Bernice Paule'),
    admin.from('services').select('id, duration_minutes').eq('is_active', true).order('name').limit(1),
  ]);
  if (doctorError) throw doctorError;
  if (serviceError) throw serviceError;
  assert.equal(doctors?.length, 1, 'Dev must contain only the canonical OB doctor');
  assert.ok(services?.length, 'Dev must contain an active service');
  const serviceId = services[0].id;
  const duration = services[0].duration_minutes;

  const patient = await makeAccount('patient');
  const adminAccount = await makeAccount('temporary clinic admin', 'admin');
  const doctorAccount = await makeAccount('temporary appointment doctor', 'doctor');
  const { data: testDoctor, error: testDoctorError } = await admin.from('doctors').insert({
    profile_id: doctorAccount.id, specialty: 'Temporary sync-test doctor', room: 'Temporary test room',
  }).select('id').single();
  if (testDoctorError) throw testDoctorError;
  const doctorId = testDoctor.id;
  doctorIds.push(doctorId);
  for (const weekday of [1, 2, 3, 4, 5]) {
    const { error } = await admin.from('doctor_schedules').insert({ doctor_id: doctorId, weekday, start_time: '09:00', end_time: '17:00' });
    if (error) throw error;
  }
  const { data: patientRow, error: patientError } = await admin.from('patients').select('id').eq('profile_id', patient.id).single();
  if (patientError) throw patientError;
  const mobile = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const website = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const client of [mobile, website]) {
    const { error: loginError } = await client.auth.signInWithPassword({ email: patient.email, password: patient.password });
    if (loginError) throw loginError;
  }

  // Keep the test account password available only in memory after creation.
  // makeAccount returns the credential solely to authenticate separate app sessions.
  const { data: profileMobile, error: profileMobileError } = await mobile.from('profiles').select('id, full_name, phone, address').eq('id', patient.id).single();
  const { data: profileWeb, error: profileWebError } = await website.from('profiles').select('id, full_name, phone, address').eq('id', patient.id).single();
  if (profileMobileError) throw profileMobileError;
  if (profileWebError) throw profileWebError;
  assert.deepEqual(profileMobile, profileWeb);
  const updatedPhone = `09${String(Date.now()).slice(-9)}`;
  const { error: profileUpdateError } = await mobile.from('profiles').update({ phone: updatedPhone }).eq('id', patient.id);
  if (profileUpdateError) throw profileUpdateError;
  const { data: profileAfter, error: profileAfterError } = await website.from('profiles').select('phone').eq('id', patient.id).single();
  if (profileAfterError) throw profileAfterError;
  assert.equal(profileAfter.phone, updatedPhone);
  say('mobile and website sessions read and share the same profile row');

  const initialSlot = await findOpenSlot(mobile, doctorId, duration);
  const mobileBookingId = await book(mobile, doctorId, serviceId, initialSlot);
  let webRows = await readAppointments(website, patientRow.id);
  let webBooking = webRows.find((item) => item.id === mobileBookingId);
  assert.ok(webBooking, 'Mobile-flow booking did not appear in website query');
  assert.equal(webBooking.status, 'pending');
  assert.equal(webBooking.doctor_id, doctorId);
  assert.equal(webBooking.start_time, initialSlot.slot_start);
  const manilaDisplay = (iso) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  assert.equal(manilaDisplay(webBooking.start_time), manilaDisplay(initialSlot.slot_start));
  say(`mobile booking appears on website with matching date, time, status, and Manila display (${manilaDisplay(webBooking.start_time)})`);

  const movedSlot = await findOpenSlot(mobile, doctorId, duration, new Set([initialSlot.dateKey]));
  const { error: rescheduleError } = await adminAccount.client.rpc('reschedule_appointment', { p_appointment_id: mobileBookingId, p_start_time: movedSlot.slot_start });
  if (rescheduleError) throw rescheduleError;
  const mobileRowsAfterReschedule = await readAppointments(mobile, patientRow.id);
  const mobileRescheduled = mobileRowsAfterReschedule.find((item) => item.id === mobileBookingId);
  webRows = await readAppointments(website, patientRow.id);
  webBooking = webRows.find((item) => item.id === mobileBookingId);
  assert.equal(webBooking?.start_time, movedSlot.slot_start);
  assert.equal(webBooking?.status, 'rescheduled');
  assert.deepEqual(
    { start_time: mobileRescheduled?.start_time, status: mobileRescheduled?.status },
    { start_time: webBooking?.start_time, status: webBooking?.status },
  );
  assert.equal(manilaDisplay(mobileRescheduled.start_time), manilaDisplay(webBooking.start_time));
  say('admin reschedule is visible with the same Manila date and status after both clients refresh');

  const reverseSlot = await findOpenSlot(website, doctorId, duration, new Set([initialSlot.dateKey, movedSlot.dateKey]));
  const websiteBookingId = await book(website, doctorId, serviceId, reverseSlot);
  const mobileRowsAfterReverseBooking = await readAppointments(mobile, patientRow.id);
  const mobileReverse = mobileRowsAfterReverseBooking.find((item) => item.id === websiteBookingId);
  assert.ok(mobileReverse, 'Website-flow booking did not appear in mobile query');
  assert.equal(mobileReverse.status, 'pending');
  assert.equal(mobileReverse.doctor_id, doctorId);
  assert.equal(mobileReverse.start_time, reverseSlot.slot_start);
  say(`website booking appears on mobile with matching date, time, status, and Manila display (${manilaDisplay(mobileReverse.start_time)})`);

  const { error: cancelError } = await mobile.rpc('cancel_my_appointment', { p_appointment_id: websiteBookingId });
  if (cancelError) throw cancelError;
  const websiteRowsAfterCancel = await readAppointments(website, patientRow.id);
  const webCancelled = websiteRowsAfterCancel.find((item) => item.id === websiteBookingId);
  assert.equal(webCancelled?.status, 'cancelled');
  assert.equal((await readAppointments(mobile, patientRow.id)).find((item) => item.id === websiteBookingId)?.status, 'cancelled');
  say('mobile cancellation is visible on website after refresh');

  const { error: completedError } = await doctorAccount.client.rpc('complete_appointment', { p_appointment_id: mobileBookingId });
  if (completedError) throw completedError;
  const { data: transactionId, error: transactionError } = await adminAccount.client.rpc('record_appointment_transaction', {
    p_appointment_id: mobileBookingId, p_amount: 125.5, p_payment_method: 'Cash', p_currency: 'PHP', p_notes: 'Temporary sync test record',
  });
  if (transactionError) throw transactionError;
  transactionIds.push(transactionId);
  const [mobileTx, websiteTx] = await Promise.all([mobile, website].map(async (client) => {
    const { data, error } = await client.from('transactions').select('id, user_id, appointment_id, amount, currency, payment_method, created_at').eq('user_id', patient.id).eq('id', transactionId).single();
    if (error) throw error;
    return data;
  }));
  assert.deepEqual(mobileTx, websiteTx);
  assert.equal(Number(mobileTx.amount), 125.5);
  assert.equal(mobileTx.currency, 'PHP');
  assert.equal(mobileTx.appointment_id, mobileBookingId);
  say('mobile and website transaction history reads return the same post-service record');
}

let failure;
try {
  await main();
} catch (error) {
  failure = error;
} finally {
  const errors = [];
  if (transactionIds.length) {
    const { error } = await admin.from('audit_logs').delete().eq('table_name', 'transactions').in('record_id', transactionIds);
    if (error) errors.push(error.message);
    const { error: deleteError } = await admin.from('transactions').delete().in('id', transactionIds);
    if (deleteError) errors.push(deleteError.message);
  }
  if (appointmentIds.length) {
    const { error } = await admin.from('appointments').delete().in('id', appointmentIds);
    if (error) errors.push(error.message);
  }
  if (doctorIds.length) {
    const { error } = await admin.from('doctors').delete().in('id', doctorIds);
    if (error) errors.push(error.message);
  }
  for (const id of userIds.reverse()) {
    const { error: profileError } = await admin.from('profiles').delete().eq('id', id);
    if (profileError) errors.push(profileError.message);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) errors.push(error.message);
  }
  if (errors.length) failure ??= new Error(`Temporary fixture cleanup failed: ${errors.join('; ')}`);
  else if (userIds.length) say('temporary dev users, appointments, transaction, and audit rows cleaned up');
}

if (failure) {
  console.error(`FAIL ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log('All cross-platform sync checks passed.');
}
