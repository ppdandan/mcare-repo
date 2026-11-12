"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MedicalRecordWithDetails, PatientWithProfile, DoctorWithProfile, Profile } from "@m-care/shared";
import { formatManilaDate, manilaDateKey, userFacingErrorMessage } from "@m-care/shared";

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
  const [medicalHistory, setMedicalHistory] = useState("");
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
        medical_history: medicalHistory.trim() || null,
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
      alert(userFacingErrorMessage(err, "We couldn’t save this medical record. Check the details and try again."));
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
    setMedicalHistory(rec.medical_history || "");
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
    setMedicalHistory("");
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
      <div className="bg-base-100 rounded-2xl p-12 text-center border border-base-300 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
          🔒
        </div>
        <h2 className="text-lg font-bold text-base-content">Access Restricted by Privacy Policy</h2>
        <p className="text-xs text-base-content/70 max-w-md mx-auto mt-2 leading-relaxed">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-base-content tracking-tight">Clinical Medical Records</h1>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
              Clinical Staff Only
            </span>
          </div>
          <p className="text-sm text-base-content/70 mt-1">
            Electronic health charting, triage vitals, diagnoses, prescriptions, and DPA audit tracking
          </p>
        </div>

        {(isDoctor || isNurse || isAdmin) && (
          <button
            onClick={() => {
              resetRecordForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary-focus text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Record New Consultation</span>
          </button>
        )}
      </div>

      {/* Search and Role Notice */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-100 p-4 rounded-xl border border-base-300 shadow-sm">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={searchPatient}
            aria-label="Search medical records" onChange={(e) => setSearchPatient(e.target.value)}
            className="w-full text-xs border border-base-300 rounded-lg pl-9 pr-3 py-2 text-base-content placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <span className="absolute left-3 top-2.5 text-base-content/60 text-xs">🔍</span>
        </div>

        <div className="text-xs text-base-content/70">
          Logged as: <strong className="text-primary capitalize">{currentProfile?.role}</strong> (
          {isDoctor ? "Can write diagnosis & prescriptions" : isNurse ? "Can record vitals & triage history" : "Full access"}
          )
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-200/75 border-b border-base-300 text-base-content/60 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Visit Date</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Attending Physician</th>
                <th className="py-3 px-4">Triage Vitals</th>
                <th className="py-3 px-4">Clinical Diagnosis</th>
                <th className="py-3 px-4">Prescription (Rx)</th>
                <th className="py-3 px-4 text-right">Chart Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-base-content/60">
                    Loading medical records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-base-content/60">
                    No medical records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-purple-50/20 transition">
                    <td className="py-3.5 px-4 font-semibold text-base-content whitespace-nowrap">
                      {formatManilaDate(rec.visit_date, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-base-content">{rec.patient?.profile?.full_name}</p>
                      <p className="text-xs text-base-content/60">
                        Blood: {rec.patient?.blood_type || "N/A"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-medium text-base-content">{rec.doctor?.profile?.full_name}</p>
                      <p className="text-xs text-base-content/60">{rec.doctor?.specialty}</p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono bg-base-200 px-2 py-0.5 rounded text-xs text-base-content">
                        BP: {rec.blood_pressure || "—"} | HR: {rec.heart_rate || "—"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate font-medium text-primary">
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
                          className="px-2.5 py-1 bg-primary/10 hover:bg-pink-100 text-primary font-semibold rounded text-xs border border-pink-200 transition"
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
          <div className="bg-base-100 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-base-300 mb-4">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-widest block">
                  Official Medical Chart
                </span>
                <h3 className="text-xl font-bold text-base-content">
                  {selectedRecord.patient?.profile?.full_name}
                </h3>
                <p className="text-xs text-base-content/70">
                  Visit Date: {formatManilaDate(selectedRecord.visit_date, { dateStyle: "full" })}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-base-content/60 hover:text-base-content text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Doctor Details */}
              <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 flex justify-between items-center">
                <div>
                  <span className="text-base-content/60 block text-xs font-bold uppercase">Attending OB-GYN</span>
                  <span className="font-bold text-purple-900 text-sm">{selectedRecord.doctor?.profile?.full_name}</span>
                  <span className="text-purple-700 block text-xs">{selectedRecord.doctor?.specialty}</span>
                </div>
                <div className="text-right">
                  <span className="text-base-content/60 block text-xs font-bold uppercase">Room</span>
                  <span className="font-bold text-base-content">{selectedRecord.doctor?.room}</span>
                </div>
              </div>

              {/* Triage Vitals */}
              <div>
                <span className="font-bold text-base-content block mb-1 uppercase tracking-wider text-xs">
                  Triage Vitals (Recorded by Nursing Staff)
                </span>
                <div className="grid grid-cols-4 gap-3 bg-base-200 p-3 rounded-xl border border-base-300">
                  <div>
                    <span className="text-base-content/60 block text-xs">Blood Pressure</span>
                    <span className="font-bold text-base-content text-xs">{selectedRecord.blood_pressure || "—"}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60 block text-xs">Heart Rate</span>
                    <span className="font-bold text-base-content text-xs">{selectedRecord.heart_rate || "—"}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60 block text-xs">Temperature</span>
                    <span className="font-bold text-base-content text-xs">{selectedRecord.temperature || "—"}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60 block text-xs">Weight (kg)</span>
                    <span className="font-bold text-base-content text-xs">{selectedRecord.weight_kg ? `${selectedRecord.weight_kg} kg` : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <span className="font-bold text-base-content block mb-1 uppercase tracking-wider text-xs">
                  Chief Complaint & Clinical History
                </span>
                <div className="bg-base-200 p-3 rounded-xl border border-base-300 space-y-2">
                  <p className="text-base-content">
                    <strong>Complaint:</strong> {selectedRecord.chief_complaint || "Routine evaluation"}
                  </p>
                  {selectedRecord.medical_history && (
                    <p className="text-base-content">
                      <strong>Medical history:</strong> {selectedRecord.medical_history}
                    </p>
                  )}
                  {selectedRecord.history_of_present_illness && (
                    <p className="text-base-content">
                      <strong>HPI:</strong> {selectedRecord.history_of_present_illness}
                    </p>
                  )}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="bg-primary/10/60 p-4 rounded-xl border border-pink-200">
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
                  <span className="font-bold text-base-content block mb-1 uppercase tracking-wider text-xs">
                    Doctor's Follow-up Instructions
                  </span>
                  <p className="bg-base-200 p-3 rounded-xl border border-base-300 text-base-content">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 text-xs text-base-content/60 text-center border-t border-base-300">
                🔒 DPA 2012 Audit Trail: View access recorded by {currentProfile?.full_name} ({currentProfile?.role}).
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-base-200 hover:bg-gray-200 text-base-content rounded-lg text-xs font-semibold"
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
          <div className="bg-base-100 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-base-content mb-1">
              {editingRecord ? "Edit Consultation Record" : "Record New Patient Consultation"}
            </h3>
            <p className="text-xs text-base-content/70 mb-4">
              Enter clinical observations, vitals, diagnosis, and prescription
            </p>

            <form onSubmit={handleSaveRecord} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-base-content block mb-1">Patient *</label>
                  <select
                    disabled={!!editingRecord}
                    value={patientId}
                    aria-label="Patient" onChange={(e) => setPatientId(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs bg-base-100"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profile?.full_name} ({p.blood_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="font-bold text-base-content block mb-1">Attending Physician</span>
                  <p className="w-full border border-base-300 rounded-lg p-2 text-xs bg-base-200 text-base-content">
                    {doctors.find((doctor) => doctor.id === doctorId)?.profile.full_name ?? "Dr. Bernice Paule"}
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Visit Date</label>
                <input
                  type="date"
                  value={visitDate}
                  aria-label="Visit Date" onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Triage Vitals */}
              <div>
                <label className="font-bold text-base-content block mb-1 text-purple-700">
                  Triage Vitals (Nurse & Doctor updateable)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-xs text-base-content/60 block mb-0.5">BP</span>
                    <input
                      type="text"
                      value={bp}
                      aria-label="Blood pressure" onChange={(e) => setBp(e.target.value)}
                      className="w-full border border-base-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-base-content/60 block mb-0.5">Heart Rate</span>
                    <input
                      type="text"
                      value={hr}
                      aria-label="Heart Rate" onChange={(e) => setHr(e.target.value)}
                      className="w-full border border-base-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-base-content/60 block mb-0.5">Temp</span>
                    <input
                      type="text"
                      value={temp}
                      aria-label="Temperature" onChange={(e) => setTemp(e.target.value)}
                      className="w-full border border-base-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-base-content/60 block mb-0.5">Weight (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={weightKg}
                      aria-label="Weight (kg)" onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full border border-base-300 rounded-lg p-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Chief Complaint</label>
                <input
                  type="text"
                  value={chiefComplaint}
                  aria-label="Chief Complaint" onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Medical History</label>
                <textarea
                  rows={3}
                  value={medicalHistory}
                  aria-label="Medical History" onChange={(e) => setMedicalHistory(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">History of Present Illness</label>
                <textarea
                  rows={2}
                  value={hpi}
                  aria-label="History of Present Illness" onChange={(e) => setHpi(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Diagnosis (Doctor only) */}
              <div>
                <label className="font-bold text-base-content block mb-1 text-primary">
                  Diagnosis & Clinical Impression (Doctor Only)
                </label>
                <textarea
                  rows={2}
                  disabled={isNurse && !isAdmin}
                  value={diagnosis}
                  aria-label="Diagnosis and Clinical Impression" onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs disabled:bg-base-200"
                />
              </div>

              {/* Prescription (Doctor only) */}
              <div>
                <label className="font-bold text-base-content block mb-1 text-emerald-700">
                  Prescription (Rx) (Doctor Only)
                </label>
                <textarea
                  rows={3}
                  disabled={isNurse && !isAdmin}
                  value={prescription}
                  aria-label="Prescription" onChange={(e) => setPrescription(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs font-mono disabled:bg-base-200"
                />
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Notes / Follow-up Instructions</label>
                <textarea
                  rows={2}
                  value={notes}
                  aria-label="Notes / Follow-up Instructions" onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 border border-base-300 text-base-content/80 rounded-lg text-xs font-semibold hover:bg-base-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-focus transition"
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

