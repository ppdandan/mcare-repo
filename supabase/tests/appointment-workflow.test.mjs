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
const createdAppointments = [];
const createdDoctorIds = [];
const report = (name) => console.log(`PASS ${name}`);

async function createAccount(role, label) {
  const email = `mcare-workflow-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Workflow Test ${label}` },
  });
  if (error) throw error;
  const id = data.user.id;
  createdUsers.push(id);
  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', id);
    if (roleError) throw roleError;
  }
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { data: patient, error: patientError } = await admin.from('patients').select('id').eq('profile_id', id).single();
  if (role === 'patient' && patientError) throw patientError;
  return { id, client, patientId: patient?.id };
}

async function createAppointment({ patientId, doctorId, serviceId, duration, date, hour, minute = 0, status = 'pending' }) {
  const localStart = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`;
  const start = new Date(localStart);
  const end = new Date(start.getTime() + duration * 60_000);
  const { data, error } = await admin.from('appointments').insert({
    patient_id: patientId,
    doctor_id: doctorId,
    service_id: serviceId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status,
    notes: 'Temporary appointment workflow security test',
  }).select('id').single();
  if (error) throw error;
  createdAppointments.push(data.id);
  return data.id;
}

async function rejects(client, fn, args, name) {
  const { error } = await client.rpc(fn, args);
  assert.ok(error, `${fn} should reject ${name}`);
  report(name);
}

async function expectNoDevicePush(client, appointmentId, name) {
  const { data, error } = await client.functions.invoke('dispatch-appointment-notification', {
    body: { appointment_id: appointmentId },
  });
  if (error) throw error;
  assert.equal(data?.success, true);
  assert.equal(data?.pushed, false);
  assert.equal(data?.reason, 'No registered device');
  report(name);
}

function dateAfter(days, weekday = null) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = 1; i <= 60; i += 1) {
    const candidate = new Date(d.getTime() + (days + i - 1) * 86_400_000);
    const localWeekday = candidate.getUTCDay();
    if (weekday === null || localWeekday === weekday) return candidate.toISOString().slice(0, 10);
  }
  throw new Error('Could not find a suitable future day');
}

let testError;
try {
  const [{ data: services, error: serviceError }] = await Promise.all([
    admin.from('services').select('id, duration_minutes').eq('is_active', true).order('name').limit(1),
  ]);
  if (serviceError) throw serviceError;
  assert.ok(services?.length, 'Dev needs an active service');
  const service = services[0];

  const patient = await createAccount('patient', 'Patient');
  const nurse = await createAccount('nurse', 'Nurse');
  const receptionist = await createAccount('receptionist', 'Receptionist');
  const clinicAdmin = await createAccount('admin', 'Admin');
  const doctor = await createAccount('doctor', 'Doctor');
  const { data: doctorRow, error: doctorRowError } = await admin.from('doctors').insert({
    profile_id: doctor.id,
    specialty: 'Workflow test doctor',
    room: 'Temporary test room',
  }).select('id').single();
  if (doctorRowError) throw doctorRowError;
  const testDoctorId = doctorRow.id;
  createdDoctorIds.push(testDoctorId);
  for (const weekday of [1, 2, 3, 4, 5]) {
    const { error } = await admin.from('doctor_schedules').insert({ doctor_id: testDoctorId, weekday, start_time: '09:00', end_time: '17:00' });
    if (error) throw error;
  }

  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const sampleId = '00000000-0000-4000-8000-000000000026';
  const actions = [
    ['approve_appointment', { p_appointment_id: sampleId }],
    ['reschedule_appointment', { p_appointment_id: sampleId, p_start_time: new Date(Date.now() + 86_400_000).toISOString() }],
    ['cancel_appointment', { p_appointment_id: sampleId, p_reason: 'test' }],
    ['decline_appointment', { p_appointment_id: sampleId, p_reason: 'test' }],
    ['complete_appointment', { p_appointment_id: sampleId }],
  ];
  const { error: unauthPushError } = await anon.functions.invoke('dispatch-appointment-notification', { body: { appointment_id: sampleId } });
  assert.ok(unauthPushError, 'Unauthenticated push dispatch should be rejected');
  report('unauthenticated notification dispatch is denied');
  for (const [fn, args] of actions) await rejects(anon, fn, args, `unauthenticated ${fn} denied`);
  for (const [fn, args] of actions) await rejects(patient.client, fn, args, `patient ${fn} denied`);
  for (const [fn, args] of actions) await rejects(nurse.client, fn, args, `nurse ${fn} denied`);
  await rejects(doctor.client, 'approve_appointment', { p_appointment_id: sampleId }, 'doctor cannot approve');
  await rejects(receptionist.client, 'complete_appointment', { p_appointment_id: sampleId }, 'receptionist cannot complete');

  const monday = dateAfter(1, 1);
  const tuesday = dateAfter(1, 2);
  const wednesday = dateAfter(1, 3);
  const thursday = dateAfter(1, 4);
  const saturday = dateAfter(1, 6);
  const friday = dateAfter(1, 5);
  const followingMonday = dateAfter(7, 1);
  const followingTuesday = dateAfter(7, 2);
  const ids = {
    approve: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: monday, hour: 9 }),
    cancelled: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: monday, hour: 10, status: 'cancelled' }),
    reschedule: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: tuesday, hour: 9 }),
    taken: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: wednesday, hour: 10 }),
    cancel: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: friday, hour: 9 }),
    decline: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: followingMonday, hour: 9 }),
    complete: await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: followingTuesday, hour: 9, status: 'approved' }),
  };
  const { error: nursePushError } = await nurse.client.functions.invoke('dispatch-appointment-notification', { body: { appointment_id: ids.approve } });
  assert.ok(nursePushError, 'Nurse notification dispatch should be rejected');
  report('nurse notification dispatch is denied');

  const { data: pendingNotice, error: pendingNoticeError } = await admin.from('notifications').select('title, body, appointment_id').eq('user_id', patient.id).eq('appointment_id', ids.approve).eq('title', 'Appointment Pending Approval').single();
  if (pendingNoticeError) throw pendingNoticeError;
  assert.match(pendingNotice.body, /pending clinic approval/i);
  report('new booking creates patient pending-approval notification');
  await expectNoDevicePush(patient.client, ids.approve, 'patient can dispatch own pending notification to push handler');

  const { error: directUpdateError } = await receptionist.client.from('appointments').update({ status: 'approved' }).eq('id', ids.approve);
  assert.ok(directUpdateError, 'Direct status update should require a workflow function');
  report('staff direct appointment status update is blocked');

  let result = await receptionist.client.rpc('approve_appointment', { p_appointment_id: ids.approve });
  if (result.error) throw result.error;
  await expectNoDevicePush(receptionist.client, ids.approve, 'approved status resolves to patient push notification');
  result = await receptionist.client.rpc('approve_appointment', { p_appointment_id: ids.approve });
  assert.ok(result.error, 'Approving twice should fail');
  report('pending request approved once; duplicate approval rejected');
  await rejects(receptionist.client, 'approve_appointment', { p_appointment_id: ids.cancelled }, 'cancelled appointment cannot be approved');
  await rejects(doctor.client, 'complete_appointment', { p_appointment_id: ids.decline }, 'doctor cannot complete a pending appointment');

  const validStart = new Date(`${thursday}T13:00:00+08:00`).toISOString();
  await rejects(receptionist.client, 'reschedule_appointment', { p_appointment_id: ids.reschedule, p_start_time: new Date(`${wednesday}T10:00:00+08:00`).toISOString() }, 'rescheduling onto a taken slot rejected');
  await rejects(receptionist.client, 'reschedule_appointment', { p_appointment_id: ids.reschedule, p_start_time: new Date(`${saturday}T09:00:00+08:00`).toISOString() }, 'weekend reschedule rejected');
  await rejects(receptionist.client, 'reschedule_appointment', { p_appointment_id: ids.reschedule, p_start_time: new Date('2020-01-01T09:00:00+08:00').toISOString() }, 'past reschedule rejected');
  await rejects(receptionist.client, 'reschedule_appointment', { p_appointment_id: ids.reschedule, p_start_time: new Date(`${wednesday}T09:07:00+08:00`).toISOString() }, 'off-grid reschedule rejected');
  await rejects(receptionist.client, 'reschedule_appointment', { p_appointment_id: ids.reschedule, p_start_time: new Date(`${wednesday}T17:00:00+08:00`).toISOString() }, 'outside-clinic-hours reschedule rejected');
  result = await receptionist.client.rpc('reschedule_appointment', { p_appointment_id: ids.reschedule, p_start_time: validStart });
  if (result.error) throw result.error;
  report('reschedule to an open future weekday slot passed');
  await expectNoDevicePush(receptionist.client, ids.reschedule, 'rescheduled status resolves to patient push notification');
  result = await doctor.client.rpc('complete_appointment', { p_appointment_id: ids.reschedule });
  if (result.error) throw result.error;
  await expectNoDevicePush(receptionist.client, ids.cancel, 'cancelled status resolves to patient push notification');
  report('assigned doctor can complete a rescheduled appointment');

  const adminApproveId = await createAppointment({ patientId: patient.patientId, doctorId: testDoctorId, serviceId: service.id, duration: service.duration_minutes, date: followingTuesday, hour: 13 });
  result = await clinicAdmin.client.rpc('approve_appointment', { p_appointment_id: adminApproveId });
  if (result.error) throw result.error;
  await expectNoDevicePush(receptionist.client, ids.decline, 'declined status resolves to patient push notification');
  report('admin can approve a pending request');

  await rejects(receptionist.client, 'cancel_appointment', { p_appointment_id: ids.cancel, p_reason: '   ' }, 'cancellation reason is required');
  result = await receptionist.client.rpc('cancel_appointment', { p_appointment_id: ids.cancel, p_reason: 'Clinic schedule change' });
  if (result.error) throw result.error;
  const { data: cancelled, error: cancelledError } = await admin.from('appointments').select('status, cancellation_reason').eq('id', ids.cancel).single();
  if (cancelledError) throw cancelledError;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellation_reason, 'Clinic schedule change');
  const { data: cancelNotice, error: cancelNoticeError } = await admin.from('notifications').select('body').eq('user_id', patient.id).eq('appointment_id', ids.cancel).eq('title', 'Appointment Cancelled').single();
  if (cancelNoticeError) throw cancelNoticeError;
  assert.match(cancelNotice.body, /Clinic schedule change/);
  report('staff cancellation stores a required reason');

  result = await receptionist.client.rpc('decline_appointment', { p_appointment_id: ids.decline, p_reason: 'Slot is unavailable' });
  if (result.error) throw result.error;
  report('staff decline stores a reason and cancels the pending request');

  result = await doctor.client.rpc('complete_appointment', { p_appointment_id: ids.complete });
  if (result.error) throw result.error;
  await expectNoDevicePush(doctor.client, ids.complete, 'completed status resolves to patient push notification');
  const { data: completionNotice, error: completionNoticeError } = await admin.from('notifications').select('title').eq('user_id', patient.id).eq('title', 'Appointment Completed').limit(1).single();
  if (completionNoticeError) throw completionNoticeError;
  assert.equal(completionNotice.title, 'Appointment Completed');
  report('assigned doctor completes approved appointment and notification is created');

  const { data: notifications, error: notificationsError } = await admin.from('notifications').select('title').eq('user_id', patient.id);
  if (notificationsError) throw notificationsError;
  for (const title of ['Appointment Pending Approval', 'Appointment Approved', 'Appointment Rescheduled', 'Appointment Cancelled', 'Appointment Request Declined', 'Appointment Completed']) {
    assert.ok(notifications.some((n) => n.title === title), `Expected notification: ${title}`);
  }
  report('pending, approved, rescheduled, declined, cancelled, and completed status notifications exist');
} catch (err) {
  testError = err;
  console.error('FAIL', err);
} finally {
  let cleanupError;
  if (createdAppointments.length) {
    const { error } = await admin.from('appointments').delete().in('id', createdAppointments);
    cleanupError = error || cleanupError;
  }
  if (createdDoctorIds.length) {
    const { error } = await admin.from('doctors').delete().in('id', createdDoctorIds);
    cleanupError = error || cleanupError;
  }
  for (const id of createdUsers) {
    const { error: profileError } = await admin.from('profiles').delete().eq('id', id);
    cleanupError = profileError || cleanupError;
    const { error } = await admin.auth.admin.deleteUser(id);
    cleanupError = error || cleanupError;
  }
  if (cleanupError) {
    console.error('FAIL temporary test data cleanup:', cleanupError.message);
    process.exitCode = 1;
  } else if (!testError) {
    report('temporary users, doctors, schedules, appointments, and notifications cleaned up');
  }
}

if (testError) process.exitCode = 1;
else console.log('All appointment workflow security checks passed.');
