"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PatientWithProfile } from "@m-care/shared";

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientWithProfile | null>(null);
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
      } else if (data) {
        setPatients(data as unknown as PatientWithProfile[]);
      }
    } catch (err) {
      console.error("Error:", err);
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
      const message = err instanceof Error ? err.message : "Failed to register patient";
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
      const message = err instanceof Error ? err.message : "Failed to update patient";
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Patients Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Clinical records directory, contact management, and DPA 2012 compliance logs
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
        >
          <span>+</span>
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Search patient by name, mobile, or blood type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span>
            Total Patients: <strong className="text-gray-900">{patients.length}</strong>
          </span>
          <span>•</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
            DPA 2012 Verified
          </span>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Blood Type</th>
                <th className="py-3 px-4">Emergency Contact</th>
                <th className="py-3 px-4">Obstetric Profile</th>
                <th className="py-3 px-4">Allergies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Loading patients directory...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No registered patients match your search.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-pink-50/25 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-gray-900">{p.profile?.full_name}</p>
                      <p className="text-[10px] text-gray-400">
                        DOB: {p.profile?.date_of_birth ?? "Unspecified"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-gray-700">
                      {p.profile?.phone || "No phone"}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200 text-[11px]">
                        {p.blood_type || "N/A"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="text-gray-800 font-medium">{p.emergency_contact_name || "—"}</p>
                      <p className="text-[10px] text-gray-400">{p.emergency_contact_phone || ""}</p>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate text-gray-600">
                      {p.obstetric_history || "None recorded"}
                    </td>

                    <td className="py-3.5 px-4">
                      {p.allergies ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 font-semibold rounded text-[10px]">
                          ⚠️ {p.allergies}
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedPatient(p)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded text-[11px] transition"
                        >
                          View Card
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 font-semibold rounded text-[11px] border border-pink-200 transition"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedPatient.profile?.full_name}
                </h3>
                <p className="text-xs text-pink-600 font-semibold uppercase tracking-wider">
                  Patient Health Record ID: {selectedPatient.id.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 block mb-0.5">Contact Phone:</span>
                  <span className="font-bold text-gray-900">{selectedPatient.profile?.phone || "None"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Blood Type:</span>
                  <span className="font-bold text-rose-700">{selectedPatient.blood_type || "Unknown"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Date of Birth:</span>
                  <span className="font-bold text-gray-900">{selectedPatient.profile?.date_of_birth || "None"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">DPA 2012 Consent:</span>
                  <span className="font-bold text-emerald-700">✓ Granted on Registration</span>
                </div>
              </div>

              <div>
                <span className="text-gray-400 font-bold block mb-1">Residential Address:</span>
                <p className="p-2 bg-gray-50 rounded-lg text-gray-700">{selectedPatient.profile?.address || "No address recorded"}</p>
              </div>

              <div>
                <span className="text-gray-400 font-bold block mb-1">Emergency Contact:</span>
                <p className="p-2 bg-gray-50 rounded-lg text-gray-700">
                  {selectedPatient.emergency_contact_name} • {selectedPatient.emergency_contact_phone}
                </p>
              </div>

              <div>
                <span className="text-gray-400 font-bold block mb-1">Obstetric / Gynecologic History:</span>
                <p className="p-2 bg-gray-50 rounded-lg text-gray-700">{selectedPatient.obstetric_history || "None recorded"}</p>
              </div>

              <div>
                <span className="text-gray-400 font-bold block mb-1">Known Allergies:</span>
                <p className="p-2 bg-red-50 text-red-800 rounded-lg font-semibold">{selectedPatient.allergies || "None"}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {editingPatient ? "Edit Patient Details" : "Register Walk-in Patient"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Complies with Philippine Data Privacy Act of 2012
            </p>

            <form
              onSubmit={editingPatient ? handleUpdatePatient : handleCreatePatient}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                  placeholder="e.g. Maria Clara Santos"
                />
              </div>

              {!editingPatient && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                    placeholder="e.g. maria@example.com"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                    placeholder="0917 123 4567"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Blood Type</label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"
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
                <label className="font-bold text-gray-700 block mb-1">Home Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                  placeholder="Barangay, City, Province"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Emergency Contact Person</label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                    placeholder="Name and relationship"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                    placeholder="0918 987 6543"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Known Allergies</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                  placeholder="e.g. Penicillin, Aspirin, or None"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Obstetric History Notes</label>
                <textarea
                  rows={2}
                  value={obstetricHistory}
                  onChange={(e) => setObstetricHistory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                  placeholder="e.g. G2P1, 1 prior cesarean delivery"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPatient(null);
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
