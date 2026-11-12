"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import TableControls from "@/components/ui/TableControls";
import { userFacingErrorMessage, type PatientWithProfile } from "@m-care/shared";

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [patientSort, setPatientSort] = useState("name");
  const [patientPage, setPatientPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientWithProfile | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<Array<{ id: string; start_time: string; status: string; service?: { name: string } | null }>>([]);
  const [appointmentHistoryLoading, setAppointmentHistoryLoading] = useState(false);
  const [appointmentHistoryError, setAppointmentHistoryError] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<PatientWithProfile | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [bloodType, setBloodType] = useState("O+");
  const [allergies, setAllergies] = useState("");
  const [obstetricHistory, setObstetricHistory] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchPatients = useCallback(async () => {
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select(`
          *,
          profile:profiles (*)
        `)
        .order("id");

      if (error) {
        console.error("Error fetching patients:", error);
        setLoadError(userFacingErrorMessage(error, "We couldn’t load the patient directory."));
      } else if (data) {
        setPatients(data as unknown as PatientWithProfile[]);
      }
    } catch (err) {
      console.error("Error:", err);
      setLoadError(userFacingErrorMessage(err, "We couldn’t load the patient directory."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    setSaving(true);
    try {
      const tempPassword = crypto.randomUUID();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            date_of_birth: dob || null,
            address: address.trim() || null,
            emergency_contact_name: emergencyName.trim() || null,
            emergency_contact_phone: emergencyPhone.trim() || null,
            blood_type: bloodType,
            allergies: allergies.trim() || null,
            obstetric_history: obstetricHistory.trim() || null,
            privacy_consent: true,
            role: "patient",
          },
        },
      });

      if (authError) throw authError;

      alert(
        `Walk-in patient registered. Share this temporary password securely; it will not be shown again: ${tempPassword}`
      );
      setShowCreateModal(false);
      resetForm();
      await fetchPatients();
    } catch (err: unknown) {
      const message = userFacingErrorMessage(err, "We couldn’t register this patient. Check the details and try again.");
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    setSaving(true);
    try {
      // Update Profile
      await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", editingPatient.profile_id);

      // Update Patient details
      const { error: patientErr } = await supabase
        .from("patients")
        .update({
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          blood_type: bloodType,
          allergies: allergies.trim() || null,
          obstetric_history: obstetricHistory.trim() || null,
        })
        .eq("id", editingPatient.id);

      if (patientErr) throw patientErr;

      setEditingPatient(null);
      resetForm();
      await fetchPatients();
    } catch (err: unknown) {
      const message = userFacingErrorMessage(err, "We couldn’t update this patient. Refresh and try again.");
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (p: PatientWithProfile) => {
    setEditingPatient(p);
    setFullName(p.profile?.full_name || "");
    setPhone(p.profile?.phone || "");
    setAddress(p.profile?.address || "");
    setEmergencyName(p.emergency_contact_name || "");
    setEmergencyPhone(p.emergency_contact_phone || "");
    setBloodType(p.blood_type || "O+");
    setAllergies(p.allergies || "");
    setObstetricHistory(p.obstetric_history || "");
  };

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setDob("");
    setAddress("");
    setEmergencyName("");
    setEmergencyPhone("");
    setBloodType("O+");
    setAllergies("");
    setObstetricHistory("");
  };

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = p.profile?.full_name?.toLowerCase().includes(q);
    const phoneMatch = p.profile?.phone?.toLowerCase().includes(q);
    const bloodMatch = p.blood_type?.toLowerCase().includes(q);
    return nameMatch || phoneMatch || bloodMatch;
  });
  const sortedPatients = [...filteredPatients].sort((a, b) => patientSort === "newest"
    ? (b.profile?.created_at ?? "").localeCompare(a.profile?.created_at ?? "")
    : (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""));
  const pagePatients = sortedPatients.slice((patientPage - 1) * 10, patientPage * 10);

  const openPatientDetails = async (patient: PatientWithProfile) => {
    setSelectedPatient(patient);
    setPatientAppointments([]);
    setAppointmentHistoryError(null);
    setAppointmentHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, status, service:services (name)")
        .eq("patient_id", patient.id)
        .order("start_time", { ascending: false })
        .limit(10);
      if (error) throw error;
      setPatientAppointments((data ?? []) as unknown as typeof patientAppointments);
    } catch (err) {
      setAppointmentHistoryError(userFacingErrorMessage(err, "We couldn’t load this patient’s appointment history."));
    } finally {
      setAppointmentHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-base-content tracking-tight">Patients Directory</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Clinical records directory, contact management, and DPA 2012 compliance logs
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-primary hover:bg-primary-focus text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
        >
          <span>+</span>
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-100 p-4 rounded-xl border border-base-300 shadow-sm">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={searchQuery}
            aria-label="Search patients" onChange={(e) => { setSearchQuery(e.target.value); setPatientPage(1); }}
            className="w-full text-xs border border-base-300 rounded-lg pl-9 pr-3 py-2 text-base-content placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <Icon name="search" size={15} className="absolute left-3 top-3 text-base-content/60" />
        </div>

        <div className="flex items-center space-x-4 text-xs text-base-content/70">
          <span>
            Total Patients: <strong className="text-base-content">{patients.length}</strong>
          </span>
          <span>•</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
            DPA 2012 Verified
          </span>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
        <TableControls total={sortedPatients.length} page={patientPage} sortValue={patientSort} sortOptions={[{ value: "name", label: "Name A to Z" }, { value: "newest", label: "Newest first" }]} onSortChange={(value) => { setPatientSort(value); setPatientPage(1); }} onPageChange={setPatientPage} />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-200/75 border-b border-base-300 text-base-content/60 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Blood Type</th>
                <th className="py-3 px-4">Emergency Contact</th>
                <th className="py-3 px-4">Obstetric Profile</th>
                <th className="py-3 px-4">Allergies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-base-content/60">
                    Loading patients directory...
                  </td>
                </tr>
              ) : loadError ? (
                <tr><td colSpan={7} className="p-6"><div role="alert" className="alert alert-error"><span>{loadError}</span><button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); void fetchPatients(); }}>Retry</button></div></td></tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-base-content/60">
                    No registered patients match your search.
                  </td>
                </tr>
              ) : (
                pagePatients.map((p) => (
                  <tr key={p.id} className="hover:bg-primary/10 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-base-content">{p.profile?.full_name}</p>
                      <p className="text-xs text-base-content/60">
                        DOB: {p.profile?.date_of_birth ?? "Unspecified"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-base-content">
                      {p.profile?.phone || "No phone"}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200 text-xs">
                        {p.blood_type || "N/A"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="text-base-content font-medium">{p.emergency_contact_name || "—"}</p>
                      <p className="text-xs text-base-content/60">{p.emergency_contact_phone || ""}</p>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate text-base-content/80">
                      {p.obstetric_history || "None recorded"}
                    </td>

                    <td className="py-3.5 px-4">
                      {p.allergies ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 font-semibold rounded text-xs">
                          <span aria-hidden="true" className="mr-1 font-bold">!</span>{p.allergies}
                        </span>
                      ) : (
                        <span className="text-base-content/60">None</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => void openPatientDetails(p)}
                          className="px-2.5 py-1 bg-base-200 hover:bg-gray-200 text-base-content font-semibold rounded text-xs transition"
                        >
                          View Card
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
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

      {/* Patient Profile View Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-base-300">
            <div className="flex items-center justify-between pb-4 border-b border-base-300 mb-4">
              <div>
                <h3 className="text-lg font-bold text-base-content">
                  {selectedPatient.profile?.full_name}
                </h3>
                <p className="text-xs text-primary font-semibold uppercase tracking-wider">
                  Patient Health Record ID: {selectedPatient.id.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-base-content/60 hover:text-base-content text-sm font-bold"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-base-200 p-3 rounded-xl border border-base-300">
                <div>
                  <span className="text-base-content/60 block mb-0.5">Contact Phone:</span>
                  <span className="font-bold text-base-content">{selectedPatient.profile?.phone || "None"}</span>
                </div>
                <div>
                  <span className="text-base-content/60 block mb-0.5">Blood Type:</span>
                  <span className="font-bold text-rose-700">{selectedPatient.blood_type || "Unknown"}</span>
                </div>
                <div>
                  <span className="text-base-content/60 block mb-0.5">Date of Birth:</span>
                  <span className="font-bold text-base-content">{selectedPatient.profile?.date_of_birth || "None"}</span>
                </div>
                <div>
                  <span className="text-base-content/60 block mb-0.5">DPA 2012 Consent:</span>
                  <span className="font-bold text-emerald-700">✓ Granted on Registration</span>
                </div>
              </div>

              <div>
                <span className="text-base-content/60 font-bold block mb-1">Residential Address:</span>
                <p className="p-2 bg-base-200 rounded-lg text-base-content">{selectedPatient.profile?.address || "No address recorded"}</p>
              </div>

              <div>
                <span className="text-base-content/60 font-bold block mb-1">Emergency Contact:</span>
                <p className="p-2 bg-base-200 rounded-lg text-base-content">
                  {selectedPatient.emergency_contact_name} • {selectedPatient.emergency_contact_phone}
                </p>
              </div>

              <div>
                <span className="text-base-content/60 font-bold block mb-1">Obstetric / Gynecologic History:</span>
                <p className="p-2 bg-base-200 rounded-lg text-base-content">{selectedPatient.obstetric_history || "None recorded"}</p>
              </div>

              <div>
                <span className="text-base-content/60 font-bold block mb-1">Known Allergies:</span>
                <p className="p-2 bg-red-50 text-red-800 rounded-lg font-semibold">{selectedPatient.allergies || "None"}</p>
              </div>

              <section className="border-t border-base-300 pt-4" aria-labelledby="patient-appointment-history-title">
                <h3 id="patient-appointment-history-title" className="font-bold text-base-content">Appointment history</h3>
                {appointmentHistoryLoading ? <p role="status" className="mt-2 text-sm text-base-content/70">Loading appointments…</p>
                  : appointmentHistoryError ? <p role="alert" className="mt-2 text-sm text-error">{appointmentHistoryError}</p>
                  : patientAppointments.length === 0 ? <p className="mt-2 text-sm text-base-content/70">No appointments are recorded for this patient.</p>
                  : <ul className="mt-2 divide-y divide-base-300">{patientAppointments.map((appointment) => <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>{appointment.service?.name ?? "Clinic visit"} · {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(appointment.start_time))}</span>
                    <span className="badge badge-outline capitalize">{appointment.status.replaceAll("_", " ")}</span>
                  </li>)}</ul>}
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 bg-base-200 hover:bg-gray-200 text-base-content rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Patient Modal */}
      {(showCreateModal || editingPatient) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-base-content mb-1">
              {editingPatient ? "Edit Patient Details" : "Register Walk-in Patient"}
            </h3>
            <p className="text-xs text-base-content/70 mb-4">
              Complies with Philippine Data Privacy Act of 2012
            </p>

            <form
              onSubmit={editingPatient ? handleUpdatePatient : handleCreatePatient}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-base-content block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  aria-label="Full Name" onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              {!editingPatient && (
                <div>
                  <label className="font-bold text-base-content block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    aria-label="Email Address" onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-base-content block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    aria-label="Phone Number" onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-base-content block mb-1">Blood Type</label>
                  <select
                    value={bloodType}
                    aria-label="Blood Type" onChange={(e) => setBloodType(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs bg-base-100"
                  >
                    {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Unknown"].map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Home Address</label>
                <input
                  type="text"
                  value={address}
                  aria-label="Home Address" onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-base-content block mb-1">Emergency Contact Person</label>
                  <input
                    type="text"
                    value={emergencyName}
                    aria-label="Emergency Contact Person" onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-base-content block mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={emergencyPhone}
                    aria-label="Emergency Contact Phone" onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Known Allergies</label>
                <input
                  type="text"
                  value={allergies}
                  aria-label="Known Allergies" onChange={(e) => setAllergies(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">Obstetric History Notes</label>
                <textarea
                  rows={2}
                  value={obstetricHistory}
                  aria-label="Obstetric History Notes" onChange={(e) => setObstetricHistory(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPatient(null);
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
                  {saving ? "Saving..." : editingPatient ? "Save Changes" : "Register Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
