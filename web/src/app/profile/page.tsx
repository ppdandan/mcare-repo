"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PatientHeader from "@/components/PatientHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusAlert from "@/components/ui/StatusAlert";
import { ErrorState, LoadingState } from "@/components/ui/AsyncStates";
import TextField from "@/components/ui/TextField";
import TextAreaField from "@/components/ui/TextAreaField";

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

  return (
    <div className="min-h-screen bg-base-200">
      <PageContainer className="max-w-3xl">
        <PatientHeader active="/profile" />
        <h1 className="text-3xl font-bold tracking-tight text-base-content">Patient profile</h1>
        <p className="mt-2 text-base-content/80">Your contact and health details are shared with the M-Care mobile app.</p>
        {notice && <StatusAlert variant="success" className="mt-5">{notice}</StatusAlert>}
        {loading ? (
          <div className="mt-6"><LoadingState label="Loading profile…" /></div>
        ) : error ? (
          <div className="mt-6"><ErrorState title="" description={error} onRetry={() => void loadProfile()} /></div>
        ) : (
          <Card className="mt-6"><CardBody className="p-5 sm:p-7">
            <form onSubmit={saveProfile}>
              <div className="grid gap-5 sm:grid-cols-2">
                {fields.map(({ key, label, multiline }) => multiline ? (
                  <div key={key} className="sm:col-span-2">
                    <TextAreaField label={label} rows={3} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                  </div>
                ) : (
                  <TextField key={key} label={label} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                ))}
              </div>
              <Button type="submit" loading={saving} className="mt-6">{saving ? "Saving…" : "Save profile"}</Button>
            </form>
          </CardBody></Card>
        )}
      </PageContainer>
    </div>
  );
}
