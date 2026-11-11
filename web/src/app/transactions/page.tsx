"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatManilaDate, formatManilaDateTime } from "@m-care/shared";
import type { TransactionWithAppointment } from "@m-care/shared";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";
import Icon from "@/components/Icon";
import PageContainer from "@/components/ui/PageContainer";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncStates";

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
    <div className="min-h-screen bg-base-200">
      <PageContainer className="max-w-4xl">
        <PatientHeader active="/transactions" />

        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-base-content">Transaction History</h1>
          <p className="mt-2 text-base text-base-content/80">Payments are made in person at the clinic. This page only shows records added after completed visits; it does not collect payments.</p>
        </div>

        {loading ? (
          <LoadingState label="Loading transaction history…" />
        ) : error ? (
          <ErrorState title="History unavailable" description={error} onRetry={() => void loadTransactions()} />
        ) : transactions.length === 0 ? (
          <EmptyState title="No transactions yet" description="When a clinic visit is completed and paid in person, the clinic can record it here for your reference.">
            <Icon name="receipt" size={34} />
            <Link href="/book" className="btn btn-primary mt-2 min-h-11 rounded-btn">Book an appointment</Link>
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="list-none">
                <Card>
                  <CardBody className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-base-content">{transaction.appointment?.service?.name ?? "Clinic service"}</h2>
                    <p className="mt-1 text-sm text-base-content/80">Appointment: {transaction.appointment?.start_time ? formatManilaDateTime(transaction.appointment.start_time) : "Date unavailable"}</p>
                  </div>
                  {transaction.voided_at && <Badge variant="error">Voided</Badge>}
                </div>
                <p className="mt-4 text-2xl font-extrabold text-primary">{formatAmount(transaction.amount, transaction.currency)}</p>
                <dl className="mt-4 grid gap-3 border-t border-base-300 pt-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-base-content/75">Payment method</dt><dd className="mt-1 font-semibold text-base-content">{transaction.payment_method}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-base-content/75">Recorded</dt><dd className="mt-1 font-semibold text-base-content">{formatManilaDate(transaction.created_at, { dateStyle: "medium" })}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-base-content/75">Reference</dt><dd className="mt-1 font-semibold text-base-content">MC-{transaction.id.slice(0, 8).toUpperCase()}</dd></div>
                  {transaction.notes && <div><dt className="text-xs font-semibold uppercase tracking-wide text-base-content/75">Notes</dt><dd className="mt-1 text-base-content">{transaction.notes}</dd></div>}
                </dl>
                {transaction.voided_at && <p className="mt-4 rounded-field bg-error/10 p-3 text-sm text-base-content">Voided {formatManilaDate(transaction.voided_at)}{transaction.void_reason ? `: ${transaction.void_reason}` : ""}</p>}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </div>
  );
}
