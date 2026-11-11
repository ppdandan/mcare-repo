"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentWithDetails, PatientWithProfile, MedicalRecordWithDetails } from "@m-care/shared";

export default function ReportsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [patients, setPatients] = useState<PatientWithProfile[]>([]);
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<"appointments" | "patients" | "clinical">("appointments");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const supabase = createClient();

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, patRes, recRes] = await Promise.all([
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
      ]);

      if (apptRes.data) setAppointments(apptRes.data as unknown as AppointmentWithDetails[]);
      if (patRes.data) setPatients(patRes.data as unknown as PatientWithProfile[]);
      if (recRes.data) setRecords(recRes.data as unknown as MedicalRecordWithDetails[]);
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
      `"${new Date(a.start_time).toISOString().split("T")[0]}"`,
      `"${new Date(a.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}"`,
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
    downloadCsv(`mcare_patient_registry_${new Date().toISOString().split("T")[0]}.csv`, csv);
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

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clinical Reports & Export Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Export verified clinic audit logs, appointment ledgers, and clinical records to PDF and CSV
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (reportType === "appointments") exportAppointmentsCsv();
              else if (reportType === "patients") exportPatientsCsv();
              else exportClinicalRecordsCsv();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5"
          >
            <span>📥</span>
            <span>Download CSV</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5"
          >
            <span>🖨️</span>
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Filter and Category Bar (Hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm print:hidden">
        {/* Report Category Switcher */}
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setReportType("appointments")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === "appointments" ? "bg-white text-pink-600 shadow-sm" : "text-gray-600"
            }`}
          >
            📅 Appointments Ledger
          </button>
          <button
            onClick={() => setReportType("patients")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === "patients" ? "bg-white text-pink-600 shadow-sm" : "text-gray-600"
            }`}
          >
            👥 Patient Registry
          </button>
          <button
            onClick={() => setReportType("clinical")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === "clinical" ? "bg-white text-pink-600 shadow-sm" : "text-gray-600"
            }`}
          >
            🩺 Clinical Encounters
          </button>
        </div>

        {/* Date Filter */}
        {reportType !== "patients" && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-500 font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800"
            />
            <span className="text-gray-500 font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800"
            />
          </div>
        )}
      </div>

      {/* Printable Report Document Sheet */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 print:p-0 print:border-none print:shadow-none">
        {/* Clinic Letterhead Header */}
        <div className="border-b-2 border-pink-600 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
              M-CARE OB-GYN CLINIC & ULTRASONOGRAPHY
            </h2>
            <p className="text-xs text-gray-600">
              Balibago, Angeles City, Pampanga • Tel: (045) 888-CARE
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Accredited Women's Health Clinic • Philippine Data Privacy Act RA 10173 Certified
            </p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-pink-100 text-pink-800 font-bold text-xs uppercase tracking-wider rounded">
              Official Clinic Report
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Generated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
            <p className="text-[11px] text-gray-400">
              Period: {startDate} to {endDate}
            </p>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading report records...</div>
        ) : reportType === "appointments" ? (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Appointments Audit Ledger ({appointments.length} records)
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Attending Physician</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                      {new Date(a.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                      {new Date(a.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="py-2 px-3 font-semibold text-gray-900">{a.patient?.profile?.full_name}</td>
                    <td className="py-2 px-3">{a.service?.name}</td>
                    <td className="py-2 px-3 text-gray-600">{a.doctor?.profile?.full_name}</td>
                    <td className="py-2 px-3 font-bold uppercase text-[10px] text-pink-700">{a.status}</td>
                    <td className="py-2 px-3 text-gray-500 truncate max-w-xs">{a.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === "patients" ? (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Registered Patient Directory ({patients.length} records)
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Blood Type</th>
                  <th className="py-2.5 px-3">Emergency Contact</th>
                  <th className="py-2.5 px-3">Obstetric Profile</th>
                  <th className="py-2.5 px-3">Allergies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-semibold text-gray-900">{p.profile?.full_name}</td>
                    <td className="py-2 px-3 font-mono">{p.profile?.phone || "—"}</td>
                    <td className="py-2 px-3 font-bold text-rose-700">{p.blood_type || "N/A"}</td>
                    <td className="py-2 px-3">{p.emergency_contact_name} ({p.emergency_contact_phone})</td>
                    <td className="py-2 px-3 text-gray-600">{p.obstetric_history || "None"}</td>
                    <td className="py-2 px-3">{p.allergies || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              Clinical Consultations & Diagnoses Log ({records.length} records)
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Visit Date</th>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Attending Doctor</th>
                  <th className="py-2.5 px-3">Vitals (BP/HR)</th>
                  <th className="py-2.5 px-3">Diagnosis</th>
                  <th className="py-2.5 px-3">Prescription (Rx)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 whitespace-nowrap font-mono">{r.visit_date}</td>
                    <td className="py-2 px-3 font-semibold text-gray-900">{r.patient?.profile?.full_name}</td>
                    <td className="py-2 px-3">{r.doctor?.profile?.full_name}</td>
                    <td className="py-2 px-3 font-mono">{r.blood_pressure || "—"} | {r.heart_rate || "—"}</td>
                    <td className="py-2 px-3 font-medium text-pink-700">{r.diagnosis || "—"}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-emerald-800">{r.prescription || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Sign-off Block (Visible on print / PDF) */}
        <div className="mt-12 pt-8 border-t border-gray-200 grid grid-cols-2 gap-8 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">Verified & Reconciled By:</p>
            <div className="mt-10 border-b border-gray-400 w-48" />
            <p className="mt-1 font-bold text-gray-900">Clinic Administrator</p>
            <p className="text-[10px] text-gray-500">M-Care OB-GYN Clinic & Ultrasound</p>
          </div>

          <div className="text-right flex flex-col items-end">
            <p className="font-semibold text-gray-800">Medical Director Approval:</p>
            <div className="mt-10 border-b border-gray-400 w-48" />
            <p className="mt-1 font-bold text-gray-900">Dr. Bernice Paule</p>
            <p className="text-[10px] text-gray-500">OB-GYNE / Sonologist</p>
          </div>
        </div>
      </div>
    </div>
  );
}

