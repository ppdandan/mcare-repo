"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentWithDetails, PatientWithProfile, MedicalRecordWithDetails } from "@m-care/shared";
import { addCalendarDays, formatManilaDate, formatManilaTime, manilaDateKey } from "@m-care/shared";
import Icon from "@/components/Icon";

export default function ReportsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [patients, setPatients] = useState<PatientWithProfile[]>([]);
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<"summary" | "appointments" | "patients" | "clinical">("summary");
  const [transactions, setTransactions] = useState<Array<{ amount: number; currency: string; payment_method: string; voided_at: string | null; created_at: string }>>([]);
  const [transactionsAvailable, setTransactionsAvailable] = useState(true);
  const [startDate, setStartDate] = useState(
    addCalendarDays(manilaDateKey(), -30)
  );
  const [endDate, setEndDate] = useState(manilaDateKey());

  const supabase = createClient();

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, patRes, recRes, transactionRes] = await Promise.all([
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
          .gte("start_time", `${startDate}T00:00:00+08:00`)
          .lte("start_time", `${endDate}T23:59:59+08:00`)
          .order("start_time", { ascending: false }),
        supabase
          .from("patients")
          .select("*, profile:profiles (*)")
          .order("id"),
        supabase
          .from("medical_records")
          .select(`
            *,
            patient:patients (*, profile:profiles (*)),
            doctor:doctors (*, profile:profiles (*))
          `)
          .gte("visit_date", startDate)
          .lte("visit_date", endDate)
          .order("visit_date", { ascending: false }),
        supabase
          .from("transactions")
          .select("amount, currency, payment_method, voided_at, created_at")
          .gte("created_at", `${startDate}T00:00:00+08:00`)
          .lte("created_at", `${endDate}T23:59:59+08:00`)
          .order("created_at", { ascending: false }),
      ]);

      if (apptRes.data) setAppointments(apptRes.data as unknown as AppointmentWithDetails[]);
      if (patRes.data) setPatients(patRes.data as unknown as PatientWithProfile[]);
      if (recRes.data) setRecords(recRes.data as unknown as MedicalRecordWithDetails[]);
      if (transactionRes.error) setTransactionsAvailable(false);
      else {
        setTransactionsAvailable(true);
        setTransactions((transactionRes.data ?? []) as typeof transactions);
      }
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, supabase]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export CSV Helper
  const downloadCsv = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAppointmentsCsv = () => {
    const headers = [
      "Appointment ID",
      "Date",
      "Time",
      "Patient Name",
      "Patient Contact",
      "Doctor Name",
      "Service",
      "Room",
      "Status",
      "Notes",
    ];

    const rows = appointments.map((a) => [
      `"${a.id}"`,
      `"${manilaDateKey(a.start_time)}"`,
      `"${formatManilaTime(a.start_time)}"`,
      `"${a.patient?.profile?.full_name || ""}"`,
      `"${a.patient?.profile?.phone || ""}"`,
      `"${a.doctor?.profile?.full_name || ""}"`,
      `"${a.service?.name || ""}"`,
      `"${a.doctor?.room || ""}"`,
      `"${a.status.toUpperCase()}"`,
      `"${(a.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsv(`mcare_appointments_${startDate}_to_${endDate}.csv`, csv);
  };

  const exportPatientsCsv = () => {
    const headers = [
      "Patient ID",
      "Full Name",
      "Contact Phone",
      "Date of Birth",
      "Blood Type",
      "Emergency Contact",
      "Emergency Phone",
      "Allergies",
      "Obstetric History",
      "DPA 2012 Consent Logged",
    ];

    const rows = patients.map((p) => [
      `"${p.id}"`,
      `"${p.profile?.full_name || ""}"`,
      `"${p.profile?.phone || ""}"`,
      `"${p.profile?.date_of_birth || ""}"`,
      `"${p.blood_type || ""}"`,
      `"${p.emergency_contact_name || ""}"`,
      `"${p.emergency_contact_phone || ""}"`,
      `"${(p.allergies || "").replace(/"/g, '""')}"`,
      `"${(p.obstetric_history || "").replace(/"/g, '""')}"`,
      `"${p.privacy_consent ? "YES" : "NO"}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsv(`mcare_patient_registry_${manilaDateKey()}.csv`, csv);
  };

  const exportClinicalRecordsCsv = () => {
    const headers = [
      "Record ID",
      "Visit Date",
      "Patient Name",
      "Attending Physician",
      "Blood Pressure",
      "Heart Rate",
      "Temperature",
      "Weight (kg)",
      "Chief Complaint",
      "Diagnosis",
      "Prescription",
    ];

    const rows = records.map((r) => [
      `"${r.id}"`,
      `"${r.visit_date}"`,
      `"${r.patient?.profile?.full_name || ""}"`,
      `"${r.doctor?.profile?.full_name || ""}"`,
      `"${r.blood_pressure || ""}"`,
      `"${r.heart_rate || ""}"`,
      `"${r.temperature || ""}"`,
      `"${r.weight_kg || ""}"`,
      `"${(r.chief_complaint || "").replace(/"/g, '""')}"`,
      `"${(r.diagnosis || "").replace(/"/g, '""')}"`,
      `"${(r.prescription || "").replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsv(`mcare_clinical_records_${startDate}_to_${endDate}.csv`, csv);
  };

  const periodPatients = patients.filter((patient) => {
    const createdAt = patient.profile?.created_at;
    if (!createdAt) return false;
    const date = manilaDateKey(createdAt);
    return date >= startDate && date <= endDate;
  });
  const appointmentStatusSummary = appointments.reduce<Record<string, number>>((counts, appointment) => {
    counts[appointment.status] = (counts[appointment.status] ?? 0) + 1;
    return counts;
  }, {});
  const validTransactions = transactions.filter((transaction) => !transaction.voided_at);
  const transactionTotal = validTransactions.reduce((total, transaction) => total + Number(transaction.amount), 0);
  const exportSummaryCsv = () => {
    const rows = [
      ["Summary", "Metric", "Value"],
      ["Appointments", "Total", String(appointments.length)],
      ...Object.entries(appointmentStatusSummary).map(([status, count]) => ["Appointments", status, String(count)]),
      ["Patients", "New registrations", String(periodPatients.length)],
      ["Transactions", "Count", String(transactions.length)],
      ["Transactions", "Not voided count", String(validTransactions.length)],
      ["Transactions", "Not voided amount", `${validTransactions[0]?.currency ?? "PHP"} ${transactionTotal.toFixed(2)}`],
      ["Transactions", "Voided count", String(transactions.length - validTransactions.length)],
    ];
    downloadCsv(`mcare_summary_${startDate}_to_${endDate}.csv`, rows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(",")).join("\n"));
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-base-content tracking-tight">Clinical Reports & Export Center</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Export verified clinic audit logs, appointment ledgers, and clinical records to PDF and CSV
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (reportType === "summary") exportSummaryCsv();
              else if (reportType === "appointments") exportAppointmentsCsv();
              else if (reportType === "patients") exportPatientsCsv();
              else exportClinicalRecordsCsv();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5"
          >
            <Icon name="download" size={15} />
            <span>Download CSV</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-4 py-2 bg-primary hover:bg-primary-focus text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5"
          >
            <Icon name="printer" size={15} />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Filter and Category Bar (Hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-base-100 p-4 rounded-xl border border-base-300 shadow-sm print:hidden">
        {/* Report Category Switcher */}
        <div className="flex items-center space-x-2 bg-base-200 p-1 rounded-xl">
          <button
            onClick={() => setReportType("summary")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${reportType === "summary" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/80"}`}
          >
            Clinic Summary
          </button>
          <button
            onClick={() => setReportType("appointments")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === "appointments" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/80"
            }`}
          >
            <Icon name="calendar" size={15} /> Appointments Ledger
          </button>
          <button
            onClick={() => setReportType("patients")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === "patients" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/80"
            }`}
          >
            <Icon name="users" size={15} /> Patient Registry
          </button>
          <button
            onClick={() => setReportType("clinical")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === "clinical" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/80"
            }`}
          >
            <Icon name="stethoscope" size={15} /> Clinical Encounters
          </button>
        </div>

        {/* Date Filter */}
        {reportType !== "patients" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-base-content/70 font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              aria-label="From date" onChange={(e) => setStartDate(e.target.value)}
              className="border border-base-300 rounded-lg px-2.5 py-1.5 text-xs text-base-content"
            />
            <span className="text-base-content/70 font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              aria-label="To date" onChange={(e) => setEndDate(e.target.value)}
              className="border border-base-300 rounded-lg px-2.5 py-1.5 text-xs text-base-content"
            />
          </div>
        )}
      </div>

      {/* Printable Report Document Sheet */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm p-8 print:p-0 print:border-none print:shadow-none">
        {/* Clinic Letterhead Header */}
        <div className="border-b-2 border-pink-600 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-extrabold text-base-content tracking-tight">
              M-CARE OB-GYN CLINIC & ULTRASONOGRAPHY
            </h2>
            <p className="text-xs text-base-content/80">
              Balibago, Angeles City, Pampanga • Tel: (045) 888-CARE
            </p>
            <p className="text-xs text-base-content/60 mt-1">
              Accredited Women's Health Clinic • Philippine Data Privacy Act RA 10173 Certified
            </p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-pink-100 text-pink-800 font-bold text-xs uppercase tracking-wider rounded">
              Official Clinic Report
            </span>
            <p className="text-xs text-base-content/70 mt-2">
              Generated: {formatManilaDate(new Date(), { dateStyle: "long" })}
            </p>
            <p className="text-xs text-base-content/60">
              Period: {startDate} to {endDate}
            </p>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-base-content/60">Loading report records...</div>
        ) : reportType === "summary" ? (
          <section aria-labelledby="clinic-report-summary-title">
            <h3 id="clinic-report-summary-title" className="text-sm font-bold text-base-content mb-4">Clinic activity summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <article className="rounded-xl border border-base-300 p-4">
                <h4 className="font-bold text-base-content">Appointments</h4>
                <p className="mt-2 text-2xl font-bold">{appointments.length}</p>
                <p className="text-xs text-base-content/70">Appointments in date range</p>
                <ul className="mt-3 space-y-1 text-xs capitalize">
                  {Object.entries(appointmentStatusSummary).map(([status, count]) => <li key={status} className="flex justify-between"><span>{status.replaceAll("_", " ")}</span><strong>{count}</strong></li>)}
                </ul>
              </article>
              <article className="rounded-xl border border-base-300 p-4">
                <h4 className="font-bold text-base-content">Patients</h4>
                <p className="mt-2 text-2xl font-bold">{periodPatients.length}</p>
                <p className="text-xs text-base-content/70">New registrations in date range</p>
              </article>
              <article className="rounded-xl border border-base-300 p-4">
                <h4 className="font-bold text-base-content">Transactions</h4>
                {transactionsAvailable ? <>
                  <p className="mt-2 text-2xl font-bold">PHP {transactionTotal.toFixed(2)}</p>
                  <p className="text-xs text-base-content/70">{validTransactions.length} active transactions · {transactions.length - validTransactions.length} voided</p>
                  <p className="mt-2 text-xs text-base-content/70">Recorded in date range: {transactions.length}</p>
                </> : <p className="mt-2 text-sm text-base-content/70">Transaction summaries are unavailable for your role.</p>}
              </article>
            </div>
          </section>
        ) : reportType === "appointments" ? (
          <div>
            <h3 className="text-sm font-bold text-base-content mb-3">
              Appointments Audit Ledger ({appointments.length} records)
            </h3>
            <div className="overflow-x-auto"><table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-200 border-b border-base-300 text-base-content/70 font-bold uppercase text-xs">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Attending Physician</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-xs">
                      {formatManilaDate(a.start_time, { month: "short", day: "numeric" })}{" "}
                      {formatManilaTime(a.start_time)}
                    </td>
                    <td className="py-2 px-3 font-semibold text-base-content">{a.patient?.profile?.full_name}</td>
                    <td className="py-2 px-3">{a.service?.name}</td>
                    <td className="py-2 px-3 text-base-content/80">{a.doctor?.profile?.full_name}</td>
                    <td className="py-2 px-3 font-bold uppercase text-xs text-primary">{a.status}</td>
                    <td className="py-2 px-3 text-base-content/70 truncate max-w-xs">{a.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        ) : reportType === "patients" ? (
          <div>
            <h3 className="text-sm font-bold text-base-content mb-3">
              Registered Patient Directory ({patients.length} records)
            </h3>
            <div className="overflow-x-auto"><table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-200 border-b border-base-300 text-base-content/70 font-bold uppercase text-xs">
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Blood Type</th>
                  <th className="py-2.5 px-3">Emergency Contact</th>
                  <th className="py-2.5 px-3">Obstetric Profile</th>
                  <th className="py-2.5 px-3">Allergies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-semibold text-base-content">{p.profile?.full_name}</td>
                    <td className="py-2 px-3 font-mono">{p.profile?.phone || "—"}</td>
                    <td className="py-2 px-3 font-bold text-rose-700">{p.blood_type || "N/A"}</td>
                    <td className="py-2 px-3">{p.emergency_contact_name} ({p.emergency_contact_phone})</td>
                    <td className="py-2 px-3 text-base-content/80">{p.obstetric_history || "None"}</td>
                    <td className="py-2 px-3">{p.allergies || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-bold text-base-content mb-3">
              Clinical Consultations & Diagnoses Log ({records.length} records)
            </h3>
            <div className="overflow-x-auto"><table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-200 border-b border-base-300 text-base-content/70 font-bold uppercase text-xs">
                  <th className="py-2.5 px-3">Visit Date</th>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Attending Doctor</th>
                  <th className="py-2.5 px-3">Vitals (BP/HR)</th>
                  <th className="py-2.5 px-3">Diagnosis</th>
                  <th className="py-2.5 px-3">Prescription (Rx)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 whitespace-nowrap font-mono">{r.visit_date}</td>
                    <td className="py-2 px-3 font-semibold text-base-content">{r.patient?.profile?.full_name}</td>
                    <td className="py-2 px-3">{r.doctor?.profile?.full_name}</td>
                    <td className="py-2 px-3 font-mono">{r.blood_pressure || "—"} | {r.heart_rate || "—"}</td>
                    <td className="py-2 px-3 font-medium text-primary">{r.diagnosis || "—"}</td>
                    <td className="py-2 px-3 font-mono text-xs text-emerald-800">{r.prescription || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* Official Sign-off Block (Visible on print / PDF) */}
        <div className="mt-12 pt-8 border-t border-base-300 grid grid-cols-2 gap-8 text-xs text-base-content/80">
          <div>
            <p className="font-semibold text-base-content">Verified & Reconciled By:</p>
            <div className="mt-10 border-b border-gray-400 w-48" />
            <p className="mt-1 font-bold text-base-content">Clinic Administrator</p>
            <p className="text-xs text-base-content/70">M-Care OB-GYN Clinic & Ultrasound</p>
          </div>

          <div className="text-right flex flex-col items-end">
            <p className="font-semibold text-base-content">Medical Director Approval:</p>
            <div className="mt-10 border-b border-gray-400 w-48" />
            <p className="mt-1 font-bold text-base-content">Dr. Bernice Paule</p>
            <p className="text-xs text-base-content/70">OB-GYNE / Sonologist</p>
          </div>
        </div>
      </div>
    </div>
  );
}

