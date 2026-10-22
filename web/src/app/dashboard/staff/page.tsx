"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@m-care/shared";

interface StaffMember extends Profile {
  doctor_details?: {
    specialty: string;
    room: string | null;
  } | null;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("nurse");
  const [specialty, setSpecialty] = useState("");
  const [room, setRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const fetchStaff = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (prof) setCurrentUserProfile(prof as Profile);
      }

      // Query staff profiles (excluding patients)
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select(`
          *
        `)
        .in("role", ["doctor", "nurse", "receptionist", "admin"])
        .order("role");

      if (error) throw error;

      // Query doctor details
      const { data: doctorsData } = await supabase.from("doctors").select("*");

      if (profilesData) {
        const combined: StaffMember[] = profilesData.map((p) => {
          const doc = doctorsData?.find((d) => d.profile_id === p.id);
          return {
            ...p,
            doctor_details: doc ? { specialty: doc.specialty, room: doc.room } : null,
          };
        });
        setStaff(combined);
      }
    } catch (err) {
      console.error("Error loading staff:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      const defaultPassword = "Password123!";
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: defaultPassword,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            role: role,
          },
        },
      });

      if (authError) throw authError;

      // If doctor role, register in doctors table
      if (role === "doctor" && authData.user) {
        await supabase.from("doctors").insert({
          profile_id: authData.user.id,
          specialty: specialty.trim() || "General OB-GYN",
          room: room.trim() || "Consultation Suite",
        });
      }

      alert(`Staff account created for ${fullName}! Initial password: ${defaultPassword}`);
      setShowModal(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setSpecialty("");
      setRoom("");
      await fetchStaff();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = currentUserProfile?.role === "admin";

  if (!isAdmin && !loading) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
          🔒
        </div>
        <h2 className="text-xl font-bold text-gray-900">Administrator Access Restricted</h2>
        <p className="text-xs text-gray-500 max-w-md mx-auto mt-2 leading-relaxed">
          Staff account provisioning, role assignment, and clinic access rights management
          can only be performed by the Clinic Administrator.
        </p>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    admin: "bg-rose-100 text-rose-800 border-rose-200",
    doctor: "bg-purple-100 text-purple-800 border-purple-200",
    nurse: "bg-blue-100 text-blue-800 border-blue-200",
    receptionist: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Management</h1>
            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-200">
              Admin Exclusive
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Clinic personnel directory, access permissions, and account provisioning
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
        >
          <span>+</span>
          <span>Provision New Staff Account</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Specialty & Room</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">System Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Loading clinic staff directory...
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-gray-900">{s.full_name}</p>
                      <p className="text-[10px] text-gray-400">ID: {s.id.slice(0, 8)}...</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          roleColors[s.role] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {s.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-gray-700">{s.phone || "—"}</td>

                    <td className="py-3.5 px-4">
                      {s.doctor_details ? (
                        <div>
                          <p className="font-semibold text-gray-900">{s.doctor_details.specialty}</p>
                          <p className="text-[10px] text-gray-400">📍 {s.doctor_details.room}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Clinic Department</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-gray-500">
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Staff
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Provision Staff Account</h3>
            <p className="text-xs text-gray-500 mb-4">
              Create credentials for Doctors, Nurses, Receptionists, or Administrators
            </p>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jennifer Ramos, MD"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Staff Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. dr.ramos@mcare.clinic"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Staff Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white font-bold"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="0917 111 2233"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {role === "doctor" && (
                <div className="space-y-3 pt-1 border-t border-gray-100">
                  <div>
                    <label className="font-bold text-purple-700 block mb-1">Medical Specialty</label>
                    <input
                      type="text"
                      placeholder="e.g. High-Risk Pregnancy & Perinatology"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-purple-700 block mb-1">Clinic Room / Suite</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 204 - Ultrasound A"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-pink-50 rounded-lg text-[11px] text-pink-700 leading-relaxed">
                ℹ️ The account will be granted role permissions according to clinic Row Level Security policies.
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition"
                >
                  {submitting ? "Provisioning..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

