"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addCalendarDays,
  formatManilaDate,
  formatManilaTime,
  manilaDateKey,
  manilaDateTimeIso,
  manilaTimeKey,
  weekdayForDateKey,
} from "@m-care/shared";
import type { AppointmentWithDetails, AppointmentStatus } from "@m-care/shared";

type ViewMode = "list" | "calendar";
type CalendarViewType = "month" | "week" | "day";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarView, setCalendarView] = useState<CalendarViewType>("week");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentDate, setCurrentDate] = useState<string>(() => manilaDateKey());

  // Reschedule Modal
  const [rescheduleAppt, setRescheduleAppt] = useState<AppointmentWithDetails | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("09:00:00");
  const [updating, setUpdating] = useState(false);

  const supabase = createClient();

  const fetchAppointments = useCallback(async () => {
    try {
      const { data, error } = await supabase
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
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error loading appointments:", error);
      } else if (data) {
        setAppointments(data as unknown as AppointmentWithDetails[]);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAppointments();

    // Supabase Realtime Sync: calendar updates when mobile patient books or updates!
    const channel = supabase
      .channel("staff_appointments_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments, supabase]);

  const handleUpdateStatus = async (id: string, newStatus: AppointmentStatus) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      await fetchAppointments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update appointment";
      alert(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleAppt || !rescheduleDate || !rescheduleTime) {
      alert("Please choose date and time.");
      return;
    }

    setUpdating(true);
    try {
      const startIso = manilaDateTimeIso(rescheduleDate, rescheduleTime);
      const duration = rescheduleAppt.service?.duration_minutes || 30;
      const endD = new Date(new Date(startIso).getTime() + duration * 60000);
      const endIso = endD.toISOString();

      const { error } = await supabase
        .from("appointments")
        .update({
          start_time: startIso,
          end_time: endIso,
          status: "rescheduled",
        })
        .eq("id", rescheduleAppt.id);

      if (error) {
        if (error.code === "23P01" || error.message.includes("no_doctor_double_booking")) {
          alert("Double booking detected: Doctor is already occupied during this time window.");
          return;
        }
        throw error;
      }

      setRescheduleAppt(null);
      await fetchAppointments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not reschedule appointment";
      alert(message);
    } finally {
      setUpdating(false);
    }
  };

  // Filtered List
  const filtered = appointments.filter((a) => {
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesStatus;
  });

  const getStatusBadge = (status: AppointmentStatus) => {
    const styles: Record<AppointmentStatus, string> = {
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rescheduled: "bg-blue-100 text-blue-800 border-blue-200",
      completed: "bg-gray-100 text-gray-800 border-gray-200",
      cancelled: "bg-rose-100 text-rose-800 border-rose-200",
      no_show: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clinic Appointments</h1>
            <span className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Connected</span>
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time booking triage, doctor schedule allocation, and conflict management
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === "list"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📋 List View
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === "calendar"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🗓️ Calendar View
          </button>
        </div>
      </div>

      {/* Control Bar: Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Statuses ({appointments.length})</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

        </div>

        {viewMode === "calendar" && (
          <div className="flex items-center space-x-2">
            {(["month", "week", "day"] as CalendarViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setCalendarView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  calendarView === v
                    ? "bg-pink-100 text-pink-700 border border-pink-200"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Loading Appointments...
          </p>
        </div>
      ) : viewMode === "list" ? (
        /* LIST VIEW */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4">Doctor & Room</th>
                  <th className="py-3.5 px-4">Schedule</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No appointments match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((appt) => (
                    <tr key={appt.id} className="hover:bg-pink-50/30 transition">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-gray-900">
                          {appt.patient?.profile?.full_name ?? "Patient"}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          📞 {appt.patient?.profile?.phone ?? "No phone"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-gray-800">{appt.service?.name}</p>
                        <p className="text-[11px] text-gray-400">
                          ⏱️ {appt.service?.duration_minutes} mins
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-medium text-gray-900">
                          {appt.doctor?.profile?.full_name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          📍 {appt.doctor?.room ?? "Consultation Room"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-gray-900">
                          {formatManilaDate(appt.start_time, { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-[11px] text-pink-600 font-bold">
                          {formatManilaTime(appt.start_time)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(appt.status)}</td>

                      <td className="py-3.5 px-4 max-w-xs truncate text-gray-500">
                        {appt.notes || "—"}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {appt.status === "pending" && (
                            <button
                              onClick={() => handleUpdateStatus(appt.id, "approved")}
                              disabled={updating}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-[11px] transition shadow-sm"
                            >
                              Approve
                            </button>
                          )}

                          {appt.status === "approved" && (
                            <button
                              onClick={() => handleUpdateStatus(appt.id, "completed")}
                              disabled={updating}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] transition shadow-sm"
                            >
                              Mark Done
                            </button>
                          )}

                          {["pending", "approved", "rescheduled"].includes(appt.status) && (
                            <>
                              <button
                                onClick={() => {
                                  setRescheduleAppt(appt);
                                  setRescheduleDate(
                                    manilaDateKey(appt.start_time)
                                  );
                                  setRescheduleTime(manilaTimeKey(appt.start_time));
                                }}
                                disabled={updating}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded text-[11px] border border-purple-200 transition"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(appt.id, "cancelled")}
                                disabled={updating}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded text-[11px] border border-rose-200 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(appt.id, "no_show")}
                                disabled={updating}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded text-[11px] border border-amber-200 transition"
                              >
                                No Show
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CALENDAR VIEW (Day, Week, Month) */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (calendarView === "month") {
                    const [year, month, day] = currentDate.split("-").map(Number);
                    setCurrentDate(new Date(Date.UTC(year, month - 2, 1, 12)).toISOString().slice(0, 10));
                  } else {
                    setCurrentDate(addCalendarDays(currentDate, calendarView === "week" ? -7 : -1));
                  }
                }}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold"
              >
                ←
              </button>
              <h2 className="text-base font-bold text-gray-900">
                {formatManilaDate(currentDate, {
                  month: "long", year: "numeric",
                  ...(calendarView === "day" && { day: "numeric", weekday: "long" }),
                })}
              </h2>
              <button
                onClick={() => {
                  if (calendarView === "month") {
                    const [year, month, day] = currentDate.split("-").map(Number);
                    setCurrentDate(new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 10));
                  } else {
                    setCurrentDate(addCalendarDays(currentDate, calendarView === "week" ? 7 : 1));
                  }
                }}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold"
              >
                →
              </button>
            </div>

            <button
              onClick={() => setCurrentDate(manilaDateKey())}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
          </div>

          {/* Week View Grid */}
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => {
              const dayStr = addCalendarDays(currentDate, -weekdayForDateKey(currentDate) + i);
              const dayAppts = filtered.filter(
                (a) => manilaDateKey(a.start_time) === dayStr
              );

              return (
                <div
                  key={i}
                  className="bg-gray-50/75 rounded-xl p-3 border border-gray-100 min-h-[360px] flex flex-col"
                >
                  <div className="text-center pb-2 mb-2 border-b border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {formatManilaDate(dayStr, { weekday: "short" })}
                    </p>
                    <p
                      className={`text-sm font-extrabold mt-0.5 ${
                        dayStr === manilaDateKey()
                          ? "w-7 h-7 mx-auto rounded-full bg-pink-600 text-white flex items-center justify-center"
                          : "text-gray-800"
                      }`}
                    >
                      {Number(dayStr.slice(8, 10))}
                    </p>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayAppts.map((a) => (
                      <div
                        key={a.id}
                        className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs text-[11px]"
                      >
                        <p className="font-bold text-gray-900 truncate">
                          {a.patient?.profile?.full_name}
                        </p>
                        <p className="text-[10px] text-pink-600 font-semibold truncate">
                          {a.service?.name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          ⏰{" "}
                          {formatManilaTime(a.start_time)}
                        </p>
                        <div className="mt-1.5 flex justify-between items-center">
                          {getStatusBadge(a.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Reschedule Appointment
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Patient: <strong>{rescheduleAppt.patient?.profile?.full_name}</strong> • Doctor:{" "}
              <strong>{rescheduleAppt.doctor?.profile?.full_name}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  New Appointment Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  New Start Time (Manila Time)
                </label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="09:00:00">09:00 AM</option>
                  <option value="09:30:00">09:30 AM</option>
                  <option value="10:00:00">10:00 AM</option>
                  <option value="10:30:00">10:30 AM</option>
                  <option value="11:00:00">11:00 AM</option>
                  <option value="11:30:00">11:30 AM</option>
                  <option value="13:00:00">01:00 PM</option>
                  <option value="13:30:00">01:30 PM</option>
                  <option value="14:00:00">02:00 PM</option>
                  <option value="14:30:00">02:30 PM</option>
                  <option value="15:00:00">03:00 PM</option>
                  <option value="15:30:00">03:30 PM</option>
                  <option value="16:00:00">04:00 PM</option>
                </select>
              </div>

              <div className="p-3 bg-pink-50 rounded-lg text-[11px] text-pink-700 leading-relaxed">
                🛡️ The PostgreSQL exclusion constraint prevents double-booking. If the doctor already has an appointment during this time, the system will block it.
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setRescheduleAppt(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReschedule}
                disabled={updating}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition"
              >
                {updating ? "Saving..." : "Save Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

