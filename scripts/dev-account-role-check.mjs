#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { createDevClient, provisionDevUser } from "./dev-create-user.mjs";

const DEV_REF = "luccnwicirfnmyzgemzj";
const devUrl = `https://${DEV_REF}.supabase.co`;
const anonKey = process.env.SUPABASE_ANON_KEY;
const service = createDevClient();
if (!anonKey) throw new Error("SUPABASE_ANON_KEY must be set in the environment.");

const legacyDoctorId = "00000000-0000-4000-8000-000000000015";
const legacyTestAccounts = [
  { id: "8b71ef1a-75bb-4d8e-a447-c0a8727cb793", email: "mcare.dev.admin@example.com" },
  { id: "438525e0-d755-4a84-aa8f-ab6e1a46fd0a", email: "mcare.dev.patient@example.com" },
];
const testStartedAt = new Date().toISOString();
const outcomes = [];
const accounts = [];
const fixtureAppointmentIds = [];
const fixtureTransactionIds = [];
const cleanupAuthIds = new Set();
let doctorId = null;
let serviceId = null;
let serviceDuration = null;
let patientId = null;
let generatedStaffId = null;

const targetSpecs = [
  { email: "admin@mcare.test", fullName: "M-Care Dev Admin", role: "admin" },
  { email: "receptionist@mcare.test", fullName: "M-Care Dev Receptionist", role: "receptionist" },
  { email: "nurse@mcare.test", fullName: "M-Care Dev Nurse", role: "nurse" },
  { email: "patient@mcare.test", fullName: "M-Care Dev Patient", role: "patient" },
];

