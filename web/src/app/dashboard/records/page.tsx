"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MedicalRecordWithDetails, PatientWithProfile, DoctorWithProfile, Profile } from "@m-care/shared";
import { formatManilaDate, manilaDateKey } from "@m-care/shared";

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [patients, setPatients] = useState<PatientWithProfile[]>([]);
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchPatient, setSearchPatient] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordWithDetails | null>(null);
  const [editingRecord, setEditingRecord] = useState<MedicalRecordWithDetails | null>(null);

  // Form inputs
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [visitDate, setVisitDate] = useState(manilaDateKey());
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [hpi, setHpi] = useState("");
  const [bp, setBp] = useState("120/80");
  const [hr, setHr] = useState("78 bpm");
  const [temp, setTemp] = useState("36.6 C");
  const [weightKg, setWeightKg] = useState("58");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchCurrentUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (data) setCurrentProfile(data as Profile);
    }
  }, [supabase]);

  const fetchMedicalRecords = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .select(`
          *,
          doctor:doctors (
            *,
            profile:profiles (*)
          ),
          patient:patients (
            *,
            profile:profiles (*)
          )
        `)
        .order("visit_date", { ascending: false });

      if (error) {
        console.error("Error fetching medical records (RLS enforced):", error);
      } else if (data) {
        setRecords(data as unknown as MedicalRecordWithDetails[]);
      }
    } catch (err) {
      console.error("Records error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchDropdownData = useCallback(async () => {
    const [patRes, docRes] = await Promise.all([
      supabase.from("patients").select("*, profile:profiles (*)"),
      supabase.from("doctors").select("*, profile:profiles (*)"),
    ]);
    if (patRes.data) setPatients(patRes.data as unknown as PatientWithProfile[]);
    if (docRes.data) {
      const docs = docRes.data as unknown as DoctorWithProfile[];
      setDoctors(docs);
      if (docs.length > 0 && !doctorId) setDoctorId(docs[0].id);
    }
  }, [doctorId, supabase]);

  useEffect(() => {
    fetchCurrentUser();
    fetchMedicalRecords();
    fetchDropdownData();
  }, [fetchCurrentUser, fetchMedicalRecords, fetchDropdownData]);

  const handleOpenRecordDetail = async (rec: MedicalRecordWithDetails) => {
    setSelectedRecord(rec);

    // DPA 2012 Audit Logging: Explicitly log clinical record view
    try {
      await supabase.rpc("log_medical_record_access", {
        p_record_id: rec.id,
        p_action: "VIEW",
      });
    } catch (err) {
      console.warn("Audit log note:", err);
    }
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId) return;

    setSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        doctor_id: doctorId,
        visit_date: visitDate,
        chief_complaint: chiefComplaint.trim() || null,
        history_of_present_illness: hpi.trim() || null,
        blood_pressure: bp.trim() || null,
        heart_rate: hr.trim() || null,
        temperature: temp.trim() || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        diagnosis: diagnosis.trim() || null,
        prescription: prescription.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from("medical_records")
          .update(payload)
          .eq("id", editingRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medical_records").insert(payload);
        if (error) throw error;
      }

      setShowCreateModal(false);
      setEditingRecord(null);
      resetRecordForm();
      await fetchMedicalRecords();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (rec: MedicalRecordWithDetails) => {
    setEditingRecord(rec);
    setPatientId(rec.patient_id);
    setDoctorId(rec.doctor_id);
    setVisitDate(rec.visit_date);
    setChiefComplaint(rec.chief_complaint || "");
    setHpi(rec.history_of_present_illness || "");
    setBp(rec.blood_pressure || "");
    setHr(rec.heart_rate || "");
    setTemp(rec.temperature || "");
    setWeightKg(rec.weight_kg ? String(rec.weight_kg) : "");
    setDiagnosis(rec.diagnosis || "");
    setPrescription(rec.prescription || "");
    setNotes(rec.notes || "");
  };

  const resetRecordForm = () => {
    if (patients.length > 0) setPatientId(patients[0].id);
    if (doctors.length > 0) setDoctorId(doctors[0].id);
    setVisitDate(manilaDateKey());
    setChiefComplaint("");
    setHpi("");
    setBp("120/80");
    setHr("78 bpm");
    setTemp("36.6 C");
    setWeightKg("58");
    setDiagnosis("");
    setPrescription("");
    setNotes("");
  };

  const isNurse = currentProfile?.role === "nurse";
  const isDoctor = currentProfile?.role === "doctor";
  const isAdmin = currentProfile?.role === "admin";
  const isReceptionist = currentProfile?.role === "receptionist";

  // Receptionists are blocked from reading medical records under DPA 2012
  if (isReceptionist) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
          🔒
        </div>
        <h2 className="text-lg font-bold text-gray-900">Access Restricted by Privacy Policy</h2>
        <p className="text-xs text-gray-500 max-w-md mx-auto mt-2 leading-relaxed">
          Under the Philippine Data Privacy Act of 2012 and clinic segregation of duties,
          receptionist staff manage appointment logistics and patient identity, but cannot access
          clinical diagnoses, physical exam notes, or prescriptions.
        </p>
      </div>
    );
  }

  const filteredRecords = records.filter((r) => {
    const q = searchPatient.toLowerCase();
    const patName = r.patient?.profile?.full_name?.toLowerCase() || "";
    const docName = r.doctor?.profile?.full_name?.toLowerCase() || "";
    const diag = r.diagnosis?.toLowerCase() || "";
    return patName.includes(q) || docName.includes(q) || diag.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clinical Medical Records</h1>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
              Clinical Staff Only
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Electronic health charting, triage vitals, diagnoses, prescriptions, and DPA audit tracking
          </p>
        </div>

        {(isDoctor || isNurse || isAdmin) && (
          <button
            onClick={() => {
              resetRecordForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Record New Consultation</span>
          </button>
        )}
      </div>

      {/* Search and Role Notice */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Search records by patient name, physician, or diagnosis..."
            value={searchPatient}
            onChange={(e) => setSearchPatient(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
        </div>

        <div className="text-xs text-gray-500">
          Logged as: <strong className="text-pink-600 capitalize">{currentProfile?.role}</strong> (
          {isDoctor ? "Can write diagnosis & prescriptions" : isNurse ? "Can record vitals & triage history" : "Full access"}
          )
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Visit Date</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Attending Physician</th>
                <th className="py-3 px-4">Triage Vitals</th>
                <th className="py-3 px-4">Clinical Diagnosis</th>
                <th className="py-3 px-4">Prescription (Rx)</th>
                <th className="py-3 px-4 text-right">Chart Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Loading medical records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No medical records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-purple-50/20 transition">
                    <td className="py-3.5 px-4 font-semibold text-gray-900 whitespace-nowrap">
                      {formatManilaDate(rec.visit_date, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-gray-900">{rec.patient?.profile?.full_name}</p>
                      <p className="text-xs text-gray-400">
                        Blood: {rec.patient?.blood_type || "N/A"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-medium text-gray-900">{rec.doctor?.profile?.full_name}</p>
                      <p className="text-xs text-gray-400">{rec.doctor?.specialty}</p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">
                        BP: {rec.blood_pressure || "—"} | HR: {rec.heart_rate || "—"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate font-medium text-pink-700">
                      {rec.diagnosis || "Pending lab results"}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate text-emerald-800 font-mono text-xs">
                      {rec.prescription || "—"}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenRecordDetail(rec)}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded text-xs border border-purple-200 transition"
                        >
                          View Chart
                        </button>
                        <button
                          onClick={() => openEditModal(rec)}
                          className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 font-semibold rounded text-xs border border-pink-200 transition"
                        >
                          Edit
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

      {/* Record View Detail Modal (With Audit Logging) */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div>
                <span className="text-xs font-bold text-pink-600 uppercase tracking-widest block">
                  Official Medical Chart
                </span>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedRecord.patient?.profile?.full_name}
                </h3>
                <p className="text-xs text-gray-500">
                  Visit Date: {formatManilaDate(selectedRecord.visit_date, { dateStyle: "full" })}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Doctor Details */}
              <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 flex justify-between items-center">
                <div>
                  <span className="text-gray-400 block text-xs font-bold uppercase">Attending OB-GYN</span>
                  <span className="font-bold text-purple-900 text-sm">{selectedRecord.doctor?.profile?.full_name}</span>
                  <span className="text-purple-700 block text-xs">{selectedRecord.doctor?.specialty}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block text-xs font-bold uppercase">Room</span>
                  <span className="font-bold text-gray-800">{selectedRecord.doctor?.room}</span>
                </div>
              </div>

              {/* Triage Vitals */}
              <div>
                <span className="font-bold text-gray-700 block mb-1 uppercase tracking-wider text-xs">
                  Triage Vitals (Recorded by Nursing Staff)
                </span>
                <div className="grid grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div>
                    <span className="text-gray-400 block text-xs">Blood Pressure</span>
                    <span className="font-bold text-gray-900 text-xs">{selectedRecord.blood_pressure || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-xs">Heart Rate</span>
                    <span className="font-bold text-gray-900 text-xs">{selectedRecord.heart_rate || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-xs">Temperature</span>
                    <span className="font-bold text-gray-900 text-xs">{selectedRecord.temperature || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-xs">Weight (kg)</span>
                    <span className="font-bold text-gray-900 text-xs">{selectedRecord.weight_kg ? `${selectedRecord.weight_kg} kg` : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <span className="font-bold text-gray-700 block mb-1 uppercase tracking-wider text-xs">
                  Chief Complaint & Clinical History
                </span>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <p className="text-gray-800">
                    <strong>Complaint:</strong> {selectedRecord.chief_complaint || "Routine evaluation"}
                  </p>
                  {selectedRecord.history_of_present_illness && (
                    <p className="text-gray-700">
                      <strong>HPI:</strong> {selectedRecord.history_of_present_illness}
                    </p>
                  )}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="bg-pink-50/60 p-4 rounded-xl border border-pink-200">
                <span className="font-bold text-pink-900 block mb-1 uppercase tracking-wider text-xs">
                  Clinical Diagnosis & Impression
                </span>
                <p className="text-pink-950 font-bold text-sm leading-relaxed">
                  {selectedRecord.diagnosis || "Clinical assessment ongoing"}
                </p>
              </div>

              {/* Prescription */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-900 block mb-1 uppercase tracking-wider text-xs">
                  Rx — Official Prescription
                </span>
                <pre className="text-emerald-900 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedRecord.prescription || "No prescription issued."}
                </pre>
              </div>

              {selectedRecord.notes && (
                <div>
                  <span className="font-bold text-gray-700 block mb-1 uppercase tracking-wider text-xs">
                    Doctor's Follow-up Instructions
                  </span>
                  <p className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-gray-800">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 text-xs text-gray-400 text-center border-t border-gray-100">
                🔒 DPA 2012 Audit Trail: View access recorded by {currentProfile?.full_name} ({currentProfile?.role}).
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Close Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Record Modal */}
      {(showCreateModal || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {editingRecord ? "Edit Consultation Record" : "Record New Patient Consultation"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Enter clinical observations, vitals, diagnosis, and prescription
            </p>

            <form onSubmit={handleSaveRecord} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Patient *</label>
                  <select
                    disabled={!!editingRecord}
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profile?.full_name} ({p.blood_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="font-bold text-gray-700 block mb-1">Attending Physician</span>
                  <p className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-gray-50 text-gray-800">
                    {doctors.find((doctor) => doctor.id === doctorId)?.profile.full_name ?? "Dr. Bernice Paule"}
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Visit Date</label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Triage Vitals */}
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-purple-700">
                  Triage Vitals (Nurse & Doctor updateable)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 block mb-0.5">BP</span>
                    <input
                      type="text"
                      placeholder="120/80"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-0.5">Heart Rate</span>
                    <input
                      type="text"
                      placeholder="78 bpm"
                      value={hr}
                      onChange={(e) => setHr(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-0.5">Temp</span>
                    <input
                      type="text"
                      placeholder="36.6 C"
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-0.5">Weight (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="58"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Chief Complaint</label>
                <input
                  type="text"
                  placeholder="e.g. Prenatal follow-up, morning nausea, pelvic cramping"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">History of Present Illness</label>
                <textarea
                  rows={2}
                  placeholder="Patient reports symptoms beginning 3 days ago..."
                  value={hpi}
                  onChange={(e) => setHpi(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Diagnosis (Doctor only) */}
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-pink-700">
                  Diagnosis & Clinical Impression (Doctor Only)
                </label>
                <textarea
                  rows={2}
                  disabled={isNurse && !isAdmin}
                  placeholder="Enter medical assessment and findings..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs disabled:bg-gray-100"
                />
              </div>

              {/* Prescription (Doctor only) */}
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-emerald-700">
                  Prescription (Rx) (Doctor Only)
                </label>
                <textarea
                  rows={3}
                  disabled={isNurse && !isAdmin}
                  placeholder="1. Ferrous Sulfate + Folic Acid 1 tab OD after meal&#10;2. Calcium Carbonate 500mg 1 tab BID"
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs font-mono disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Notes / Follow-up Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Advised anomaly scan next month, return if warning signs occur."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition"
                >
                  {saving ? "Saving..." : editingRecord ? "Save Record Updates" : "Save Consultation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

