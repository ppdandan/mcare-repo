"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addCalendarDays,
  formatManilaDate,
  formatManilaTime,
  manilaDateKey,
  weekdayForDateKey,
  userFacingErrorMessage,
} from "@m-care/shared";
import type { AppointmentStatus, AppointmentWithDetails } from "@m-care/shared";

type CalendarView = "list" | "week" | "month";
type ActionKind = "approve" | "decline" | "cancel" | "complete";
type WorkflowAction = { kind: ActionKind; appointment: AppointmentWithDetails };
type AvailableSlot = { slot_start: string; slot_end: string };

const statusLabels: Record<AppointmentStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

const statusColors: Record<AppointmentStatus, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rescheduled: "badge-info",
  completed: "badge-neutral",
  cancelled: "badge-error",
  no_show: "badge-warning badge-outline",
};

function dateKeyForUtc(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12)).toISOString().slice(0, 10);
}

function monthDays(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const first = dateKeyForUtc(year, month - 1, 1);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = weekdayForDateKey(first);
  const total = Math.ceil((leading + count) / 7) * 7;
  return Array.from({ length: total }, (_, index) => dateKeyForUtc(year, month - 1, index - leading + 1));
}

function moveMonth(dateKey: string, delta: number) {
  const [year, month] = dateKey.split("-").map(Number);
  return dateKeyForUtc(year, month - 1 + delta, 1);
}

function nextWeekday(dateKey: string) {
  let day = dateKey;
  while (weekdayForDateKey(day) === 0 || weekdayForDateKey(day) === 6) day = addCalendarDays(day, 1);
  return day;
}

function patientName(appointment: AppointmentWithDetails) {
  return appointment.patient?.profile?.full_name ?? "Patient";
}

