"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatManilaDate, formatManilaDateTime } from "@m-care/shared";
import type { AppointmentWithDetails, Transaction, UserRole } from "@m-care/shared";

type TransactionRow = Transaction & {
  appointment: {
    start_time: string;
    patient: { profile: { full_name: string } | null } | null;
    service: { name: string } | null;
  } | null;
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function friendlyError(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message : "";
  if (/completed appointment/i.test(message)) return "Transactions can only be recorded after an appointment is completed.";
  if (/already recorded/i.test(message)) return "This appointment already has a transaction. Refresh the list to see it.";
  if (/admin access/i.test(message)) return "Only a clinic admin can correct or void a transaction.";
  return fallback;
}

export default function AdminTransactionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<UserRole | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [correcting, setCorrecting] = useState<TransactionRow | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionMethod, setCorrectionMethod] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [voiding, setVoiding] = useState<TransactionRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) throw new Error("Sign in required");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (profileError) throw profileError;
      setRole(profile.role as UserRole);
      if (profile.role !== "doctor" && profile.role !== "admin") {
        setLoadError("This transaction workspace is available to the doctor and clinic admin only.");
        return;
      }

      const [appointmentResult, transactionResult] = await Promise.all([
        supabase.from("appointments").select(`
          *,
          patient:patients (*, profile:profiles (*)),
          doctor:doctors (*, profile:profiles (*)),
          service:services (*)
        `).eq("status", "completed").order("start_time", { ascending: false }),
        supabase.from("transactions").select(`
          *,
          appointment:appointments (
            *,
            patient:patients (*, profile:profiles (*)),
            doctor:doctors (*, profile:profiles (*)),
            service:services (*)
          )
        `).order("created_at", { ascending: false }),
      ]);
      if (appointmentResult.error) throw appointmentResult.error;
      if (transactionResult.error) throw transactionResult.error;
      setAppointments((appointmentResult.data ?? []) as unknown as AppointmentWithDetails[]);
      setTransactions((transactionResult.data ?? []) as unknown as TransactionRow[]);
    } catch (cause) {
      console.error("Unable to load transaction workspace:", cause);
      setLoadError("We couldn’t load transaction records. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const recordedAppointmentIds = new Set(transactions.map((transaction) => transaction.appointment_id));
  const unrecordedAppointments = appointments.filter((appointment) => !recordedAppointmentIds.has(appointment.id));

  const recordTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);
    setNotice(null);
    const value = Number(amount);
    if (!selectedAppointmentId || amount.trim() === "" || !Number.isFinite(value) || value < 0 || !paymentMethod.trim()) {
      setActionError("Choose a completed appointment and enter a valid amount and payment method.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("record_appointment_transaction", {
        p_appointment_id: selectedAppointmentId,
        p_amount: value,
        p_payment_method: paymentMethod.trim(),
        p_currency: "PHP",
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      setAmount("");
      setPaymentMethod("Cash");
      setNotes("");
      setSelectedAppointmentId("");
      setNotice("In-person transaction recorded.");
      await loadData();
    } catch (cause) {
      console.error("Unable to record transaction:", cause);
      setActionError(friendlyError(cause, "We couldn’t record this transaction. Refresh and retry."));
    } finally {
      setSaving(false);
    }
  };

  const correctTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!correcting) return;
    setActionError(null);
    const value = Number(correctionAmount);
    if (correctionAmount.trim() === "" || !Number.isFinite(value) || value < 0 || !correctionMethod.trim() || !correctionReason.trim()) {
      setActionError("Enter a valid amount, method, and reason for the correction.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("correct_appointment_transaction", {
        p_transaction_id: correcting.id,
        p_amount: value,
        p_payment_method: correctionMethod.trim(),
        p_currency: correcting.currency,
        p_notes: correctionNotes.trim() || null,
        p_reason: correctionReason.trim(),
      });
      if (error) throw error;
      setCorrecting(null);
      setNotice("Correction saved. The prior values and reason remain in the audit history.");
      await loadData();
    } catch (cause) {
      console.error("Unable to correct transaction:", cause);
      setActionError(friendlyError(cause, "We couldn’t save this correction. Refresh and retry."));
    } finally {
      setSaving(false);
    }
  };

  const voidTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!voiding || !voidReason.trim()) {
      setActionError("Enter a reason before voiding this transaction.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("void_appointment_transaction", {
        p_transaction_id: voiding.id,
        p_reason: voidReason.trim(),
      });
      if (error) throw error;
      setVoiding(null);
      setVoidReason("");
      setNotice("Transaction voided and retained in the history.");
      await loadData();
    } catch (cause) {
      console.error("Unable to void transaction:", cause);
      setActionError(friendlyError(cause, "We couldn’t void this transaction. Refresh and retry."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div role="status" className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-700">Loading transaction records…</div>;
  }
  if (loadError) {
    return <div role="alert" className="rounded-2xl border border-red-300 bg-white p-6 text-red-950"><p>{loadError}</p><button type="button" onClick={() => void loadData()} className="mt-4 rounded-lg bg-rose-800 px-4 py-2 font-semibold text-white">Retry</button></div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Transaction Records</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">Record a payment after the completed service has been paid in person at the clinic. This page does not collect money or payment credentials.</p>
      </header>

      {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-semibold text-emerald-950">{notice}</p>}
      {actionError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">{actionError}</p>}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-gray-900">Record an in-person transaction</h2>
        <p className="mt-1 text-sm text-gray-700">Only completed appointments without an existing transaction are listed.</p>
        {unrecordedAppointments.length === 0 ? (
          <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">There are no completed appointments waiting for a transaction record.</p>
        ) : (
          <form onSubmit={recordTransaction} className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="transaction-appointment" className="mb-1 block text-sm font-semibold text-gray-900">Completed appointment</label>
              <select id="transaction-appointment" required value={selectedAppointmentId} onChange={(event) => setSelectedAppointmentId(event.target.value)} className="w-full rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-800">
                <option value="">Select an appointment</option>
                {unrecordedAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointment.patient?.profile?.full_name ?? "Patient"} · {appointment.service?.name ?? "Clinic visit"} · {formatManilaDateTime(appointment.start_time)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transaction-amount" className="mb-1 block text-sm font-semibold text-gray-900">Amount paid (PHP)</label>
              <input id="transaction-amount" type="number" inputMode="decimal" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-800" />
            </div>
            <div>
              <label htmlFor="transaction-method" className="mb-1 block text-sm font-semibold text-gray-900">Payment method label</label>
              <select id="transaction-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-800">
                <option>Cash</option><option>GCash</option><option>Card (in person)</option><option>Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="transaction-notes" className="mb-1 block text-sm font-semibold text-gray-900">Notes (optional)</label>
              <textarea id="transaction-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-800" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={saving} className="rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Saving record…" : "Save transaction record"}
              </button>
            </div>
          </form>
        )}
      </section>

      {correcting && (
        <section className="rounded-2xl border border-amber-400 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">Correct transaction MC-{correcting.id.slice(0, 8).toUpperCase()}</h2>
          <p className="mt-1 text-sm text-gray-700">The old and new values and the reason will be retained in the audit history.</p>
          <form onSubmit={correctTransaction} className="mt-4 grid gap-4 md:grid-cols-2">
            <div><label htmlFor="correct-amount" className="mb-1 block text-sm font-semibold text-gray-900">Correct amount (PHP)</label><input id="correct-amount" type="number" min="0" step="0.01" required value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900" /></div>
            <div><label htmlFor="correct-method" className="mb-1 block text-sm font-semibold text-gray-900">Correct method label</label><input id="correct-method" maxLength={40} required value={correctionMethod} onChange={(event) => setCorrectionMethod(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900" /></div>
            <div className="md:col-span-2"><label htmlFor="correct-notes" className="mb-1 block text-sm font-semibold text-gray-900">Notes</label><textarea id="correct-notes" rows={2} maxLength={1000} value={correctionNotes} onChange={(event) => setCorrectionNotes(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900" /></div>
            <div className="md:col-span-2"><label htmlFor="correct-reason" className="mb-1 block text-sm font-semibold text-gray-900">Reason for correction</label><textarea id="correct-reason" rows={2} maxLength={500} required value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900" /></div>
            <div className="flex gap-3 md:col-span-2"><button type="submit" disabled={saving} className="rounded-xl bg-amber-800 px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Save correction"}</button><button type="button" onClick={() => setCorrecting(null)} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-gray-900">Cancel</button></div>
          </form>
        </section>
      )}

      {voiding && (
        <section className="rounded-2xl border border-red-300 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">Void transaction MC-{voiding.id.slice(0, 8).toUpperCase()}</h2>
          <p className="mt-1 text-sm text-gray-700">The transaction will stay visible in both histories with its void status and reason.</p>
          <form onSubmit={voidTransaction} className="mt-4 space-y-3">
            <label htmlFor="void-reason" className="block text-sm font-semibold text-gray-900">Reason</label>
            <textarea id="void-reason" rows={2} maxLength={500} required value={voidReason} onChange={(event) => setVoidReason(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-gray-900" />
            <div className="flex gap-3"><button type="submit" disabled={saving} className="rounded-xl bg-red-800 px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Void transaction"}</button><button type="button" onClick={() => setVoiding(null)} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-gray-900">Cancel</button></div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-gray-900">Recorded transactions</h2><p className="mt-1 text-sm text-gray-700">Corrections are admin-only and audited.</p></div>
          <button type="button" onClick={() => void loadData()} className="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">Refresh</button>
        </div>
        {transactions.length === 0 ? (
          <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">No transaction records have been added yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{transaction.appointment?.patient?.profile?.full_name ?? "Patient"} · {transaction.appointment?.service?.name ?? "Clinic service"}</p>
                    <p className="mt-1 text-sm text-gray-700">{transaction.appointment?.start_time ? formatManilaDateTime(transaction.appointment.start_time) : "Date unavailable"} · Recorded {formatManilaDate(transaction.created_at)}</p>
                    <p className="mt-1 text-sm text-gray-700">{transaction.payment_method} · MC-{transaction.id.slice(0, 8).toUpperCase()}</p>
                    {transaction.voided_at && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-950">Voided: {transaction.void_reason}</p>}
                  </div>
                  <p className="text-lg font-extrabold text-gray-900">{formatAmount(transaction.amount, transaction.currency)}</p>
                </div>
                {role === "admin" && !transaction.voided_at && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setCorrecting(transaction); setCorrectionAmount(String(transaction.amount)); setCorrectionMethod(transaction.payment_method); setCorrectionNotes(transaction.notes ?? ""); setCorrectionReason(""); setActionError(null); }} className="rounded-lg border border-gray-400 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">Correct record</button>
                    <button type="button" onClick={() => { setVoiding(transaction); setVoidReason(""); setActionError(null); }} className="rounded-lg border border-red-400 px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-50">Void record</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
