#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { localOrigin } from './local-origin.mjs';
const supabaseUrl = localOrigin(process.env.SUPABASE_URL);
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

assert.ok(anonKey && serviceRoleKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];

async function createAccount(role, label) {
  const email = `mcare-wi-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `M-Care Walk-In Test ${label}` },
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

const appointmentIds = [];
try {
  const staff = await createAccount('receptionist', 'Staff');
  const first = await createAccount('patient', 'First');
  const second = await createAccount('patient', 'Second');
  const patientId = async (user) => (await admin.from('patients').select('id')
    .eq('profile_id', user.id).single().throwOnError()).data.id;
  const firstId = await patientId(first);
  const secondId = await patientId(second);
  const { data: doctor } = await admin.from('doctors').select('id').limit(1).single().throwOnError();
  const { data: service } = await admin.from('services').select('id,duration_minutes')
    .eq('is_active', true).order('name').limit(1).single().throwOnError();
  const day = new Date(Date.now() + 30 * 86400000);
  while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1);
  const { data: slots } = await staff.client.rpc('get_available_slots', {
    p_doctor_id: doctor.id, p_target_date: day.toISOString().slice(0, 10),
    p_slot_duration_minutes: service.duration_minutes,
  }).throwOnError();
  assert.ok(slots.length >= 2, 'Two open weekday slots are required');
  const args = {
    p_doctor_id: doctor.id, p_service_id: service.id, p_start_time: slots[0].slot_start,
    p_end_time: slots[0].slot_end, p_notes: 'Patient walk-in test',
  };
  assert.ok((await createClient(supabaseUrl, anonKey).rpc('report_walk_in_visit', args)).error);
  assert.ok((await first.client.rpc('report_walk_in_visit', { ...args, p_patient_id: secondId })).error);
  const { data: own } = await first.client.rpc('report_walk_in_visit', args).throwOnError();
  appointmentIds.push(own);
  const staffArgs = { p_patient_id: secondId, p_doctor_id: doctor.id, p_service_id: service.id,
    p_start_time: slots[1].slot_start, p_notes: 'Staff walk-in test' };
  const forbidden = await first.client.rpc('staff_book_walk_in', staffArgs);
  assert.equal(forbidden.error?.code, '42501');
  const { data: booked } = await staff.client.rpc('staff_book_walk_in', staffArgs).throwOnError();
  appointmentIds.push(booked);
  assert.ok((await staff.client.rpc('staff_book_walk_in', staffArgs)).error);
  for (const [id, expectedPatient] of [[own, firstId], [booked, secondId]]) {
    const { data: visit } = await admin.from('appointments').select('patient_id,is_walk_in,status')
      .eq('id', id).single().throwOnError();
    assert.deepEqual(visit, { patient_id: expectedPatient, is_walk_in: true, status: 'pending' });
  }
} finally {
  if (appointmentIds.length) await admin.from('appointments').delete().in('id', appointmentIds).throwOnError();
  for (const id of createdUserIds) {
    await admin.from('profiles').delete().eq('id', id).throwOnError();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}
