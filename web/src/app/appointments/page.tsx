"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatManilaDateTime } from "@m-care/shared";
import type { AppointmentWithDetails } from "@m-care/shared";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card, { CardBody } from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";
import StatusAlert from "@/components/ui/StatusAlert";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncStates";

const cancelableStatuses = new Set(["pending", "approved", "rescheduled"]);

function statusVariant(status: string): "success" | "info" | "neutral" | "error" | "warning" {
  switch (status) {
    case "approved": return "success";
    case "rescheduled": return "info";
    case "completed": return "neutral";
    case "cancelled": return "error";
    case "no_show": return "warning";
    default: return "warning";
  }
}

export default function PatientAppointmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAppointments = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign in required");
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", authData.user.id)
        .single();
      if (patientError) throw patientError;

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(`
          *,
          doctor:doctors (*, profile:profiles (*)),
          service:services (*)
        `)
        .eq("patient_id", patient.id)
        .order("start_time", { ascending: true });
      if (queryError) throw queryError;
      setAppointments((data ?? []) as unknown as AppointmentWithDetails[]);
    } catch (cause) {
      console.error("Unable to load patient appointments:", cause);
      setError("We couldn’t load your appointments. Check your connection and retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => { void loadAppointments(); }, [loadAppointments]);

  const cancelAppointment = async (appointment: AppointmentWithDetails) => {
    if (!window.confirm(`Cancel your ${appointment.service?.name ?? "appointment"}?`)) return;
    setCancelingId(appointment.id);
    setActionError(null);
    setNotice(null);
    try {
      const { error: cancelError } = await supabase.rpc("cancel_my_appointment", {
        p_appointment_id: appointment.id,
      });
      if (cancelError) throw cancelError;
      setNotice("Appointment cancelled. Refresh either app to see the updated status.");
      await loadAppointments(true);
    } catch (cause) {
      console.error("Appointment cancellation failed:", cause);
      setActionError("We couldn’t cancel this appointment. Refresh your visits and try again.");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <PageContainer className="max-w-4xl">
        <PatientHeader active="/appointments" />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-base-content">My Appointments</h1>
            <p className="mt-2 text-base text-base-content/80">Appointment dates and times are shown in Asia/Manila.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadAppointments(true)} loading={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh appointments"}
          </Button>
        </div>

        {notice && <StatusAlert variant="success" className="mb-4">{notice}</StatusAlert>}
        {actionError && <StatusAlert variant="error" className="mb-4">{actionError}</StatusAlert>}

        {loading ? (
          <LoadingState label="Loading appointments…" />
        ) : error ? (
          <ErrorState title="" description={error} onRetry={() => void loadAppointments()} />
        ) : appointments.length === 0 ? (
          <EmptyState title="No appointments yet" description="Book a clinic visit to see it here."><a href="/book" className="btn btn-primary mt-2 min-h-11 rounded-btn">Book an appointment</a></EmptyState>
        ) : (
          <ul className="space-y-4">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="list-none">
                <Card>
                  <CardBody className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-base-content">{appointment.service?.name ?? "Clinic visit"}</h2>
                    <p className="mt-1 text-sm text-base-content/80">Dr. Bernice Paule · OB-GYNE / Sonologist</p>
                    <p className="mt-1 text-sm font-semibold text-base-content">{formatManilaDateTime(appointment.start_time)}</p>
                  </div>
                  <Badge variant={statusVariant(appointment.status)} className="capitalize">{appointment.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-3 text-xs text-base-content/75">Reference: MC-{appointment.id.slice(0, 8).toUpperCase()}</p>
                {cancelableStatuses.has(appointment.status) && (
                  <Button type="button" variant="destructive" onClick={() => void cancelAppointment(appointment)} disabled={cancelingId === appointment.id} loading={cancelingId === appointment.id} className="mt-4">
                    {cancelingId === appointment.id ? "Cancelling…" : "Cancel appointment"}
                  </Button>
                )}
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
