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
  // Public pages without session
  const publicPages = await Promise.all(['/privacy', '/delete-account'].map((path) => request(path)));
  assert.deepEqual(publicPages.map((response) => response.status), [200, 200]);
  report('privacy and account deletion pages are public without a session');

  // Anonymous request to dashboard redirects to login
  const anonymousDashboard = await request('/dashboard');
  assert.equal(anonymousDashboard.status, 307);
  assert.match(anonymousDashboard.headers.get('location') ?? '', /\/login$/);
  report('unauthenticated dashboard request redirects to staff login');

  const [patientCookie, doctorCookie, nurseCookie, receptionistCookie, adminCookie] = await Promise.all([
    makeRoleSession('patient'),
    makeRoleSession('doctor'),
    makeRoleSession('nurse'),
    makeRoleSession('receptionist'),
    makeRoleSession('admin'),
  ]);

  // Patient routing
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

  // Admin access to all 10 dashboard routes
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

  // Helper to assert server-side redirect to /dashboard with no denied page content
  async function assertDeniedRedirect(roleName, path, cookie) {
    const response = await request(path, cookie);
    assert.equal(response.status, 307, `${roleName} was not redirected from ${path} (status ${response.status})`);
    assert.match(
      response.headers.get('location') ?? '',
      /\/dashboard$/,
      `${roleName} was not redirected to /dashboard from ${path}`
    );
    // Confirm body contains no leaked sensitive page content
    const text = await response.text();
    assert.ok(!text.includes('Staff Management') && !text.includes('Revenue Analytics'), `Leaked content in ${path} redirect`);
  }

  // Doctor restrictions: denied /dashboard/staff and /dashboard/analytics
  const doctorAllowed = [
    '/dashboard', '/dashboard/appointments', '/dashboard/transactions',
    '/dashboard/schedules', '/dashboard/patients', '/dashboard/records',
    '/dashboard/inquiries', '/dashboard/reports'
  ];
  for (const path of doctorAllowed) {
    const response = await request(path, doctorCookie);
    assert.equal(response.status, 200, `Doctor could not open allowed route ${path}`);
  }
  await assertDeniedRedirect('Doctor', '/dashboard/staff', doctorCookie);
  await assertDeniedRedirect('Doctor', '/dashboard/analytics', doctorCookie);
  report('doctor session allowed on clinical/operational routes and server-redirected from /dashboard/staff & /dashboard/analytics');

  // Nurse restrictions: denied /dashboard/staff, /dashboard/analytics, /dashboard/transactions
  const nurseAllowed = [
    '/dashboard', '/dashboard/appointments', '/dashboard/schedules',
    '/dashboard/patients', '/dashboard/records', '/dashboard/inquiries', '/dashboard/reports'
  ];
  for (const path of nurseAllowed) {
    const response = await request(path, nurseCookie);
    assert.equal(response.status, 200, `Nurse could not open allowed route ${path}`);
  }
  await assertDeniedRedirect('Nurse', '/dashboard/staff', nurseCookie);
  await assertDeniedRedirect('Nurse', '/dashboard/analytics', nurseCookie);
  await assertDeniedRedirect('Nurse', '/dashboard/transactions', nurseCookie);
  report('nurse session allowed on nursing routes and server-redirected from staff, analytics, and transactions');

  // Receptionist restrictions: denied /dashboard/staff, /dashboard/analytics, /dashboard/transactions, /dashboard/records
  const receptionistAllowed = [
    '/dashboard', '/dashboard/appointments', '/dashboard/schedules',
    '/dashboard/patients', '/dashboard/inquiries', '/dashboard/reports'
  ];
  for (const path of receptionistAllowed) {
    const response = await request(path, receptionistCookie);
    assert.equal(response.status, 200, `Receptionist could not open allowed route ${path}`);
  }
  await assertDeniedRedirect('Receptionist', '/dashboard/staff', receptionistCookie);
  await assertDeniedRedirect('Receptionist', '/dashboard/analytics', receptionistCookie);
  await assertDeniedRedirect('Receptionist', '/dashboard/transactions', receptionistCookie);
  await assertDeniedRedirect('Receptionist', '/dashboard/records', receptionistCookie);
  report('receptionist session allowed on frontdesk routes and server-redirected from staff, analytics, transactions, and records');

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
