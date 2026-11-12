#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const DEV_REF = 'luccnwicirfnmyzgemzj';
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
const webOrigin = process.env.MCARE_LOCAL_WEB_ORIGIN ?? 'http://127.0.0.1:3020';
assert.ok(url && new URL(url).hostname.split('.')[0] === DEV_REF, 'Refusing to run outside dev');
assert.ok(anonKey && serviceKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsers = [];
const report = (message) => console.log(`PASS ${message}`);

async function makeRoleSession(role) {
  const email = `mcare-route-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Route Test ${role}` } });
  if (error) throw error;
  createdUsers.push(data.user.id);
  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', data.user.id);
    if (roleError) throw roleError;
  }
  const store = new Map();
  const sessionClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...store].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => store.set(name, value)),
    },
  });
  const { error: loginError } = await sessionClient.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  const cookie = [...store].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
  assert.ok(cookie.includes(`sb-${DEV_REF}-auth-token`), 'Expected a dev-scoped SSR auth cookie');
  return cookie;
}

async function request(path, cookie, redirect = 'manual') {
  return fetch(`${webOrigin}${path}`, { headers: cookie ? { cookie } : {}, redirect });
}

let failure;
try {
  const publicPages = await Promise.all(['/privacy', '/delete-account'].map((path) => request(path)));
  assert.deepEqual(publicPages.map((response) => response.status), [200, 200]);
  report('privacy and account deletion pages are public without a session');

  const anonymousDashboard = await request('/dashboard');
  assert.equal(anonymousDashboard.status, 307);
  assert.match(anonymousDashboard.headers.get('location') ?? '', /\/login$/);
  report('unauthenticated dashboard request redirects to staff login');

  const [patientCookie, doctorCookie, adminCookie] = await Promise.all([
    makeRoleSession('patient'), makeRoleSession('doctor'), makeRoleSession('admin'),
  ]);
  const patientDashboard = await request('/dashboard', patientCookie);
  assert.equal(patientDashboard.status, 307);
  assert.match(patientDashboard.headers.get('location') ?? '', /\/book$/);
  const patientNotice = await request('/book', patientCookie);
  assert.equal(patientNotice.status, 307);
  assert.match(patientNotice.headers.get('location') ?? '', /\/patient-app$/);
  const patientAppPage = await request('/patient-app', patientCookie);
  assert.equal(patientAppPage.status, 200);
  assert.match(await patientAppPage.text(), /M-Care mobile app/i);
  report('patient dashboard request routes to the mobile-app notice');

  const dashboardPages = [
    '/dashboard', '/dashboard/appointments', '/dashboard/transactions', '/dashboard/schedules',
    '/dashboard/patients', '/dashboard/records', '/dashboard/inquiries', '/dashboard/analytics',
    '/dashboard/reports', '/dashboard/staff',
  ];
  for (const path of dashboardPages) {
    const response = await request(path, adminCookie);
    assert.equal(response.status, 200, `Admin could not open ${path}`);
  }
  report('admin session can open all ten dashboard routes');

  const doctorDashboard = await request('/dashboard', doctorCookie);
  assert.equal(doctorDashboard.status, 200);
  const doctorStaffRoute = await request('/dashboard/staff', doctorCookie);
  assert.equal(doctorStaffRoute.status, 200);
  report('doctor session receives dashboard shell for the admin staff URL; page-level guard is client-side');
} catch (error) {
  failure = error;
} finally {
  for (const id of createdUsers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !failure) failure = error;
  }
}
if (failure) throw failure;
console.log('Dashboard role-route checks passed; temporary accounts cleaned up.');
