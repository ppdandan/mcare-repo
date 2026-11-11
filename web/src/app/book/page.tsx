"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatManilaDate,
  formatManilaTime,
  manilaDateKey,
  manilaDateTimeIso,
  weekdayForDateKey,
} from "@m-care/shared";
import type { AvailableSlot, DoctorSchedule, DoctorWithProfile, Service } from "@m-care/shared";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";

type BookingSlot = AvailableSlot & { available: boolean };

function friendlyMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (/weekend/i.test(message)) return "Appointments are available Monday to Friday. Please choose a weekday.";
  if (/unavailable|taken|double.booking/i.test(message)) return "That time is no longer available. Choose another time.";
  if (/sign in|patient access/i.test(message)) return "Your session has expired. Sign in again to continue.";
  return fallback;
}

function monthDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12));
}

export default function PatientBookingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [services, setServices] = useState<Service[]>([]);
  const [doctor, setDoctor] = useState<DoctorWithProfile | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [month, setMonth] = useState(() => {
    const [year, monthNumber] = manilaDateKey().split("-").map(Number);
    return monthDate(year, monthNumber - 1, 1);
  });
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [bookingReference, setBookingReference] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (profileError) throw profileError;
      if (profile.role !== "patient") {
        router.replace("/dashboard");
        return;
      }

      const [{ data: serviceRows, error: serviceError }, { data: doctorRow, error: doctorError }] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("name"),
        supabase
          .from("doctors")
          .select("*, profile:profiles!inner(*)")
          .eq("profile.full_name", "Dr. Bernice Paule")
          .eq("specialty", "OB-GYNE / Sonologist")
          .maybeSingle(),
      ]);
      if (serviceError) throw serviceError;
      if (doctorError) throw doctorError;
      if (!doctorRow) throw new Error("The clinic doctor is unavailable");
      setServices((serviceRows ?? []) as Service[]);
      setDoctor(doctorRow as unknown as DoctorWithProfile);
    } catch (error) {
      console.warn("Patient booking catalog load failed", error);
      setLoadError(friendlyMessage(error, "We couldn’t load clinic booking details. Please retry."));
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (!selectedDate || !selectedService || !doctor) {
        setSlots([]);
        setSelectedSlot(null);
        return;
      }
      setLoadingSlots(true);
      setSlotError(null);
      setSelectedSlot(null);
      try {
        const [{ data: available, error: availableError }, { data: schedules, error: scheduleError }] = await Promise.all([
          supabase.rpc("get_available_slots", {
            p_doctor_id: doctor.id,
            p_target_date: selectedDate,
            p_slot_duration_minutes: selectedService.duration_minutes || 30,
          }),
          supabase
            .from("doctor_schedules")
            .select("*")
            .eq("doctor_id", doctor.id)
            .eq("weekday", weekdayForDateKey(selectedDate))
            .order("start_time"),
        ]);
        if (availableError) throw availableError;
        if (scheduleError) throw scheduleError;

        const openStarts = new Set(((available ?? []) as AvailableSlot[]).map((slot) => new Date(slot.slot_start).getTime()));
        const duration = selectedService.duration_minutes || 30;
        const candidates: BookingSlot[] = [];
        (schedules as DoctorSchedule[]).forEach((schedule) => {
          const [startHour, startMinute] = schedule.start_time.split(":").map(Number);
          const [endHour, endMinute] = schedule.end_time.split(":").map(Number);
          const start = startHour * 60 + startMinute;
          const end = endHour * 60 + endMinute;
          for (let minute = start; minute + duration <= end; minute += duration) {
            const hourText = String(Math.floor(minute / 60)).padStart(2, "0");
            const minuteText = String(minute % 60).padStart(2, "0");
            const startTime = `${hourText}:${minuteText}:00`;
            const endMinuteTotal = minute + duration;
            const endTime = `${String(Math.floor(endMinuteTotal / 60)).padStart(2, "0")}:${String(endMinuteTotal % 60).padStart(2, "0")}:00`;
            const slotStart = manilaDateTimeIso(selectedDate, startTime);
            candidates.push({
              slot_start: slotStart,
              slot_end: manilaDateTimeIso(selectedDate, endTime),
              available: openStarts.has(new Date(slotStart).getTime()),
            });
          }
        });
        if (!cancelled) setSlots(candidates);
      } catch (error) {
        console.warn("Patient booking slot load failed", error);
        if (!cancelled) {
          setSlotError(friendlyMessage(error, "We couldn’t load appointment times. Please retry."));
          setSlots([]);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    void loadSlots();
    return () => { cancelled = true; };
  }, [doctor, selectedDate, selectedService, retry, supabase]);

  const today = manilaDateKey();
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const days = useMemo(() => {
    const offset = monthDate(year, monthIndex, 1).getUTCDay();
    return Array.from({ length: 42 }, (_, index) => {
      const date = monthDate(year, monthIndex, index - offset + 1);
      const dateKey = date.toISOString().slice(0, 10);
      const weekday = date.getUTCDay();
      return {
        dateKey,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === monthIndex,
        disabled: dateKey < today || weekday === 0 || weekday === 6 || date.getUTCMonth() !== monthIndex,
      };
    });
  }, [monthIndex, today, year]);
  const monthTitle = formatManilaDate(`${year}-${String(monthIndex + 1).padStart(2, "0")}-01`, { month: "long", year: "numeric" });

  const submitBooking = async () => {
    if (!doctor || !selectedService || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setBookingError(null);
    try {
      const { data, error } = await supabase.rpc("book_appointment", {
        p_doctor_id: doctor.id,
        p_service_id: selectedService.id,
        p_start_time: selectedSlot.slot_start,
        p_notes: null,
      });
      if (error) throw error;
      setBookingReference(String(data));
      setSelectedDate("");
      setSelectedSlot(null);
    } catch (error) {
      console.warn("Patient booking request failed", error);
      setBookingError(friendlyMessage(error, "We couldn’t submit your booking. Please retry."));
      setRetry((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-rose-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PatientHeader active="/book" />

        <section className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Book an appointment</h1>
          <p className="mt-2 text-base text-gray-700">Choose a service and a weekday that works for you. All times are in Asia/Manila.</p>
        </section>

        {bookingReference && (
          <div role="status" className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            <p className="font-semibold">Your appointment request was submitted.</p>
            <p className="mt-1 text-sm">Reference: {bookingReference}</p>
            <button type="button" onClick={() => setBookingReference(null)} className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:ring-offset-2">
              Book another appointment
            </button>
          </div>
        )}

        {loading ? (
          <div role="status" className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-700 shadow-sm">
            <span className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-rose-700 border-t-transparent" />
            <p>Loading clinic booking details…</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-red-300 bg-white p-6 text-red-950 shadow-sm">
            <p className="font-semibold">Booking details are unavailable</p>
            <p className="mt-1">{loadError}</p>
            <button type="button" onClick={() => void loadCatalog()} className="mt-4 rounded-lg bg-rose-800 px-4 py-2 font-semibold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2">Retry</button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-bold text-gray-900">1. Choose a service</h2>
              {services.length === 0 ? (
                <div className="mt-4 rounded-xl bg-gray-50 p-4 text-gray-700">
                  <p>No services are currently available.</p>
                  <button type="button" onClick={() => void loadCatalog()} className="mt-3 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-900">Retry</button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {services.map((service) => (
                    <button key={service.id} type="button" aria-pressed={selectedService?.id === service.id} onClick={() => { setSelectedService(service); setSelectedDate(""); setBookingError(null); }} className={`w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-rose-700 focus:ring-offset-2 ${selectedService?.id === service.id ? "border-rose-800 bg-rose-50" : "border-gray-300 hover:border-rose-700"}`}>
                      <span className="block font-semibold text-gray-900">{service.name}</span>
                      {service.description && <span className="mt-1 block text-sm text-gray-700">{service.description}</span>}
                      <span className="mt-2 block text-sm font-medium text-gray-700">{service.duration_minutes} minutes</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 rounded-xl bg-gray-50 p-4">
                <p className="font-semibold text-gray-900">Your doctor</p>
                <p className="mt-1 text-gray-800">Dr. Bernice Paule</p>
                <p className="text-sm text-gray-700">OB-GYNE / Sonologist</p>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-bold text-gray-900">2. Choose a date and time</h2>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" aria-label="Previous month" onClick={() => setMonth((value) => monthDate(value.getUTCFullYear(), value.getUTCMonth() - 1, 1))} className="h-10 w-10 rounded-lg border border-gray-300 text-2xl text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-700">‹</button>
                <h3 className="text-lg font-bold text-gray-900">{monthTitle}</h3>
                <button type="button" aria-label="Next month" onClick={() => setMonth((value) => monthDate(value.getUTCFullYear(), value.getUTCMonth() + 1, 1))} className="h-10 w-10 rounded-lg border border-gray-300 text-2xl text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-700">›</button>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span key={label} className="py-2 text-xs font-semibold text-gray-700">{label}</span>)}
                {days.map((day) => (
                  <button key={day.dateKey} type="button" disabled={day.disabled || !selectedService} aria-pressed={selectedDate === day.dateKey} aria-label={`${formatManilaDate(day.dateKey, { dateStyle: "full" })}${day.disabled ? ", unavailable" : ""}`} onClick={() => { setSelectedDate(day.dateKey); setBookingError(null); }} className={`aspect-square rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-700 ${day.disabled || !selectedService ? "cursor-not-allowed bg-gray-100 text-gray-400" : "text-gray-900 hover:bg-rose-50"} ${selectedDate === day.dateKey ? "!bg-rose-800 !text-white" : ""}`}>
                    {day.day}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-700">Weekends and past dates are unavailable. Calendar dates use Manila time.</p>

              {!selectedService ? (
                <p className="mt-5 rounded-xl bg-gray-50 p-4 text-gray-700">Choose a service to see available dates.</p>
              ) : selectedDate && (
                <div className="mt-5 border-t border-gray-200 pt-5">
                  <h3 className="font-bold text-gray-900">{formatManilaDate(selectedDate, { dateStyle: "full" })}</h3>
                  {slotError ? (
                    <div role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">
                      <p>{slotError}</p>
                      <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-900">Retry</button>
                    </div>
                  ) : loadingSlots ? (
                    <p role="status" className="mt-3 text-gray-700">Loading available times…</p>
                  ) : slots.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-gray-50 p-4 text-gray-700">No clinic hours are scheduled for this date.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {slots.map((slot) => (
                        <button key={slot.slot_start} type="button" disabled={!slot.available} aria-pressed={selectedSlot?.slot_start === slot.slot_start} onClick={() => { setSelectedSlot(slot); setBookingError(null); }} className={`rounded-lg border px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-700 ${!slot.available ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500" : selectedSlot?.slot_start === slot.slot_start ? "border-rose-800 bg-rose-800 text-white" : "border-gray-300 text-gray-900 hover:border-rose-700"}`}>
                          {formatManilaTime(slot.slot_start)}{!slot.available && <span className="mt-1 block text-xs font-normal">Unavailable</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bookingError && <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"><p>{bookingError}</p><button type="button" disabled={submitting} onClick={() => void submitBooking()} className="mt-3 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Retrying…" : "Retry"}</button></div>}
              <button type="button" disabled={!selectedSlot || submitting} onClick={() => void submitBooking()} className="mt-5 w-full rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400">
                {submitting ? "Submitting…" : "Request appointment"}
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