function record(label, passed, detail = "") {
  outcomes.push({ label, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) process.exitCode = 1;
}

function anonClient() {
  return createClient(devUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(account) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.user) throw new Error(`Password sign-in failed for ${account.email}.`);
  const { data: profile, error: profileError } = await client.from("profiles").select("id,role,full_name").eq("id", data.user.id).single();
  if (profileError || profile?.role !== account.role) throw new Error(`Profile role verification failed for ${account.email}.`);
  account.client = client;
  account.authId = data.user.id;
  account.profile = profile;
  record(`${account.role} sign-in and profile role`, true, `${account.email} (${profile.role})`);
}

async function expectAllowed(account, rpc, args, label) {
  const { error } = await account.client.rpc(rpc, args);
  record(label, !error, error ? "request rejected" : "request accepted");
  return !error;
}

async function expectDenied(account, rpc, args, label) {
  const { error } = await account.client.rpc(rpc, args);
  record(label, Boolean(error), error ? "denied" : "unexpectedly accepted");
  return Boolean(error);
}

function manilaDate(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

async function findAvailableSlot(patientAccount, excluded = new Set()) {
  for (let offset = 1; offset <= 100; offset += 1) {
    const date = manilaDate(offset);
    const dateAtNoonPht = new Date(`${date}T12:00:00+08:00`);
    const weekday = dateAtNoonPht.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const { data, error } = await service.rpc("get_available_slots", {
      p_doctor_id: doctorId,
      p_target_date: date,
      p_slot_duration_minutes: serviceDuration,
      p_timezone: "Asia/Manila",
    });
    if (error) continue;
    const slot = (data ?? []).find((candidate) => !excluded.has(candidate.slot_start));
    if (slot) return slot;
  }
  throw new Error("No future weekday appointment slot was available for a dev fixture.");
}

async function bookFixture(patientAccount) {
  const excluded = new Set(fixtureAppointmentIds.map((row) => row.startTime));
  const slot = await findAvailableSlot(patientAccount, excluded);
  const { data, error } = await patientAccount.client.rpc("book_appointment", {
    p_doctor_id: doctorId,
    p_service_id: serviceId,
    p_start_time: slot.slot_start,
    p_notes: "Temporary automated role-check fixture",
  });
  if (error || !data) throw new Error("Could not create a temporary appointment through book_appointment.");
  fixtureAppointmentIds.push({ id: data, startTime: slot.slot_start });
  return { id: data, startTime: slot.slot_start };
}

async function cleanup() {
  if (fixtureTransactionIds.length) {
    await service.from("transactions").delete().in("id", fixtureTransactionIds);
  }
  if (fixtureAppointmentIds.length) {
    await service.from("appointments").delete().in("id", fixtureAppointmentIds.map((row) => row.id));
  }
  const testPatient = accounts.find((account) => account.role === "patient");
  if (testPatient?.authId) {
    await service.from("notifications").delete().eq("user_id", testPatient.authId).gte("created_at", testStartedAt);
  }
  if (generatedStaffId) cleanupAuthIds.add(generatedStaffId);
  for (const id of cleanupAuthIds) {
    await service.auth.admin.deleteUser(id, false);
    await service.from("profiles").delete().eq("id", id);
  }
}

async function provisionAll() {
  const doctorProfile = await service.from("profiles").select("id,full_name,role").eq("id", legacyDoctorId).maybeSingle();
  if (doctorProfile.error || doctorProfile.data?.role !== "doctor" || doctorProfile.data.full_name !== "Dr. Bernice Paule") {
    throw new Error("Canonical Dr. Bernice profile was not found; refusing to change doctor linkage.");
  }

  let doctorAccount;
  try {
    doctorAccount = await provisionDevUser({
      email: "bernice.paule@mcare.test",
      fullName: "Dr. Bernice Paule",
      role: "doctor",
      userId: legacyDoctorId,
    }, service);
  } catch {
    // This legacy Auth row fails Admin API reads. Create a replacement login
    // and relink the existing doctor row without deleting its appointment history.
    doctorAccount = await provisionDevUser({
      email: "bernice.paule@mcare.test",
      fullName: "Dr. Bernice Paule",
      role: "doctor",
    }, service);
    const { data: doctorRow, error: doctorReadError } = await service
      .from("doctors").select("id").eq("profile_id", legacyDoctorId).single();
    if (doctorReadError || !doctorRow) throw new Error("Replacement doctor account was created but the doctor record could not be located.");
    const { error: relinkError } = await service.from("doctors").update({ profile_id: doctorAccount.userId }).eq("id", doctorRow.id);
    if (relinkError) throw new Error("Replacement doctor account was created but the doctor record could not be relinked.");
    await service.from("profiles").update({ role: "patient" }).eq("id", legacyDoctorId);
    doctorAccount.legacyAuthAdminFailure = true;
  }
  accounts.push(doctorAccount);

  for (const spec of targetSpecs) {
    const existingProfiles = await service.from("profiles")
      .select("id")
      .eq("role", spec.role)
      .eq("full_name", spec.fullName);
    if (existingProfiles.error) throw new Error(`Could not search for the existing ${spec.role} profile.`);
    let existingId = null;
    for (const profile of existingProfiles.data ?? []) {
      const current = await service.auth.admin.getUserById(profile.id);
      if (!current.error && current.data.user.email?.toLowerCase() === spec.email) {
        existingId = profile.id;
        break;
      }
    }
    const account = await provisionDevUser({ ...spec, userId: existingId ?? undefined }, service);
    accounts.push(account);
  }
  for (const account of accounts) await signIn(account);

  const doctor = accounts.find((account) => account.role === "doctor");
  const { data: doctorLink, error: doctorLinkError } = await service
    .from("doctors").select("id,profile_id,profile:profiles!inner(full_name,role)").eq("profile_id", doctor.authId).single();
  record("Dr. Bernice doctor record is linked to the doctor login", !doctorLinkError && doctorLink?.profile?.full_name === "Dr. Bernice Paule" && doctorLink.profile.role === "doctor");

  const doctorList = await service.from("doctors").select("id,profile:profiles!inner(full_name,role)");
  record("Exactly one canonical doctor record exists", !doctorList.error && doctorList.data?.length === 1 && doctorList.data[0].profile.full_name === "Dr. Bernice Paule");

  const weakPasswords = ["Password123!", "password123", "Password1!", "12345678"];
  for (const account of accounts) {
    let result = "FAILED";
    let indeterminate = false;
    for (const password of weakPasswords) {
      const { data, error } = await anonClient().auth.signInWithPassword({ email: account.email, password });
      if (!error && data.user) { result = "SUCCEEDED"; break; }
      if (error?.status !== 400 || !/invalid login credentials|invalid_credentials/i.test(`${error.message} ${error.code ?? ""}`)) {
        result = "INDETERMINATE";
        indeterminate = true;
        break;
      }
    }
    record(`Weak-password candidates for ${account.email}`, result === "FAILED", result === "INDETERMINATE" ? "Auth error before all candidates" : result);
    if (indeterminate) account.weakPasswordCheck = result;
  }
}

async function testReads() {
  const globalPatients = await service.from("patients").select("id", { count: "exact", head: true });
  const globalRecords = await service.from("medical_records").select("id", { count: "exact", head: true });
  const globalAppointments = await service.from("appointments").select("id", { count: "exact", head: true });
  const globalTransactions = await service.from("transactions").select("id", { count: "exact", head: true });
  if (globalPatients.error || globalRecords.error || globalAppointments.error || globalTransactions.error) {
    throw new Error("Could not read baseline table counts using the dev service role.");
  }
  const patient = accounts.find((account) => account.role === "patient");
  const patientRow = await service.from("patients").select("id").eq("profile_id", patient.authId).single();
  if (patientRow.error) throw new Error("Test patient row was not created.");
  patientId = patientRow.data.id;
  const doctor = accounts.find((account) => account.role === "doctor");
  const doctorRow = await service.from("doctors").select("id").eq("profile_id", doctor.authId).single();
  if (doctorRow.error) throw new Error("Doctor record link is unavailable.");
  doctorId = doctorRow.data.id;
  const serviceRow = await service.from("services").select("id,duration_minutes").eq("is_active", true).order("name").limit(1).single();
  if (serviceRow.error) throw new Error("No active service is available for role-check fixtures.");
  serviceId = serviceRow.data.id;
  serviceDuration = serviceRow.data.duration_minutes;

  for (const account of accounts) {
    const appts = await account.client.from("appointments").select("id,patient_id,doctor_id");
    const patients = await account.client.from("patients").select("id,profile_id");
    const records = await account.client.from("medical_records").select("id,patient_id");
    const transactions = await account.client.from("transactions").select("id,user_id");
    const ok = !appts.error && !patients.error && !records.error && !transactions.error;
    if (!ok) {
      record(`${account.role} scoped database reads`, false, "query error");
      continue;
    }
    const ownOnly = account.role === "patient";
    const appointmentScope = ownOnly
      ? (appts.data ?? []).every((row) => row.patient_id === patientId)
      : account.role === "doctor"
        ? (appts.data ?? []).every((row) => row.doctor_id === doctorId)
        : (appts.data?.length ?? 0) === globalAppointments.count;
    const patientScope = ownOnly
      ? (patients.data ?? []).every((row) => row.profile_id === account.authId)
      : (patients.data?.length ?? 0) === globalPatients.count;
    const clinicalExpected = ["doctor", "nurse", "admin"].includes(account.role);
    const recordScope = ownOnly
      ? (records.data ?? []).every((row) => row.patient_id === patientId)
      : clinicalExpected
        ? (records.data?.length ?? 0) === globalRecords.count
        : (records.data?.length ?? 0) === 0;
    const transactionExpected = ["doctor", "admin"].includes(account.role);
    const transactionScope = ownOnly
      ? (transactions.data ?? []).every((row) => row.user_id === account.authId)
      : transactionExpected
        ? (transactions.data?.length ?? 0) === globalTransactions.count
        : (transactions.data?.length ?? 0) === 0;
    record(`${account.role} appointment visibility`, appointmentScope, ownOnly ? "own rows only" : account.role === "doctor" ? "assigned doctor rows only (single doctor in this dev clinic)" : "all rows");
    record(`${account.role} patient-directory visibility`, patientScope, ownOnly ? "own patient row only" : "all patient rows");
    record(`${account.role} medical-record visibility`, recordScope, ownOnly ? "own records only" : clinicalExpected ? "all clinical records" : "no clinical records");
    record(`${account.role} transaction visibility`, transactionScope, ownOnly ? "own transactions only" : transactionExpected ? "all transactions" : "no transactions");
  }
}

async function testWorkflows() {
  const byRole = Object.fromEntries(accounts.map((account) => [account.role, account]));
  const patient = byRole.patient;
  const slots = [];
  for (let index = 0; index < 5; index += 1) slots.push(await bookFixture(patient));
  const [approvalReception, approvalAdmin, completeDoctor, completeAdmin, patientCancel] = slots;
  const appointmentArg = (id) => ({ p_appointment_id: id });

  await expectDenied(patient, "approve_appointment", appointmentArg(approvalReception.id), "patient cannot approve appointments");
  await expectDenied(byRole.doctor, "approve_appointment", appointmentArg(approvalReception.id), "doctor cannot approve appointments");
  await expectDenied(byRole.nurse, "approve_appointment", appointmentArg(approvalReception.id), "nurse cannot approve appointments");
  await expectAllowed(byRole.receptionist, "approve_appointment", appointmentArg(approvalReception.id), "receptionist can approve appointments");
  await expectAllowed(byRole.admin, "approve_appointment", appointmentArg(approvalAdmin.id), "admin can approve appointments");

  const cancelArgs = (id) => ({ p_appointment_id: id, p_reason: "Temporary role test" });
  await expectDenied(patient, "reschedule_appointment", { ...appointmentArg(approvalReception.id), p_start_time: "2099-01-01T01:00:00Z" }, "patient cannot reschedule appointments");
  await expectDenied(byRole.doctor, "reschedule_appointment", { ...appointmentArg(approvalReception.id), p_start_time: "2099-01-01T01:00:00Z" }, "doctor cannot reschedule appointments");
  await expectDenied(byRole.nurse, "reschedule_appointment", { ...appointmentArg(approvalReception.id), p_start_time: "2099-01-01T01:00:00Z" }, "nurse cannot reschedule appointments");
  const excluded = new Set(slots.map((slot) => slot.startTime));
  const rescheduleOne = await findAvailableSlot(patient, excluded);
  excluded.add(rescheduleOne.slot_start);
  const receptionRescheduled = await expectAllowed(byRole.receptionist, "reschedule_appointment", { ...appointmentArg(approvalReception.id), p_start_time: rescheduleOne.slot_start }, "receptionist can reschedule appointments");
  if (receptionRescheduled) {
    const rescheduleTwo = await findAvailableSlot(patient, excluded);
    excluded.add(rescheduleTwo.slot_start);
    await expectAllowed(byRole.admin, "reschedule_appointment", { ...appointmentArg(approvalReception.id), p_start_time: rescheduleTwo.slot_start }, "admin can reschedule appointments");
  }

  await expectDenied(patient, "cancel_appointment", cancelArgs(approvalAdmin.id), "patient cannot use staff cancel function");
  await expectDenied(byRole.doctor, "cancel_appointment", cancelArgs(approvalAdmin.id), "doctor cannot use staff cancel function");
  await expectDenied(byRole.nurse, "cancel_appointment", cancelArgs(approvalAdmin.id), "nurse cannot use staff cancel function");
  await expectAllowed(byRole.receptionist, "cancel_appointment", cancelArgs(approvalAdmin.id), "receptionist can cancel appointments");
  await expectAllowed(byRole.admin, "cancel_appointment", cancelArgs(approvalReception.id), "admin can cancel appointments");

  await expectDenied(patient, "complete_appointment", appointmentArg(completeDoctor.id), "patient cannot complete appointments");
  await expectDenied(byRole.nurse, "complete_appointment", appointmentArg(completeDoctor.id), "nurse cannot complete appointments");
  await expectDenied(byRole.receptionist, "complete_appointment", appointmentArg(completeDoctor.id), "receptionist cannot complete appointments");
  await expectDenied(byRole.admin, "complete_appointment", appointmentArg(completeDoctor.id), "admin cannot complete appointments");
  await expectAllowed(byRole.receptionist, "approve_appointment", appointmentArg(completeDoctor.id), "receptionist approves doctor completion fixture");
  await expectAllowed(byRole.doctor, "complete_appointment", appointmentArg(completeDoctor.id), "assigned doctor can complete appointment");
  await expectAllowed(byRole.admin, "approve_appointment", appointmentArg(completeAdmin.id), "admin approves transaction fixture");
  await expectAllowed(byRole.doctor, "complete_appointment", appointmentArg(completeAdmin.id), "doctor completes transaction fixture");

  await expectDenied(byRole.nurse, "record_appointment_transaction", {
    p_appointment_id: completeDoctor.id, p_amount: 100, p_payment_method: "Cash", p_currency: "PHP", p_notes: null,
  }, "nurse cannot record transactions");
  await expectDenied(byRole.receptionist, "record_appointment_transaction", {
    p_appointment_id: completeDoctor.id, p_amount: 100, p_payment_method: "Cash", p_currency: "PHP", p_notes: null,
  }, "receptionist cannot record transactions");
  await expectDenied(patient, "record_appointment_transaction", {
    p_appointment_id: completeDoctor.id, p_amount: 100, p_payment_method: "Cash", p_currency: "PHP", p_notes: null,
  }, "patient cannot record transactions");
  const doctorTransaction = await byRole.doctor.client.rpc("record_appointment_transaction", {
    p_appointment_id: completeDoctor.id, p_amount: 100, p_payment_method: "Cash", p_currency: "PHP", p_notes: "Temporary role test",
  });
  record("doctor can record transaction for assigned completed visit", !doctorTransaction.error);
  if (doctorTransaction.data) fixtureTransactionIds.push(doctorTransaction.data);
  const adminTransaction = await byRole.admin.client.rpc("record_appointment_transaction", {
    p_appointment_id: completeAdmin.id, p_amount: 150, p_payment_method: "Cash", p_currency: "PHP", p_notes: "Temporary role test",
  });
  record("admin can record transaction for completed visit", !adminTransaction.error);
  if (adminTransaction.data) fixtureTransactionIds.push(adminTransaction.data);

  const { error: patientCancelError } = await patient.client.rpc("cancel_my_appointment", appointmentArg(patientCancel.id));
  record("patient can cancel own appointment through patient RPC", !patientCancelError);
}

async function testCreateStaff() {
  const stamp = Date.now();
  for (const role of ["patient", "doctor", "nurse", "receptionist"]) {
    const caller = accounts.find((account) => account.role === role);
    const { error } = await caller.client.functions.invoke("create-staff", {
      body: { full_name: "Temporary role-test staff", email: `blocked-${role}-${stamp}@mcare.test`, phone: "", role: "nurse" },
    });
    const status = error?.context?.status;
    record(`${role} cannot call create-staff`, Boolean(error) && status === 403, status ? `HTTP ${status}` : error ? "request rejected without HTTP 403" : "unexpectedly accepted");
  }
  const admin = accounts.find((account) => account.role === "admin");
  const { data, error } = await admin.client.functions.invoke("create-staff", {
    body: { full_name: "Temporary role-test cleanup", email: `cleanup-${stamp}@mcare.test`, phone: "", role: "nurse" },
  });
  generatedStaffId = data?.user_id ?? null;
  record("admin can call create-staff", !error && Boolean(generatedStaffId), error ? `HTTP ${error.context?.status ?? "error"}` : "invitation created for cleanup");
}

async function removeLegacyCandidates() {
  console.log("Leftover candidates before deletion (count: 2):");
  for (const candidate of legacyTestAccounts) console.log(`- ${candidate.email}`);
  for (const candidate of legacyTestAccounts) {
    const patient = await service.from("patients").select("id").eq("profile_id", candidate.id).maybeSingle();
    const doctor = await service.from("doctors").select("id").eq("profile_id", candidate.id).maybeSingle();
    const patientAppointments = patient.data
      ? await service.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", patient.data.id)
      : { count: 0, error: null };
    const patientRecords = patient.data
      ? await service.from("medical_records").select("id", { count: "exact", head: true }).eq("patient_id", patient.data.id)
      : { count: 0, error: null };
    const doctorAppointments = doctor.data
      ? await service.from("appointments").select("id", { count: "exact", head: true }).eq("doctor_id", doctor.data.id)
      : { count: 0, error: null };
    const transactionRows = await service.from("transactions").select("id", { count: "exact", head: true }).or(`user_id.eq.${candidate.id},recorded_by.eq.${candidate.id},voided_by.eq.${candidate.id}`);
    const safe = !patient.error && !doctor.error && !patientAppointments.error && !patientRecords.error && !doctorAppointments.error && !transactionRows.error
      && patientAppointments.count === 0 && patientRecords.count === 0 && doctorAppointments.count === 0 && transactionRows.count === 0;
    if (!safe) {
      record(`leftover ${candidate.email} preserved`, false, "references require review");
      continue;
    }
    const { error: deleteError } = await service.auth.admin.deleteUser(candidate.id, false);
    if (deleteError) {
      record(`leftover ${candidate.email} deleted`, false, "Auth Admin API deletion failed");
      continue;
    }
    const { error: profileDeleteError } = await service.from("profiles").delete().eq("id", candidate.id);
    record(`leftover ${candidate.email} deleted`, !profileDeleteError, profileDeleteError ? "Auth login removed; stale profile remains" : "no appointments or records");
  }
}

try {
  console.log(`Verified dev ref: ${DEV_REF}`);
  await provisionAll();
  await testWorkflows();
  await testReads();
  await testCreateStaff();
  await cleanup();
  await removeLegacyCandidates();
} catch (error) {
  process.exitCode = 1;
  console.log(`STOPPED: ${error instanceof Error ? error.message : "account role check failed"}`);
  try { await cleanup(); } catch { console.log("Cleanup needs a manual check."); }
}

console.log("\nRole-check summary:");
console.log(`${outcomes.filter((item) => item.passed).length}/${outcomes.length} checks passed`);
console.log("\nDev test account credentials (copy to a password manager now):");
for (const account of accounts) console.log(`${account.email}\t${account.password}`);
