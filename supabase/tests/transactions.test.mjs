#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'luccnwicirfnmyzgemzj';
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

assert.ok(supabaseUrl && new URL(supabaseUrl).hostname.split('.')[0] === DEV_REF, 'Refusing to run tests outside the dev project');
assert.ok(anonKey && serviceRoleKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];
const createdAppointmentIds = [];
const createdTransactionIds = [];
const createdAuditIds = [];
let temporaryDoctorId = null;

function report(name) {
  console.log(`PASS ${name}`);
}

function expectDenied(result, label) {
  assert.ok(result.error || !result.data?.length, `${label} unexpectedly succeeded`);
  report(label);
}

async function createAccount(role, label) {
  const email = `mcare-tx-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `M-Care Transaction Test ${label}` },
  });
  if (error) throw error;
  const userId = data.user.id;
  createdUserIds.push(userId);

  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', userId);
    if (roleError) throw roleError;
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return { id: userId, client };
}

async function createAppointment({ patientId, doctorId, serviceId, durationMinutes, status, date, hour }) {
  const start = `${date}T${String(hour).padStart(2, '0')}:00:00+08:00`;
  const startTime = new Date(start);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000).toISOString();
  const { data, error } = await admin.from('appointments').insert({
    patient_id: patientId,
    doctor_id: doctorId,
    service_id: serviceId,
    start_time: startTime.toISOString(),
    end_time: endTime,
    status,
    notes: 'Temporary automated transaction security test',
  }).select('id').single();
  if (error) throw error;
  createdAppointmentIds.push(data.id);
  return data.id;
}

let testFailure;
try {
  const [{ data: canonicalDoctors, error: doctorError }, { data: services, error: serviceError }] = await Promise.all([
    admin.from('doctors').select('id, profile:profiles!inner(full_name)').eq('profile.full_name', 'Dr. Bernice Paule'),
    admin.from('services').select('id, duration_minutes').eq('is_active', true).order('name').limit(1),
  ]);
  if (doctorError) throw doctorError;
  if (serviceError) throw serviceError;
  assert.equal(canonicalDoctors?.length, 1, 'Expected exactly one canonical doctor on dev');
  assert.ok(services?.length, 'An active service is required for transaction tests');
  const canonicalDoctorId = canonicalDoctors[0].id;
  const serviceId = services[0].id;
  const serviceDuration = services[0].duration_minutes;

  const patientA = await createAccount('patient', 'Patient A');
  const patientB = await createAccount('patient', 'Patient B');
  const clinicAdmin = await createAccount('admin', 'Clinic Admin');
  const testDoctor = await createAccount('doctor', 'Doctor');
  const { data: patientARecord, error: patientAError } = await admin.from('patients').select('id').eq('profile_id', patientA.id).single();
  if (patientAError) throw patientAError;
  const { data: patientBRecord, error: patientBError } = await admin.from('patients').select('id').eq('profile_id', patientB.id).single();
  if (patientBError) throw patientBError;

  const { data: doctorRow, error: doctorRowError } = await admin.from('doctors').insert({
    profile_id: testDoctor.id,
    specialty: 'Temporary security test doctor',
    room: 'Test room',
  }).select('id').single();
  if (doctorRowError) throw doctorRowError;
  temporaryDoctorId = doctorRow.id;

  // Use an old weekday so fixtures cannot appear in current patient schedules.
  // The random week offset also makes a repeated test run collision-resistant.
  const weekOffset = Number.parseInt(randomBytes(2).toString('hex'), 16) % (52 * 20);
  const baseMonday = Date.UTC(2000, 0, 3 + (weekOffset * 7), 12);
  const testDate = new Date(baseMonday).toISOString().slice(0, 10);
  const pendingAppointmentId = await createAppointment({
    patientId: patientARecord.id, doctorId: canonicalDoctorId, serviceId, durationMinutes: serviceDuration, status: 'pending', date: testDate, hour: 9,
  });
  const completedAppointmentId = await createAppointment({
    patientId: patientARecord.id, doctorId: canonicalDoctorId, serviceId, durationMinutes: serviceDuration, status: 'completed', date: testDate, hour: 10,
  });
  const doctorAppointmentId = await createAppointment({
    patientId: patientARecord.id, doctorId: temporaryDoctorId, serviceId, durationMinutes: serviceDuration, status: 'completed', date: testDate, hour: 11,
  });
  assert.equal(new Date(`${testDate}T12:00:00+08:00`).getUTCDay(), 1, 'Fixture date should be Monday');

  const incompleteAttempt = await clinicAdmin.client.rpc('record_appointment_transaction', {
    p_appointment_id: pendingAppointmentId,
    p_amount: 100,
    p_payment_method: 'Cash',
  });
  assert.match(incompleteAttempt.error?.message ?? '', /completed appointment/i, 'Non-completed appointment was not rejected');
  report('recording for a non-completed appointment is rejected');

  const patientRpcAttempt = await patientA.client.rpc('record_appointment_transaction', {
    p_appointment_id: completedAppointmentId,
    p_amount: 100,
    p_payment_method: 'Cash',
  });
  assert.match(patientRpcAttempt.error?.message ?? '', /doctor or clinic admin/i, 'Patient could record a transaction through the RPC');
  report('patient transaction-recording RPC is rejected');

  const directInsert = await patientA.client.from('transactions').insert({
    user_id: patientA.id,
    appointment_id: completedAppointmentId,
    amount: 100,
    payment_method: 'Cash',
  }).select('id');
  expectDenied(directInsert, 'patient direct insert is rejected');

  const { data: transactionId, error: recordError } = await clinicAdmin.client.rpc('record_appointment_transaction', {
    p_appointment_id: completedAppointmentId,
    p_amount: 100,
    p_payment_method: 'Cash',
  });
  if (recordError) throw recordError;
  createdTransactionIds.push(transactionId);
  report('clinic admin records a completed appointment with PHP default');

  const { data: ownRows, error: ownReadError } = await patientA.client.from('transactions').select(`
    id, user_id, currency,
    appointment:appointments (id, start_time, status, service:services (name))
  `).eq('id', transactionId);
  if (ownReadError) throw ownReadError;
  assert.equal(ownRows?.length, 1, 'Patient could not read their own transaction');
  assert.equal(ownRows[0].user_id, patientA.id);
  assert.equal(ownRows[0].currency, 'PHP');
  assert.equal(ownRows[0].appointment?.status, 'completed');
  assert.ok(ownRows[0].appointment?.service?.name, 'Transaction history appointment/service relationship is missing');
  report('patient can read their own transaction');

  const { data: adminRows, error: adminReadError } = await clinicAdmin.client.from('transactions').select('id').eq('id', transactionId);
  if (adminReadError) throw adminReadError;
  assert.equal(adminRows?.length, 1, 'Clinic admin cannot read transaction records');
  report('clinic admin can read transaction records');

  const { data: crossRows, error: crossReadError } = await patientB.client.from('transactions').select('id').eq('id', transactionId);
  if (crossReadError) throw crossReadError;
  assert.equal(crossRows?.length, 0, 'A different patient read another patient transaction');
  report('cross-user transaction read returns no rows');

  const directUpdate = await patientA.client.from('transactions').update({ amount: 999 }).eq('id', transactionId).select('id');
  expectDenied(directUpdate, 'patient direct update is rejected');
  const directDelete = await patientA.client.from('transactions').delete().eq('id', transactionId).select('id');
  expectDenied(directDelete, 'patient direct delete is rejected');

  const duplicateAttempt = await clinicAdmin.client.rpc('record_appointment_transaction', {
    p_appointment_id: completedAppointmentId,
    p_amount: 100,
    p_payment_method: 'Cash',
  });
  assert.match(duplicateAttempt.error?.message ?? '', /already recorded/i, 'A second transaction was not rejected');
  report('second transaction for the same appointment is rejected');

  const wrongDoctorAttempt = await testDoctor.client.rpc('record_appointment_transaction', {
    p_appointment_id: completedAppointmentId,
    p_amount: 100,
    p_payment_method: 'Cash',
  });
  assert.match(wrongDoctorAttempt.error?.message ?? '', /own appointments/i, 'Doctor recorded a transaction for another doctor');
  report('doctor cannot record a transaction for another doctor appointment');

  const { data: doctorTransactionId, error: doctorRecordError } = await testDoctor.client.rpc('record_appointment_transaction', {
    p_appointment_id: doctorAppointmentId,
    p_amount: 125.5,
    p_payment_method: 'GCash',
  });
  if (doctorRecordError) throw doctorRecordError;
  createdTransactionIds.push(doctorTransactionId);
  report('doctor can record a completed appointment they own');

  const { error: correctionError } = await clinicAdmin.client.rpc('correct_appointment_transaction', {
    p_transaction_id: transactionId,
    p_amount: 125.5,
    p_payment_method: 'GCash',
    p_currency: 'PHP',
    p_notes: 'Corrected test record',
    p_reason: 'Automated test correction',
  });
  if (correctionError) throw correctionError;
  const { data: auditRows, error: auditError } = await admin.from('audit_logs')
    .select('id, action, old_data, new_data')
    .eq('table_name', 'transactions')
    .eq('record_id', transactionId)
    .eq('user_id', clinicAdmin.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (auditError) throw auditError;
  assert.equal(auditRows?.[0]?.action, 'UPDATE');
  assert.equal(Number(auditRows[0].old_data?.amount), 100);
  assert.equal(auditRows[0].old_data?.payment_method, 'Cash');
  assert.equal(Number(auditRows[0].new_data?.amount), 125.5);
  assert.equal(auditRows[0].new_data?.payment_method, 'GCash');
  assert.equal(auditRows[0].new_data?.correction_reason, 'Automated test correction');
  createdAuditIds.push(auditRows[0].id);
  report('admin correction preserves before/after values and reason in audit history');

  const { error: voidError } = await clinicAdmin.client.rpc('void_appointment_transaction', {
    p_transaction_id: transactionId,
    p_reason: 'Automated test void',
  });
  if (voidError) throw voidError;
  const { data: voided, error: voidReadError } = await admin.from('transactions')
    .select('voided_at, voided_by, void_reason')
    .eq('id', transactionId)
    .single();
  if (voidReadError) throw voidReadError;
  assert.ok(voided.voided_at && voided.voided_by === clinicAdmin.id && voided.void_reason === 'Automated test void');
  const { data: patientVoided, error: patientVoidReadError } = await patientA.client.from('transactions').select('voided_at').eq('id', transactionId).single();
  if (patientVoidReadError) throw patientVoidReadError;
  assert.ok(patientVoided.voided_at, 'Client transaction history does not show void status');
  report('admin void keeps transaction row and void reason');
} catch (error) {
  testFailure = error;
} finally {
  const cleanupErrors = [];
  if (createdAuditIds.length) {
    const { error } = await admin.from('audit_logs').delete().in('id', createdAuditIds);
    if (error) cleanupErrors.push(error.message);
  }
  if (createdTransactionIds.length) {
    const { error } = await admin.from('audit_logs').delete().eq('table_name', 'transactions').in('record_id', createdTransactionIds);
    if (error) cleanupErrors.push(error.message);
  }
  if (createdTransactionIds.length) {
    const { error } = await admin.from('transactions').delete().in('id', createdTransactionIds);
    if (error) cleanupErrors.push(error.message);
  }
  if (createdAppointmentIds.length) {
    const { error } = await admin.from('appointments').delete().in('id', createdAppointmentIds);
    if (error) cleanupErrors.push(error.message);
  }
  if (temporaryDoctorId) {
    const { error } = await admin.from('doctors').delete().eq('id', temporaryDoctorId);
    if (error) cleanupErrors.push(error.message);
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(error.message);
  }
  if (cleanupErrors.length) {
    console.error('Test cleanup failed for one or more temporary fixtures.');
    for (const message of cleanupErrors) console.error(message);
    testFailure ??= new Error('Temporary fixture cleanup failed');
  } else if (createdUserIds.length || createdAppointmentIds.length || createdTransactionIds.length) {
    report('temporary users, appointments, transactions, doctor, and audit rows cleaned up');
  }
}

if (testFailure) {
  console.error(`FAIL ${testFailure.message}`);
  process.exitCode = 1;
} else {
  console.log('All transaction security checks passed.');
}