export default function AppointmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(manilaDateKey());
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<WorkflowAction | null>(null);
  const [reason, setReason] = useState("");
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentWithDetails | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleMonth, setRescheduleMonth] = useState(manilaDateKey());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`*, patient:patients (*, profile:profiles (*)), doctor:doctors (*, profile:profiles (*)), service:services (*)`)
        .order("start_time", { ascending: true });
      if (error) throw error;
      setAppointments((data ?? []) as unknown as AppointmentWithDetails[]);
    } catch (err) {
      setLoadError(userFacingErrorMessage(err, "We couldn’t load appointments. Check your connection and retry."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const dispatchPatientPush = useCallback(async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("dispatch-appointment-notification", {
        body: { appointment_id: appointmentId },
      });
      if (error) return "Push dispatch is unavailable; the in-app notice is saved.";
      if (data?.pushed) return "Push notification sent.";
      if (data?.reason === "No registered device") return "No device is registered for push; the in-app notice is saved.";
      return "The in-app notice is saved.";
    } catch {
      return "Push dispatch is unavailable; the in-app notice is saved.";
    }
  }, [supabase]);

  useEffect(() => {
    void fetchAppointments();
    const channel = supabase
      .channel("staff_appointments_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void fetchAppointments())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchAppointments, supabase]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (active) setRole(data?.role ?? null);
    })();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!rescheduleAppointment || !rescheduleDate) return;
    setSlots([]);
    setSelectedSlot("");
    setSlotsError(null);
    if (rescheduleDate < manilaDateKey() || [0, 6].includes(weekdayForDateKey(rescheduleDate))) return;
    let active = true;
    setSlotsLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_doctor_id: rescheduleAppointment.doctor_id,
        p_target_date: rescheduleDate,
        p_slot_duration_minutes: rescheduleAppointment.service?.duration_minutes ?? 30,
        p_timezone: "Asia/Manila",
      });
      if (!active) return;
      if (error) {
        setSlotsError(userFacingErrorMessage(error, "We couldn’t load available times. Choose another date or retry."));
      } else {
        const available = (data ?? []) as AvailableSlot[];
        setSlots(available);
        setSelectedSlot(available[0]?.slot_start ?? "");
      }
      setSlotsLoading(false);
    })();
    return () => { active = false; };
  }, [rescheduleAppointment, rescheduleDate, supabase]);

  const pending = useMemo(() => appointments.filter((appointment) => appointment.status === "pending"), [appointments]);
  const filtered = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const day = manilaDateKey(appointment.start_time);
      return (statusFilter === "all" || appointment.status === statusFilter)
        && (!dateFrom || day >= dateFrom)
        && (!dateTo || day <= dateTo)
        && (!search || patientName(appointment).toLowerCase().includes(search));
    });
  }, [appointments, dateFrom, dateTo, patientSearch, statusFilter]);

  const openReschedule = (appointment: AppointmentWithDetails) => {
    const day = nextWeekday(manilaDateKey());
    setRescheduleAppointment(appointment);
    setRescheduleDate(day);
    setRescheduleMonth(day);
    setFeedback(null);
  };

  const performAction = async () => {
    if (!actionDialog) return;
    if ((actionDialog.kind === "cancel" || actionDialog.kind === "decline") && !reason.trim()) {
      setFeedback({ kind: "error", message: `Enter a reason to ${actionDialog.kind} this appointment.` });
      return;
    }
    setUpdating(true);
    setFeedback(null);
    try {
      const id = actionDialog.appointment.id;
      const result = actionDialog.kind === "approve"
        ? await supabase.rpc("approve_appointment", { p_appointment_id: id })
        : actionDialog.kind === "complete"
        ? await supabase.rpc("complete_appointment", { p_appointment_id: id })
        : actionDialog.kind === "decline"
        ? await supabase.rpc("decline_appointment", { p_appointment_id: id, p_reason: reason.trim() })
        : await supabase.rpc("cancel_appointment", { p_appointment_id: id, p_reason: reason.trim() });
      if (result.error) throw result.error;
      const kind = actionDialog.kind;
      setActionDialog(null);
      setReason("");
      const pushNote = await dispatchPatientPush(id);
      await fetchAppointments();
      const actionPastTense = { approve: "approved", decline: "declined", cancel: "cancelled", complete: "completed" }[kind];
      setFeedback({ kind: "success", message: `Appointment ${actionPastTense}. ${pushNote}` });
    } catch (err) {
      setFeedback({ kind: "error", message: userFacingErrorMessage(err, "We couldn’t update this appointment. Refresh and try again.") });
    } finally {
      setUpdating(false);
    }
  };

  const saveReschedule = async () => {
    if (!rescheduleAppointment || !selectedSlot) return;
    setUpdating(true);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc("reschedule_appointment", {
        p_appointment_id: rescheduleAppointment.id,
        p_start_time: selectedSlot,
      });
      if (error) throw error;
      setRescheduleAppointment(null);
      const pushNote = await dispatchPatientPush(rescheduleAppointment.id);
      await fetchAppointments();
      setFeedback({ kind: "success", message: `Appointment rescheduled. ${pushNote}` });
    } catch (err) {
      setSlotsError(userFacingErrorMessage(err, "We couldn’t reschedule this appointment. Choose another slot and retry."));
    } finally {
      setUpdating(false);
    }
  };

  const calendarDays = useMemo(() => {
    if (view === "month") return monthDays(currentDate);
    if (view === "week") {
      const start = addCalendarDays(currentDate, -weekdayForDateKey(currentDate));
      return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
    }
    return [currentDate];
  }, [currentDate, view]);

  const canManage = role === "admin" || role === "receptionist";
  const canComplete = role === "doctor";
  const actionTitle = actionDialog?.kind === "approve" ? "Approve appointment"
    : actionDialog?.kind === "decline" ? "Decline request"
    : actionDialog?.kind === "cancel" ? "Cancel appointment"
    : "Complete appointment";

  const startAction = (kind: ActionKind, appointment: AppointmentWithDetails) => {
    setReason("");
    setFeedback(null);
    setActionDialog({ kind, appointment });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Appointment approval workspace</h1>
          <p className="mt-1 text-sm text-base-content/70">Review mobile booking requests and manage the clinic calendar.</p>
        </div>
        <div className="join" aria-label="Appointment display">
          <button className={`btn join-item ${view === "list" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("list")} aria-pressed={view === "list"}>List</button>
          <button className={`btn join-item ${view === "week" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("week")} aria-pressed={view === "week"}>Week</button>
          <button className={`btn join-item ${view === "month" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("month")} aria-pressed={view === "month"}>Month</button>
        </div>
      </header>

      {feedback && <div role="alert" className={`alert ${feedback.kind === "success" ? "alert-success" : "alert-error"}`}><span>{feedback.message}</span><button className="btn btn-ghost btn-sm" onClick={() => setFeedback(null)} aria-label="Dismiss message">Dismiss</button></div>}

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">Pending requests</h2>
            <span className="badge badge-warning">{pending.length}</span>
          </div>
          {pending.length === 0 ? <p className="text-sm text-base-content/70">There are no pending booking requests.</p> : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr><th>Patient</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{pending.map((appointment) => (
                  <tr key={appointment.id}>
                    <th>{patientName(appointment)}</th>
                    <td>{appointment.service?.name ?? "Service"}</td>
                    <td>{formatManilaDate(appointment.start_time, { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td>{formatManilaTime(appointment.start_time)}</td>
                    <td><span className={`badge ${statusColors.pending}`}>{statusLabels.pending}</span></td>
                    <td><div className="flex flex-wrap gap-2">
                      {canManage && <>
                        <button className="btn btn-primary btn-sm" disabled={updating} onClick={() => startAction("approve", appointment)}>Approve</button>
                        <button className="btn btn-outline btn-sm" disabled={updating} onClick={() => openReschedule(appointment)}>Reschedule</button>
                        <button className="btn btn-error btn-outline btn-sm" disabled={updating} onClick={() => startAction("decline", appointment)}>Decline</button>
                      </>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-5">
          <h2 className="text-lg font-bold">Appointments</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="form-control gap-1"><span className="label-text text-sm font-semibold">Status</span>
              <select className="select select-bordered" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option><option value="pending">Pending approval</option><option value="approved">Approved</option><option value="rescheduled">Rescheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No show</option>
              </select>
            </label>
            <label className="form-control gap-1"><span className="label-text text-sm font-semibold">From date</span><input className="input input-bordered" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label className="form-control gap-1"><span className="label-text text-sm font-semibold">To date</span><input className="input input-bordered" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
            <label className="form-control gap-1"><span className="label-text text-sm font-semibold">Patient name</span><input className="input input-bordered" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} /></label>
          </div>

          {loading ? <div className="flex min-h-40 items-center justify-center gap-3" role="status"><span className="loading loading-spinner loading-md text-primary" /><span>Loading appointments</span></div>
            : loadError ? <div role="alert" className="alert alert-error"><span>{loadError}</span><button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); void fetchAppointments(); }}>Retry</button></div>
            : view === "list" ? (
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-sm table-pin-rows">
                  <thead><tr><th>Patient</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>{filtered.map((appointment) => <tr key={appointment.id}>
                    <th>{patientName(appointment)}</th><td>{appointment.service?.name ?? "Service"}</td>
                    <td>{formatManilaDate(appointment.start_time, { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td>{formatManilaTime(appointment.start_time)}</td>
                    <td><span className={`badge ${statusColors[appointment.status]}`}>{statusLabels[appointment.status]}</span></td>
                    <td><div className="flex flex-wrap gap-1.5">
                      {canManage && appointment.status === "pending" && <button className="btn btn-primary btn-xs" disabled={updating} onClick={() => startAction("approve", appointment)}>Approve</button>}
                      {canManage && ["pending", "approved", "rescheduled"].includes(appointment.status) && <>
                        <button className="btn btn-outline btn-xs" disabled={updating} onClick={() => openReschedule(appointment)}>Reschedule</button>
                        {appointment.status === "pending" && <button className="btn btn-error btn-outline btn-xs" disabled={updating} onClick={() => startAction("decline", appointment)}>Decline</button>}
                        <button className="btn btn-error btn-outline btn-xs" disabled={updating} onClick={() => startAction("cancel", appointment)}>Cancel</button>
                      </>}
                      {canComplete && ["approved", "rescheduled"].includes(appointment.status) && <button className="btn btn-primary btn-xs" disabled={updating} onClick={() => startAction("complete", appointment)}>Complete</button>}
                      <button className="btn btn-ghost btn-xs" onClick={() => setSelectedAppointment(appointment)}>View</button>
                    </div></td>
                  </tr>)}</tbody>
                </table>
                {filtered.length === 0 && <p className="p-5 text-sm text-base-content/70">No appointments match these filters.</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{view === "month" ? formatManilaDate(`${currentDate.slice(0, 7)}-01`, { month: "long", year: "numeric" }) : `Week of ${formatManilaDate(calendarDays[0], { month: "short", day: "numeric" })}`}</h3>
                  <div className="flex gap-2">
                    <button className="btn btn-outline btn-sm" aria-label="Previous period" onClick={() => setCurrentDate(view === "month" ? moveMonth(currentDate, -1) : addCalendarDays(currentDate, -7))}>Previous</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setCurrentDate(manilaDateKey())}>Today</button>
                    <button className="btn btn-outline btn-sm" aria-label="Next period" onClick={() => setCurrentDate(view === "month" ? moveMonth(currentDate, 1) : addCalendarDays(currentDate, 7))}>Next</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-box border border-base-300 bg-base-300">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <div key={day} className="bg-base-200 px-2 py-2 text-center text-xs font-semibold">{day.slice(0, 3)}</div>)}
                  {calendarDays.map((day) => {
                    const dayAppointments = filtered.filter((appointment) => manilaDateKey(appointment.start_time) === day);
                    const outsideMonth = view === "month" && day.slice(0, 7) !== currentDate.slice(0, 7);
                    return <section key={day} className={`min-h-28 bg-base-100 p-1.5 sm:min-h-36 sm:p-2 ${outsideMonth ? "opacity-50" : ""}`} aria-label={formatManilaDate(day, { month: "long", day: "numeric", year: "numeric" })}>
                      <p className={`mb-1 text-right text-xs font-semibold ${day === manilaDateKey() ? "text-primary" : "text-base-content/70"}`}>{Number(day.slice(8, 10))}</p>
                      <div className="space-y-1">
                        {dayAppointments.map((appointment) => <button key={appointment.id} className="block w-full rounded-field border border-base-300 bg-base-200 p-1.5 text-left text-xs hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setSelectedAppointment(appointment)}>
                          <span className="block truncate font-semibold">{formatManilaTime(appointment.start_time)} · {patientName(appointment)}</span>
                          <span className="block truncate text-base-content/70">{appointment.service?.name ?? "Service"}</span>
                          <span className={`badge badge-xs mt-1 ${statusColors[appointment.status]}`}>{statusLabels[appointment.status]}</span>
                        </button>)}
                      </div>
                    </section>;
                  })}
                </div>
                {filtered.length === 0 && <p className="text-sm text-base-content/70">No appointments match these filters.</p>}
              </div>
            )}
        </div>
      </section>

      {actionDialog && <div className="modal modal-open" role="presentation"><div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="appointment-action-title">
        <h2 id="appointment-action-title" className="text-lg font-bold">{actionTitle}</h2>
        <p className="mt-2 text-sm text-base-content/75">{patientName(actionDialog.appointment)} · {actionDialog.appointment.service?.name ?? "Appointment"} · {formatManilaDate(actionDialog.appointment.start_time, { month: "short", day: "numeric" })} at {formatManilaTime(actionDialog.appointment.start_time)}</p>
        {actionDialog.kind === "cancel" || actionDialog.kind === "decline" ? <label className="form-control mt-4 gap-1"><span className="label-text font-semibold">Reason</span><textarea className="textarea textarea-bordered min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} required /></label> : <p className="mt-4 text-sm">Confirm this appointment action.</p>}
        <div className="modal-action"><button className="btn btn-outline" disabled={updating} onClick={() => setActionDialog(null)}>Keep appointment</button><button className={`btn ${actionDialog.kind === "cancel" || actionDialog.kind === "decline" ? "btn-error" : "btn-primary"}`} disabled={updating} onClick={() => void performAction()}>{updating && <span className="loading loading-spinner loading-xs" />}{updating ? "Saving" : "Confirm"}</button></div>
        {feedback?.kind === "error" && <p role="alert" className="mt-3 text-sm text-error">{feedback.message}</p>}
      </div><button className="modal-backdrop" aria-label="Close confirmation" onClick={() => !updating && setActionDialog(null)} /></div>}

      {rescheduleAppointment && <div className="modal modal-open" role="presentation"><div className="modal-box max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
        <h2 id="reschedule-title" className="text-lg font-bold">Reschedule appointment</h2>
        <p className="mt-1 text-sm text-base-content/75">{patientName(rescheduleAppointment)} · {rescheduleAppointment.service?.name ?? "Appointment"}</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_18rem]">
          <section aria-label="Choose a weekday">
            <div className="mb-3 flex items-center justify-between"><button className="btn btn-outline btn-sm" aria-label="Previous month" onClick={() => setRescheduleMonth(moveMonth(rescheduleMonth, -1))}>Previous</button><h3 className="font-semibold">{formatManilaDate(`${rescheduleMonth.slice(0, 7)}-01`, { month: "long", year: "numeric" })}</h3><button className="btn btn-outline btn-sm" aria-label="Next month" onClick={() => setRescheduleMonth(moveMonth(rescheduleMonth, 1))}>Next</button></div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}${index}`} className="py-1 font-semibold text-base-content/70">{day}</span>)}
              {monthDays(rescheduleMonth).map((day) => {
                const disabled = day < manilaDateKey() || [0, 6].includes(weekdayForDateKey(day));
                const outside = day.slice(0, 7) !== rescheduleMonth.slice(0, 7);
                return <button key={day} type="button" disabled={disabled} aria-pressed={rescheduleDate === day} onClick={() => { setRescheduleDate(day); setRescheduleMonth(day); }} className={`btn btn-sm min-h-9 px-0 ${rescheduleDate === day ? "btn-primary" : "btn-ghost"} ${outside ? "opacity-40" : ""} disabled:opacity-25`}>{Number(day.slice(8, 10))}</button>;
              })}
            </div>
          </section>
          <section aria-label="Available appointment times">
            <h3 className="mb-2 font-semibold">Available times</h3>
            {slotsLoading ? <div className="flex items-center gap-2 text-sm" role="status"><span className="loading loading-spinner loading-sm" />Checking availability</div>
              : slotsError ? <div role="alert" className="alert alert-error text-sm"><span>{slotsError}</span></div>
              : slots.length === 0 ? <p className="text-sm text-base-content/70">No available times for this date.</p>
              : <div className="grid grid-cols-2 gap-2">{slots.map((slot) => <button key={slot.slot_start} className={`btn btn-sm ${selectedSlot === slot.slot_start ? "btn-primary" : "btn-outline"}`} aria-pressed={selectedSlot === slot.slot_start} onClick={() => setSelectedSlot(slot.slot_start)}>{formatManilaTime(slot.slot_start)}</button>)}</div>}
          </section>
        </div>
        <div className="modal-action"><button className="btn btn-outline" disabled={updating} onClick={() => setRescheduleAppointment(null)}>Close</button><button className="btn btn-primary" disabled={updating || slotsLoading || !selectedSlot} onClick={() => void saveReschedule()}>{updating && <span className="loading loading-spinner loading-xs" />}{updating ? "Saving" : "Confirm reschedule"}</button></div>
      </div><button className="modal-backdrop" aria-label="Close reschedule" onClick={() => !updating && setRescheduleAppointment(null)} /></div>}

      {selectedAppointment && <div className="modal modal-open" role="presentation"><div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
        <h2 id="appointment-detail-title" className="text-lg font-bold">Appointment details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Patient</dt><dd>{patientName(selectedAppointment)}</dd></div><div><dt className="font-semibold">Service</dt><dd>{selectedAppointment.service?.name ?? "Service"}</dd></div><div><dt className="font-semibold">Date</dt><dd>{formatManilaDate(selectedAppointment.start_time, { year: "numeric", month: "long", day: "numeric" })}</dd></div><div><dt className="font-semibold">Time</dt><dd>{formatManilaTime(selectedAppointment.start_time)}</dd></div><div><dt className="font-semibold">Status</dt><dd><span className={`badge ${statusColors[selectedAppointment.status]}`}>{statusLabels[selectedAppointment.status]}</span></dd></div></dl>
        <div className="modal-action"><button className="btn btn-primary" onClick={() => setSelectedAppointment(null)}>Close</button></div>
      </div><button className="modal-backdrop" aria-label="Close appointment details" onClick={() => setSelectedAppointment(null)} /></div>}
    </div>
  );
}
