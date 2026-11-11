"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatManilaDate, formatManilaDateTime } from "@m-care/shared";
import type { TransactionWithAppointment } from "@m-care/shared";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";
import Icon from "@/components/Icon";

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export default function TransactionHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState<TransactionWithAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign in required");

      const { data, error: queryError } = await supabase
        .from("transactions")
        .select(`
          *,
          appointment:appointments (
            *,
            service:services (*)
          )
        `)
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setTransactions((data ?? []) as unknown as TransactionWithAppointment[]);
    } catch (cause) {
      console.error("Unable to load transaction history:", cause);
      setError("We couldn’t load your transaction history. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  return (
    <main className="min-h-screen bg-rose-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PatientHeader active="/transactions" />

        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Transaction History</h1>
          <p className="mt-2 text-base text-gray-700">Payments are made in person at the clinic. This page only shows records added after completed visits; it does not collect payments.</p>
        </div>

        {loading ? (
          <div role="status" className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-700 shadow-sm">
            <span className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-rose-800 border-t-transparent" />
            <p>Loading transaction history…</p>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-300 bg-white p-6 text-red-950 shadow-sm">
            <p className="font-semibold">History unavailable</p>
            <p className="mt-1">{error}</p>
            <button type="button" onClick={() => void loadTransactions()} className="mt-4 rounded-lg bg-rose-800 px-4 py-2 font-semibold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2">Retry</button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <Icon name="receipt" size={34} />
            <h2 className="mt-3 text-xl font-bold text-gray-900">No transactions yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-gray-700">When a clinic visit is completed and paid in person, the clinic can record it here for your reference.</p>
            <Link href="/book" className="mt-5 inline-flex rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2">Book an appointment</Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{transaction.appointment?.service?.name ?? "Clinic service"}</h2>
                    <p className="mt-1 text-sm text-gray-700">Appointment: {transaction.appointment?.start_time ? formatManilaDateTime(transaction.appointment.start_time) : "Date unavailable"}</p>
                  </div>
                  {transaction.voided_at && <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-900">Voided</span>}
                </div>
                <p className="mt-4 text-2xl font-extrabold text-rose-900">{formatAmount(transaction.amount, transaction.currency)}</p>
                <dl className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">Payment method</dt><dd className="mt-1 font-semibold text-gray-900">{transaction.payment_method}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recorded</dt><dd className="mt-1 font-semibold text-gray-900">{formatManilaDate(transaction.created_at, { dateStyle: "medium" })}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">Reference</dt><dd className="mt-1 font-semibold text-gray-900">MC-{transaction.id.slice(0, 8).toUpperCase()}</dd></div>
                  {transaction.notes && <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">Notes</dt><dd className="mt-1 text-gray-900">{transaction.notes}</dd></div>}
                </dl>
                {transaction.voided_at && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-950">Voided {formatManilaDate(transaction.voided_at)}{transaction.void_reason ? `: ${transaction.void_reason}` : ""}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
