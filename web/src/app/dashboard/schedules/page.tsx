"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import type { DoctorWithProfile, DoctorSchedule, ScheduleException } from "@m-care/shared";
import { formatManilaDate, manilaDateKey, userFacingErrorMessage } from "@m-care/shared";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SchedulesPage() {
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Exception Form Modal
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionDate, setExceptionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [isFullDay, setIsFullDay] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchDoctors = useCallback(async () => {
    const { data } = await supabase
      .from("doctors")
      .select(`*, profile:profiles (*)`)
      .order("specialty");

    if (data && data.length > 0) {
      setDoctors(data as unknown as DoctorWithProfile[]);
      if (!selectedDoctorId) {
        setSelectedDoctorId(data[0].id);
      }
    }
  }, [selectedDoctorId, supabase]);

  const fetchDoctorSchedule = useCallback(async () => {
    if (!selectedDoctorId) return;
    setLoading(true);
    try {
      const [schedRes, excRes] = await Promise.all([
        supabase
          .from("doctor_schedules")
          .select("*")
          .eq("doctor_id", selectedDoctorId)
          .order("weekday")
          .order("start_time"),
        supabase
          .from("schedule_exceptions")
          .select("*")
          .eq("doctor_id", selectedDoctorId)
          .gte("exception_date", manilaDateKey())
          .order("exception_date"),
      ]);

      if (schedRes.data) setSchedules(schedRes.data as DoctorSchedule[]);
      if (excRes.data) setExceptions(excRes.data as ScheduleException[]);
    } catch (err) {
      console.error("Error fetching schedules:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, supabase]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    fetchDoctorSchedule();
  }, [fetchDoctorSchedule]);

  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !exceptionDate) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("schedule_exceptions").insert({
        doctor_id: selectedDoctorId,
        exception_date: exceptionDate,
        start_time: isFullDay ? null : startTime || null,
        end_time: isFullDay ? null : endTime || null,
        reason: reason.trim() || null,
        is_blocked: true,
      });

      if (error) throw error;

      setShowExceptionModal(false);
      setExceptionDate("");
      setStartTime("");
      setEndTime("");
      setReason("");
      await fetchDoctorSchedule();
    } catch (err: unknown) {
      const message = userFacingErrorMessage(err, "We couldn’t block this time. Refresh the schedule and try again.");
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteException = async (id: string) => {
    if (!confirm("Are you sure you want to unblock this date?")) return;
    try {
      const { error } = await supabase.from("schedule_exceptions").delete().eq("id", id);
      if (error) throw error;
      await fetchDoctorSchedule();
    } catch (err: unknown) {
      const message = userFacingErrorMessage(err, "We couldn’t remove this schedule block. Refresh and try again.");
      alert(message);
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-base-content tracking-tight">Doctor Schedules & Leave</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Configure weekly clinic hours, blocked times, and conference leave days
          </p>
        </div>

        <button
          onClick={() => setShowExceptionModal(true)}
          className="px-4 py-2 bg-primary hover:bg-primary-focus text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
        >
          <span>+</span>
          <span>Add Leave / Blocked Day</span>
        </button>
      </div>

      {/* Content Columns: Weekly Schedule vs Schedule Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Consultation Hours */}
        <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-300">
            <div>
              <h2 className="text-base font-bold text-base-content">Weekly Clinical Hours</h2>
              <p className="text-xs text-base-content/70">Regular clinic consultation shifts</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
              {selectedDoctor?.room ?? "Consultation Room"}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-base-content/60">Loading hours...</div>
          ) : schedules.length === 0 ? (
            <div className="py-12 text-center text-xs text-base-content/60">
              No recurring weekly hours found for this physician.
            </div>
          ) : (
            <div className="space-y-3">
              {WEEKDAYS.map((dayName, weekdayIdx) => {
                const daySchedules = schedules.filter((s) => s.weekday === weekdayIdx);
                const hasHours = daySchedules.length > 0;

                return (
                  <div
                    key={weekdayIdx}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                      hasHours
                        ? "bg-emerald-50/40 border-emerald-200 text-base-content"
                        : "bg-base-200/50 border-base-300 text-base-content/60"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${hasHours ? "bg-emerald-500" : "bg-gray-300"}`} />
                      <span className="font-bold">{dayName}</span>
                    </div>

                    <div>
                      {hasHours ? (
                        <div className="flex space-x-2">
                          {daySchedules.map((s) => (
                            <span
                              key={s.id}
                              className="font-mono bg-base-100 px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-800 font-bold"
                            >
                              {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="italic">Not scheduled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Schedule Exceptions & Leaves */}
        <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-300">
            <div>
              <h2 className="text-base font-bold text-base-content">Upcoming Leave & Exceptions</h2>
              <p className="text-xs text-base-content/70">Dates when booking slots are blocked</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200">
              {exceptions.length} Blocked
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-base-content/60">Loading exceptions...</div>
          ) : exceptions.length === 0 ? (
            <div className="py-12 text-center text-xs text-base-content/60 bg-base-200/50 rounded-xl border border-dashed border-base-300">
              No upcoming leaves or blocked times recorded for this physician.
            </div>
          ) : (
            <div className="space-y-3">
              {exceptions.map((exc) => (
                <div
                  key={exc.id}
                  className="p-3.5 bg-rose-50/40 border border-rose-200 rounded-xl flex items-start justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-rose-900">
                        {formatManilaDate(exc.exception_date, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-rose-200 text-rose-800">
                        {exc.start_time ? `${exc.start_time.slice(0, 5)} - ${exc.end_time?.slice(0, 5)}` : "All Day Leave"}
                      </span>
                    </div>
                    <p className="text-rose-700 mt-1 font-medium">{exc.reason || "Scheduled clinic leave"}</p>
                  </div>

                  <button
                    onClick={() => handleDeleteException(exc.id)}
                    className="text-base-content/60 hover:text-red-600 font-bold p-1"
                    title="Remove leave block"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Exception Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-300">
            <h3 className="text-lg font-bold text-base-content mb-1">
              Block Date / Record Leave
            </h3>
            <p className="text-xs text-base-content/70 mb-4">
              Physician: <strong>{selectedDoctor?.profile.full_name}</strong>
            </p>

            <form onSubmit={handleAddException} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-base-content block mb-1">
                  Exception Date *
                </label>
                <input
                  type="date"
                  required
                  value={exceptionDate}
                  aria-label="Exception Date" onChange={(e) => setExceptionDate(e.target.value)}
                  className="w-full text-xs font-medium border border-base-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-xs font-semibold text-base-content mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFullDay}
                    onChange={(e) => setIsFullDay(e.target.checked)}
                    className="rounded text-primary focus:ring-pink-500"
                  />
                  <span>Block Entire Day</span>
                </label>

                {!isFullDay && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-xs text-base-content/70 block mb-1">Start Time</span>
                      <input
                        type="time"
                        value={startTime}
                        aria-label="Start Time" onChange={(e) => setStartTime(e.target.value)}
                        className="w-full text-xs border border-base-300 rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-base-content/70 block mb-1">End Time</span>
                      <input
                        type="time"
                        value={endTime}
                        aria-label="End Time" onChange={(e) => setEndTime(e.target.value)}
                        className="w-full text-xs border border-base-300 rounded-lg p-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content block mb-1">
                  Reason for Absence
                </label>
                <input
                  type="text"
                  value={reason}
                  aria-label="Reason" onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs font-medium border border-base-300 rounded-lg p-2.5"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800 leading-relaxed border border-amber-200">
                <Icon name="alert" size={15} className="mr-1 inline-block align-[-2px]" /> Adding this exception removes all slots on this date from patient booking.
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(false)}
                  className="px-4 py-2 border border-base-300 text-base-content/80 rounded-lg text-xs font-semibold hover:bg-base-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-focus transition"
                >
                  {saving ? "Saving..." : "Save Exception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

