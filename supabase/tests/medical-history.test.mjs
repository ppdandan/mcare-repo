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
const records = [];
const report = (name) => console.log(`PASS ${name}`);

async function createPatient(label) {
  const email = `mcare-record-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `Record Test ${label}` },
  });
  if (error) throw error;
  users.push(data.user.id);
  const { data: patient, error: patientError } = await admin.from('patients').select('id').eq('profile_id', data.user.id).single();
  if (patientError) throw patientError;
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { patientId: patient.id, client };
}

let failure;
try {
  const [owner, other] = await Promise.all([createPatient('Owner'), createPatient('Other')]);
  const { data: doctor, error: doctorError } = await admin.from('doctors').select('id').limit(1).single();
  if (doctorError) throw doctorError;
  const { data: row, error: insertError } = await admin.from('medical_records').insert({
    patient_id: owner.patientId,
    doctor_id: doctor.id,
    visit_date: '2020-01-06',
    medical_history: 'Temporary history visibility check',
  }).select('id').single();
  if (insertError) throw insertError;
  records.push(row.id);

  const { data: ownRows, error: ownError } = await owner.client.from('medical_records').select('id, medical_history').eq('id', row.id);
  if (ownError) throw ownError;
  assert.equal(ownRows?.length, 1);
  assert.equal(ownRows[0].medical_history, 'Temporary history visibility check');
  report('patient can read own medical history field');

  const { data: otherRows, error: otherError } = await other.client.from('medical_records').select('id').eq('id', row.id);
  if (otherError) throw otherError;
  assert.deepEqual(otherRows, []);
  report('patient cannot read another patient medical history');
} catch (error) {
  failure = error;
} finally {
  if (records.length) {
    const { error } = await admin.from('medical_records').delete().in('id', records);
    if (error && !failure) failure = error;
  }
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !failure) failure = error;
  }
}
if (failure) throw failure;
console.log('All medical history access checks passed.');
