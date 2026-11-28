import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localOrigin } from './local-origin.mjs';

const url = localOrigin(process.env.SUPABASE_URL);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SERVICE_ROLE_KEY, options);

async function account(t, metadata = {}) {
  const email = `demographics-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: metadata,
  });
  if (error) throw error;
  const id = data.user.id;
  t.after(async () => {
    await admin.from('profiles').delete().eq('id', id).throwOnError();
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw result.error;
  });
  const client = createClient(url, process.env.SUPABASE_ANON_KEY, options);
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { id, client };
}

test('a patient cannot promote their profile', async t => {
  const patient = await account(t);
  const result = await patient.client.from('profiles').update({ role: 'admin' }).eq('id', patient.id);
  assert.equal(result.error?.code, '42501');
  const { data } = await admin.from('profiles').select('role').eq('id', patient.id).single().throwOnError();
  assert.equal(data.role, 'patient');
});

test('patient demographics count recorded sex and missing values separately', async t => {
  const staff = await account(t, { sex: 'male' });
  await admin.from('profiles').update({ role: 'admin' }).eq('id', staff.id).throwOnError();
  async function counts() {
    const { data } = await staff.client.rpc('patient_sex_breakdown').throwOnError();
    return Object.fromEntries(data.map(row => [row.label, row.count]));
  }
  const receptionist = await account(t);
  await admin.from('profiles').update({ role: 'receptionist' }).eq('id', receptionist.id).throwOnError();
  const before = await counts();
  const patient = await account(t, { sex: 'female' });
  assert.equal((await counts()).Female, before.Female + 1);
  await patient.client.from('profiles').update({ sex: 'prefer_not_to_say' }).eq('id', patient.id).throwOnError();
  assert.equal((await counts())['Prefer not to say'], before['Prefer not to say'] + 1);
  await receptionist.client.rpc('staff_set_patient_sex', { p_profile_id: patient.id, p_sex: null }).throwOnError();
  assert.deepEqual(await counts(), { ...before, 'Not recorded': before['Not recorded'] + 1 });
  await admin.from('profiles').update({ sex: 'female' }).eq('id', staff.id).throwOnError();
  assert.equal((await counts()).Female, before.Female);
});
