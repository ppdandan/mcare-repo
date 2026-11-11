"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, AppointmentWithDetails } from "@m-care/shared";
import { designTokens, formatManilaDate, manilaDateKey, manilaTimeKey, weekdayForDateKey, typography } from "@m-care/shared";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const colors = designTokens.color;
const STATUS_COLORS: Record<string, string> = {
  completed: colors.success,
  approved: colors.info,
  pending: colors.warning,
  cancelled: colors.error,
  no_show: colors.brandStrong,
  rescheduled: colors.brandMid,
};

const CHART_PALETTE = [colors.brand, colors.brandStrong, colors.info, colors.success, colors.warning, colors.brandMid];

export default function AnalyticsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [diagnoses, setDiagnoses] = useState<{ diagnosis: string; count: number }[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [isMounted, setIsMounted] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (profileData) setProfile(profileData as Profile);
      }

      // Fetch appointments
      const { data: apptData } = await supabase
        .from("appointments")
        .select(`
          *,
          doctor:doctors (
            *,
            profile:profiles (*)
          ),
          service:services (*)
        `)
        .order("start_time", { ascending: true });

      if (apptData) setAppointments(apptData as unknown as AppointmentWithDetails[]);

      // Fetch medical records to aggregate diagnoses
      const { data: recData } = await supabase
        .from("medical_records")
        .select("diagnosis");

      if (recData) {
        const counts: Record<string, number> = {};
        recData.forEach((r) => {
          if (r.diagnosis) {
            const trimmed = r.diagnosis.split("\n")[0].slice(0, 40);
            counts[trimmed] = (counts[trimmed] || 0) + 1;
          }
        });
        const sortedDiag = Object.entries(counts)
          .map(([diagnosis, count]) => ({ diagnosis, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setDiagnoses(sortedDiag);
      }

      // Fetch total patient count
      const { count } = await supabase.from("patients").select("id", { count: "exact", head: true });
      if (count !== null) setPatientCount(count);
    } catch (err) {
      console.error("Error fetching analytics data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Date range filtering
  const now = new Date();
  const filteredAppointments = appointments.filter((a) => {
    if (dateRange === "all") return true;
    const apptDate = new Date(a.start_time);
    const diffDays = (now.getTime() - apptDate.getTime()) / (1000 * 3600 * 24);
    if (dateRange === "7d") return diffDays <= 7 && diffDays >= -7;
    if (dateRange === "30d") return diffDays <= 30 && diffDays >= -30;
    if (dateRange === "90d") return diffDays <= 90 && diffDays >= -90;
    return true;
  });

  // KPI Calculations
  const totalVisits = filteredAppointments.length;
  const completedCount = filteredAppointments.filter((a) => a.status === "completed").length;
  const cancelledCount = filteredAppointments.filter((a) => a.status === "cancelled").length;
  const noShowCount = filteredAppointments.filter((a) => a.status === "no_show").length;

  const completionRate = totalVisits > 0 ? Math.round((completedCount / totalVisits) * 100) : 0;
  const cancellationRate = totalVisits > 0 ? Math.round((cancelledCount / totalVisits) * 100) : 0;
  const noShowRate = totalVisits > 0 ? Math.round((noShowCount / totalVisits) * 100) : 0;

  // Chart Data 1: Appointment Trends Over Time
  const trendMap: Record<string, { date: string; total: number; completed: number }> = {};
  filteredAppointments.forEach((a) => {
    const key = formatManilaDate(a.start_time, { month: "numeric", day: "numeric" });
    if (!trendMap[key]) {
      trendMap[key] = { date: key, total: 0, completed: 0 };
    }
    trendMap[key].total += 1;
    if (a.status === "completed") trendMap[key].completed += 1;
  });
  const trendData = Object.values(trendMap);

  // Chart Data 2: Status Breakdown Pie
  const statusMap: Record<string, number> = {};
  filteredAppointments.forEach((a) => {
    statusMap[a.status] = (statusMap[a.status] || 0) + 1;
  });
  const statusPieData = Object.entries(statusMap).map(([status, count]) => ({
    name: status.replace("_", " ").toUpperCase(),
    value: count,
    rawStatus: status,
  }));

  // Chart Data 3: Most Common Services
  const serviceMap: Record<string, number> = {};
  filteredAppointments.forEach((a) => {
    const sName = a.service?.name || "General";
    serviceMap[sName] = (serviceMap[sName] || 0) + 1;
  });
  const serviceData = Object.entries(serviceMap)
    .map(([service, count]) => ({ service: service.slice(0, 18), count }))
    .sort((a, b) => b.count - a.count);

  // Chart Data 4: Busiest Days of Week (0 = Sun, 1 = Mon ... 6 = Sat)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  filteredAppointments.forEach((a) => {
    const day = weekdayForDateKey(manilaDateKey(a.start_time));
    dayCounts[day] += 1;
  });
  const busiestDaysData = dayNames.map((name, idx) => ({
    day: name,
    visits: dayCounts[idx],
  }));

  // Chart Data 5: Busiest Hours
  const hourMap: Record<string, number> = {
    "9 AM": 0, "10 AM": 0, "11 AM": 0, "1 PM": 0, "2 PM": 0, "3 PM": 0, "4 PM": 0, "5 PM": 0,
  };
  filteredAppointments.forEach((a) => {
    const h = Number(manilaTimeKey(a.start_time).slice(0, 2));
    if (h === 9) hourMap["9 AM"] += 1;
    else if (h === 10) hourMap["10 AM"] += 1;
    else if (h === 11) hourMap["11 AM"] += 1;
    else if (h === 13) hourMap["1 PM"] += 1;
    else if (h === 14) hourMap["2 PM"] += 1;
    else if (h === 15) hourMap["3 PM"] += 1;
    else if (h === 16) hourMap["4 PM"] += 1;
    else if (h === 17) hourMap["5 PM"] += 1;
  });
  const busiestHoursData = Object.entries(hourMap).map(([hour, count]) => ({ hour, count }));

  // Admin access validation
  const isAdmin = profile?.role === "admin";

  if (!isAdmin && !loading) {
    return (
      <div className="bg-base-100 rounded-2xl p-12 text-center border border-base-300 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
          🔒
        </div>
        <h2 className="text-xl font-bold text-base-content">Administrator Access Restricted</h2>
        <p className="text-xs text-base-content/70 max-w-md mx-auto mt-2 leading-relaxed">
          Comprehensive clinic revenue metrics, status distribution, and aggregate health reports
          are restricted to Clinic Administrators in compliance with clinic governance policies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-base-content tracking-tight">Clinic Analytics & KPIs</h1>
            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-200">
              Admin Exclusive
            </span>
          </div>
          <p className="text-sm text-base-content/70 mt-1">
            Real-time patient throughput, service utilization, diagnosis distribution, and peak hours
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center bg-base-200 p-1 rounded-xl text-xs font-bold">
          {(
            [
              { label: "7 Days", val: "7d" },
              { label: "30 Days", val: "30d" },
              { label: "90 Days", val: "90d" },
              { label: "All Time", val: "all" },
            ] as const
          ).map((t) => (
            <button
              key={t.val}
              onClick={() => setDateRange(t.val)}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === t.val
                  ? "bg-base-100 text-primary shadow-sm"
                  : "text-base-content/80 hover:text-base-content"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Total Appointments</p>
          <p className="text-3xl font-extrabold text-base-content mt-2">{totalVisits}</p>
          <p className="text-xs text-base-content/60 mt-1">In selected period</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Completion Rate</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">{completionRate}%</p>
          <p className="text-xs text-emerald-700 mt-1">{completedCount} consultations concluded</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Cancellation Rate</p>
          <p className="text-3xl font-extrabold text-rose-600 mt-2">{cancellationRate}%</p>
          <p className="text-xs text-rose-700 mt-1">{cancelledCount} visits cancelled</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">No-Show Rate</p>
          <p className="text-3xl font-extrabold text-amber-600 mt-2">{noShowRate}%</p>
          <p className="text-xs text-amber-700 mt-1">{noShowCount} missed sessions</p>
        </div>

        <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
          <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Total Patients</p>
          <p className="text-3xl font-extrabold text-purple-600 mt-2">{patientCount}</p>
          <p className="text-xs text-purple-700 mt-1">DPA 2012 Registered</p>
        </div>
      </div>

      {/* Row 1: Appointment Trends & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
          <h2 className="text-base font-bold text-base-content mb-1">Appointment Volume Trends</h2>
          <p className="text-xs text-base-content/60 mb-6">Patient booking influx over time</p>

          <div className="h-72 w-full">
            {isMounted && trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.brand} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={colors.brand} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.divider} />
                  <XAxis dataKey="date" stroke={colors.textMuted} fontSize={typography.caption.fontSize} />
                  <YAxis stroke={colors.textMuted} fontSize={typography.caption.fontSize} allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Appointments Booked"
                    stroke={colors.brand}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-base-content/60">
                Not enough date intervals to plot trend curve.
              </div>
            )}
          </div>
        </div>

        {/* Status Breakdown Donut Chart */}
        <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
          <h2 className="text-base font-bold text-base-content mb-1">Appointment Status Breakdown</h2>
          <p className="text-xs text-base-content/60 mb-4">Ratio of outcomes</p>

          <div className="h-64 w-full">
            {isMounted && statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.rawStatus] || CHART_PALETTE[index % CHART_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-base-content/60">
                No appointment status data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Most Common Services & Common Diagnoses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Common Services */}
        <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
          <h2 className="text-base font-bold text-base-content mb-1">Top In-Demand Clinical Services</h2>
          <p className="text-xs text-base-content/60 mb-4">Volume per procedure / consultation</p>

          <div className="h-64 w-full">
            {isMounted && serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.divider} />
                  <XAxis type="number" stroke={colors.textMuted} fontSize={typography.caption.fontSize} allowDecimals={false} />
                  <YAxis dataKey="service" type="category" stroke={colors.textMuted} fontSize={typography.caption.fontSize} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Visits" fill={colors.brandStrong} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-base-content/60">
                No service data.
              </div>
            )}
          </div>
        </div>

        {/* Most Common Diagnoses */}
        <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
          <h2 className="text-base font-bold text-base-content mb-1">Top Clinical Diagnoses</h2>
          <p className="text-xs text-base-content/60 mb-4">Most frequent obstetric & gynecologic findings</p>

          {diagnoses.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-base-content/60">
              No diagnoses recorded yet in medical charts.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {diagnoses.map((d, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl bg-base-200 border border-base-300 text-xs"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span className="w-6 h-6 rounded-full bg-pink-100 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-base-content truncate">{d.diagnosis}</span>
                  </div>
                  <span className="font-bold text-primary shrink-0 bg-primary/10 px-2.5 py-0.5 rounded-full border border-pink-200">
                    {d.count} cases
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Busiest Days & Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Days */}
        <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
          <h2 className="text-base font-bold text-base-content mb-1">Busiest Days of the Week</h2>
          <p className="text-xs text-base-content/60 mb-4">Appointment volume distribution across clinic days</p>

          <div className="h-60 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={busiestDaysData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.divider} />
                  <XAxis dataKey="day" stroke={colors.textMuted} fontSize={typography.caption.fontSize} />
                  <YAxis stroke={colors.textMuted} fontSize={typography.caption.fontSize} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="visits" name="Consultations" fill={colors.brand} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Busiest Hours */}
        <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
          <h2 className="text-base font-bold text-base-content mb-1">Peak Consultation Hours</h2>
          <p className="text-xs text-base-content/60 mb-4">Patient volume by time of day</p>

          <div className="h-60 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={busiestHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.divider} />
                  <XAxis dataKey="hour" stroke={colors.textMuted} fontSize={typography.caption.fontSize} />
                  <YAxis stroke={colors.textMuted} fontSize={typography.caption.fontSize} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Appointments" fill={colors.info} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

