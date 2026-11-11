"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentWithDetails } from "@m-care/shared";
import { formatManilaDateTime } from "@m-care/shared";

export default function DashboardOverviewPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [patientCount, setPatientCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const supabase = createClient();

  const fetchOverviewData = useCallback(async () => {
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

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "approved" })
        .eq("id", id);
      if (error) throw error;
      await fetchOverviewData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      await fetchOverviewData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Today's Clinic Overview</h1>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time appointment intake, doctor schedules, and patient triage monitoring
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/appointments"
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-xs shadow-sm transition"
          >
            Open Live Calendar →
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Triage</span>
            <span className="text-base">⏳</span>
          </div>
          <p className="text-3xl font-extrabold text-amber-600">
            {loading ? "..." : pendingAppointments.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Requires receptionist review</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed Bookings</span>
            <span className="text-base">✅</span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">
            {loading ? "..." : approvedAppointments.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Approved & active in system</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Consultations Today</span>
            <span className="text-base">🩺</span>
          </div>
          <p className="text-3xl font-extrabold text-pink-600">
            {loading ? "..." : todayAppointments.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Scheduled for {todayStr}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Registered Patients</span>
            <span className="text-base">👩</span>
          </div>
          <p className="text-3xl font-extrabold text-gray-900">
            {loading ? "..." : patientCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">DPA 2012 Consent Logged</p>
        </div>
      </div>

      {/* Urgent Pending Triage Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Pending Mobile Booking Requests ({pendingAppointments.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Patients booked from mobile app. Review doctor availability and confirm or reschedule.
            </p>
          </div>
          <Link
            href="/dashboard/appointments"
            className="text-xs font-semibold text-pink-600 hover:text-pink-700"
          >
            View all appointments →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Doctor & Room</th>
                <th className="py-3 px-4">Requested Date/Time</th>
                <th className="py-3 px-4">Patient Notes</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No pending booking requests. All appointments are reviewed!
                  </td>
                </tr>
              ) : (
                pendingAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {appt.patient?.profile?.full_name}
                      <span className="block text-[11px] text-gray-400 font-normal">
                        📞 {appt.patient?.profile?.phone}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">
                      {appt.service?.name}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {appt.doctor?.profile?.full_name}
                      <span className="block text-[10px] text-gray-400">
                        📍 {appt.doctor?.room}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-pink-600">
                      {formatManilaDateTime(appt.start_time, {
                        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-gray-500">
                      {appt.notes || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleApprove(appt.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs transition shadow-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleCancel(appt.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded text-xs border border-rose-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
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
