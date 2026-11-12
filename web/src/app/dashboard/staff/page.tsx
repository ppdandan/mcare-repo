"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import TableControls from "@/components/ui/TableControls";
import type { Profile, UserRole } from "@m-care/shared";
import { formatManilaDate, userFacingErrorMessage } from "@m-care/shared";

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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("nurse");
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
      const temporaryPassword = crypto.randomUUID();
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: temporaryPassword,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            role: role,
          },
        },
      });

      if (authError) throw authError;

      alert(
        `Staff account created for ${fullName}. Share this temporary password securely; it will not be shown again: ${temporaryPassword}`
      );
      setShowModal(false);
      setFullName("");
      setEmail("");
      setPhone("");
      await fetchStaff();
    } catch (err: unknown) {
      alert(userFacingErrorMessage(err, "We couldn’t create this staff account. Check the details and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = currentUserProfile?.role === "admin";
  const filteredStaff = staff.filter((member) => `${member.full_name} ${member.role} ${member.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const sortedStaff = [...filteredStaff].sort((a, b) => sort === "role" ? a.role.localeCompare(b.role) : a.full_name.localeCompare(b.full_name));
  const pageStaff = sortedStaff.slice((page - 1) * 10, page * 10);

  if (!isAdmin && !loading) {
    return (
      <div className="bg-base-100 rounded-2xl p-12 text-center border border-base-300 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
          <Icon name="lock" size={24} />
        </div>
        <h2 className="text-xl font-bold text-base-content">Administrator Access Restricted</h2>
        <p className="text-xs text-base-content/70 max-w-md mx-auto mt-2 leading-relaxed">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-base-content tracking-tight">Staff Management</h1>
            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-200">
              Admin Exclusive
            </span>
          </div>
          <p className="text-sm text-base-content/70 mt-1">
            Clinic personnel directory, access permissions, and account provisioning
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary hover:bg-primary-focus text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center space-x-2"
        >
          <span>+</span>
          <span>Provision New Staff Account</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
        <div className="relative p-3">
          <Icon name="search" size={15} className="absolute left-6 top-6 text-base-content/60" />
          <input aria-label="Search staff" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="input input-bordered w-full pl-10 sm:max-w-md" />
        </div>
        <TableControls total={sortedStaff.length} page={page} sortValue={sort} sortOptions={[{ value: "name", label: "Name A to Z" }, { value: "role", label: "Role" }]} onSortChange={(value) => { setSort(value); setPage(1); }} onPageChange={setPage} />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-200/75 border-b border-base-300 text-base-content/60 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Specialty & Room</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">System Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-base-content/60">
                    Loading clinic staff directory...
                  </td>
                </tr>
              ) : (
                pageStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-base-200/50 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-base-content">{s.full_name}</p>
                      <p className="text-xs text-base-content/60">ID: {s.id.slice(0, 8)}...</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          roleColors[s.role] || "bg-base-200 text-base-content"
                        }`}
                      >
                        {s.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-base-content">{s.phone || "—"}</td>

                    <td className="py-3.5 px-4">
                      {s.doctor_details ? (
                        <div>
                          <p className="font-semibold text-base-content">{s.doctor_details.specialty}</p>
                          <p className="text-xs text-base-content/60">Room: {s.doctor_details.room}</p>
                        </div>
                      ) : (
                        <span className="text-base-content/60">Clinic Department</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-base-content/70">
                      {formatManilaDate(s.created_at, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-300">
            <h3 className="text-lg font-bold text-base-content mb-1">Provision Staff Account</h3>
            <p className="text-xs text-base-content/70 mb-4">
              Create credentials for Nurses, Receptionists, or Administrators
            </p>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
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

              <div>
                <label className="font-bold text-base-content block mb-1">Staff Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  aria-label="Email Address" onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-base-content block mb-1">Staff Role *</label>
                  <select
                    value={role}
                    aria-label="Staff role" onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs bg-base-100 font-bold"
                  >
                    <option value="nurse">Nurse</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-base-content block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={phone}
                    aria-label="Phone Number" onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-base-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-primary/10 rounded-lg text-xs text-primary leading-relaxed">
                <Icon name="info" size={15} className="mr-1 inline-block align-[-2px]" /> The account will receive role permissions defined by clinic access policies.
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-base-300 text-base-content/80 rounded-lg text-xs font-semibold hover:bg-base-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-focus transition"
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
