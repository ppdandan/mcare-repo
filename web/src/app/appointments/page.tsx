"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatManilaDateTime } from "@m-care/shared";
import type { AppointmentWithDetails } from "@m-care/shared";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";

const cancelableStatuses = new Set(["pending", "approved", "rescheduled"]);

function statusClass(status: string) {
  switch (status) {
    case "approved": return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "rescheduled": return "border-blue-300 bg-blue-50 text-blue-900";
    case "completed": return "border-gray-300 bg-gray-100 text-gray-800";
    case "cancelled": return "border-red-300 bg-red-50 text-red-900";
    case "no_show": return "border-amber-300 bg-amber-50 text-amber-900";
    default: return "border-amber-300 bg-amber-50 text-amber-900";
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
    <main className="min-h-screen bg-rose-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PatientHeader active="/appointments" />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Appointments</h1>
            <p className="mt-2 text-base text-gray-700">Appointment dates and times are shown in Asia/Manila.</p>
          </div>
          <button type="button" onClick={() => void loadAppointments(true)} disabled={refreshing} className="rounded-xl border border-gray-400 bg-white px-4 py-2.5 font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-60">
            {refreshing ? "Refreshing…" : "Refresh appointments"}
          </button>
        </div>

        {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-semibold text-emerald-950">{notice}</p>}
        {actionError && <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">{actionError}</p>}

        {loading ? (
          <div role="status" className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-700 shadow-sm"><span className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-rose-800 border-t-transparent" /><p>Loading appointments…</p></div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-300 bg-white p-6 text-red-950 shadow-sm"><p>{error}</p><button type="button" onClick={() => void loadAppointments()} className="mt-4 rounded-lg bg-rose-800 px-4 py-2 font-semibold text-white">Retry</button></div>
        ) : appointments.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-bold text-gray-900">No appointments yet</h2><p className="mt-2 text-gray-700">Book a clinic visit to see it here.</p><a href="/book" className="mt-5 inline-flex rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900">Book an appointment</a></div>
        ) : (
          <ul className="space-y-4">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{appointment.service?.name ?? "Clinic visit"}</h2>
                    <p className="mt-1 text-sm text-gray-700">Dr. Bernice Paule · OB-GYNE / Sonologist</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatManilaDateTime(appointment.start_time)}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusClass(appointment.status)}`}>{appointment.status.replace("_", " ")}</span>
                </div>
                <p className="mt-3 text-xs text-gray-600">Reference: MC-{appointment.id.slice(0, 8).toUpperCase()}</p>
                {cancelableStatuses.has(appointment.status) && (
                  <button type="button" onClick={() => void cancelAppointment(appointment)} disabled={cancelingId === appointment.id} className="mt-4 rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-800 disabled:opacity-60">
                    {cancelingId === appointment.id ? "Cancelling…" : "Cancel appointment"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
