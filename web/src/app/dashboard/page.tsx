"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentWithDetails } from "@m-care/shared";
import { formatManilaDateTime } from "@m-care/shared";
import Icon from "@/components/Icon";
import { userFacingErrorMessage } from "@m-care/shared";

export default function DashboardOverviewPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [patientCount, setPatientCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchOverviewData = useCallback(async () => {
    setLoadError(null);
    try {
      const [apptRes, patRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            *,
            patient:patients (
              *,
              profile:profiles (*)
            ),
            doctor:doctors (
              *,
              profile:profiles (*)
            ),
            service:services (*)
          `)
          .order("start_time", { ascending: true }),
        supabase.from("patients").select("id", { count: "exact", head: true }),
      ]);

      if (apptRes.data) setAppointments(apptRes.data as unknown as AppointmentWithDetails[]);
      if (patRes.count !== null) setPatientCount(patRes.count);
    } catch (err) {
      console.error("Error loading dashboard overview:", err);
      setLoadError(userFacingErrorMessage(err, "We couldn’t load the clinic overview."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOverviewData();

    // Realtime channel
    const channel = supabase
      .channel("dashboard_overview_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => fetchOverviewData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOverviewData, supabase]);

  // Metrics computed using Asia/Manila clinic local time (UTC+8)
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());

  const pendingAppointments = appointments.filter((a) => a.status === "pending");
  const approvedAppointments = appointments.filter((a) => a.status === "approved");
  const todayAppointments = appointments.filter((a) => {
    if (!a.start_time) return false;
    const apptDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
    }).format(new Date(a.start_time));
    return apptDate === todayStr;
  });

  return (
    <div className="space-y-8">
      {/* Overview Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-base-content tracking-tight">Today's Clinic Overview</h1>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-sm text-base-content/70 mt-1">
            Real-time appointment intake, doctor schedules, and patient triage monitoring
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/appointments"
            className="inline-flex min-h-11 items-center px-4 bg-primary hover:bg-primary-focus text-white font-semibold rounded-xl text-xs shadow-sm transition"
          >
            Open Live Calendar →
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <div className="flex items-center justify-between text-base-content/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Triage</span>
            <Icon name="clock" size={18} />
          </div>
          <p className="text-3xl font-extrabold text-amber-600">
            {loading ? "..." : pendingAppointments.length}
          </p>
          <p className="text-xs text-base-content/70 mt-1">Requires receptionist review</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <div className="flex items-center justify-between text-base-content/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed Bookings</span>
            <Icon name="check-circle" size={18} />
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">
            {loading ? "..." : approvedAppointments.length}
          </p>
          <p className="text-xs text-base-content/70 mt-1">Approved & active in system</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <div className="flex items-center justify-between text-base-content/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Consultations Today</span>
            <Icon name="stethoscope" size={18} />
          </div>
          <p className="text-3xl font-extrabold text-primary">
            {loading ? "..." : todayAppointments.length}
          </p>
          <p className="text-xs text-base-content/70 mt-1">Scheduled for {todayStr}</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <div className="flex items-center justify-between text-base-content/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Registered Patients</span>
            <Icon name="users" size={18} />
          </div>
          <p className="text-3xl font-extrabold text-base-content">
            {loading ? "..." : patientCount}
          </p>
          <p className="text-xs text-base-content/70 mt-1">DPA 2012 Consent Logged</p>
        </div>
      </div>

      {/* Urgent Pending Triage Table */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-base-content">
              Pending Mobile Booking Requests ({pendingAppointments.length})
            </h2>
            <p className="text-xs text-base-content/70 mt-0.5">
              Patients booked from mobile app. Review doctor availability and confirm or reschedule.
            </p>
          </div>
          <Link
            href="/dashboard/appointments"
            className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:text-primary-focus"
          >
            View all appointments →
          </Link>
        </div>

        {loadError && <div role="alert" className="alert alert-error m-4"><span>{loadError}</span><button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); void fetchOverviewData(); }}>Retry</button></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-200/75 border-b border-base-300 text-base-content/60 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Doctor & Room</th>
                <th className="py-3 px-4">Requested Date/Time</th>
                <th className="py-3 px-4">Patient Notes</th>
                <th className="py-3 px-4 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {pendingAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-base-content/60">
                    No pending booking requests. All appointments are reviewed!
                  </td>
                </tr>
              ) : (
                pendingAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3.5 px-4 font-bold text-base-content">
                      {appt.patient?.profile?.full_name}
                      <span className="block text-xs text-base-content/60 font-normal">
                        Phone: {appt.patient?.profile?.phone || "Not provided"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-base-content">
                      {appt.service?.name}
                    </td>
                    <td className="py-3.5 px-4 text-base-content">
                      {appt.doctor?.profile?.full_name}
                      <span className="block text-xs text-base-content/60">
                        Room: {appt.doctor?.room || "Not assigned"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-primary">
                      {formatManilaDateTime(appt.start_time, {
                        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-base-content/70">
                      {appt.notes || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href="/dashboard/appointments" className="btn btn-primary btn-sm">Review request</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
