"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";

type ProfileForm = {
  full_name: string;
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  blood_type: string;
  allergies: string;
  obstetric_history: string;
};

const emptyForm: ProfileForm = {
  full_name: "", phone: "", address: "", emergency_contact_name: "",
  emergency_contact_phone: "", blood_type: "", allergies: "", obstetric_history: "",
};

const fields: { key: keyof ProfileForm; label: string; multiline?: boolean }[] = [
  { key: "full_name", label: "Full name" },
  { key: "phone", label: "Mobile phone" },
  { key: "address", label: "Home address", multiline: true },
  { key: "emergency_contact_name", label: "Emergency contact name" },
  { key: "emergency_contact_phone", label: "Emergency contact phone" },
  { key: "blood_type", label: "Blood type" },
  { key: "allergies", label: "Allergies", multiline: true },
  { key: "obstetric_history", label: "Obstetric history", multiline: true },
];

export default function PatientProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Sign in required");
      const [{ data: profile, error: profileError }, { data: patient, error: patientError }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, address").eq("id", user.id).single(),
        supabase.from("patients").select("emergency_contact_name, emergency_contact_phone, blood_type, allergies, obstetric_history").eq("profile_id", user.id).single(),
      ]);
      if (profileError) throw profileError;
      if (patientError) throw patientError;
      setForm({
        full_name: profile.full_name ?? "", phone: profile.phone ?? "", address: profile.address ?? "",
        emergency_contact_name: patient.emergency_contact_name ?? "", emergency_contact_phone: patient.emergency_contact_phone ?? "",
        blood_type: patient.blood_type ?? "", allergies: patient.allergies ?? "", obstetric_history: patient.obstetric_history ?? "",
      });
    } catch (cause) {
      console.error("Unable to load patient profile:", cause);
      setError("We couldn’t load your profile. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Sign in required");
      const { error: profileError } = await supabase.from("profiles").update({
        full_name: form.full_name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null,
      }).eq("id", user.id);
      if (profileError) throw profileError;
      const { error: patientError } = await supabase.from("patients").update({
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        blood_type: form.blood_type.trim() || null,
        allergies: form.allergies.trim() || null,
        obstetric_history: form.obstetric_history.trim() || null,
      }).eq("profile_id", user.id);
      if (patientError) throw patientError;
      setNotice("Your profile has been saved and will appear in both M-Care apps.");
    } catch (cause) {
      console.error("Unable to save patient profile:", cause);
      setError("We couldn’t save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 block w-full rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-gray-950 placeholder:text-gray-600 focus:border-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-800";

  return (
    <main className="min-h-screen bg-rose-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <PatientHeader active="/profile" />
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Patient profile</h1>
        <p className="mt-2 text-gray-700">Your contact and health details are shared with the M-Care mobile app.</p>
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-semibold text-emerald-950">{notice}</p>}
        {loading ? (
          <div role="status" className="mt-6 rounded-2xl bg-white p-8 text-center text-gray-800 shadow-sm">Loading profile…</div>
        ) : error ? (
          <div role="alert" className="mt-6 rounded-2xl border border-red-300 bg-white p-6 text-red-950 shadow-sm"><p>{error}</p><button type="button" onClick={() => void loadProfile()} className="mt-4 rounded-lg bg-rose-800 px-4 py-2 font-semibold text-white">Retry</button></div>
        ) : (
          <form onSubmit={saveProfile} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map(({ key, label, multiline }) => (
                <label key={key} className={`block text-sm font-semibold text-gray-900 ${multiline ? "sm:col-span-2" : ""}`}>
                  {label}
                  {multiline ? <textarea rows={3} className={inputClass} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /> : <input className={inputClass} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />}
                </label>
              ))}
            </div>
            <button type="submit" disabled={saving} className="mt-6 rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2 disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
