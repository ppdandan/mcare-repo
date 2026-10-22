"use client";

import React, { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("error") === "patient_restricted") {
      setError(
        "Access Denied: Patients must access M-Care via the Patient Mobile App. Staff portal is restricted to clinic personnel."
      );
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      // Verify that the user is a staff member (not a patient)
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Unable to retrieve user profile. Please contact the administrator.");
        }

        if (profile.role === "patient") {
          await supabase.auth.signOut();
          throw new Error(
            "Access Denied: Patients must use the M-Care Patient Mobile App. Staff portal is restricted."
          );
        }

        router.push("/dashboard");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-pink-100 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-600 text-white font-bold text-2xl shadow-md mb-3">
            M
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">M-CARE CLINIC</h1>
          <p className="text-sm font-semibold text-pink-600 uppercase tracking-wider mt-1">
            Clinical & Administrative Portal
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Balibago, Angeles City • Doctors, Nurses, Receptionists, and Admins
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. receptionist@mcare.clinic"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg text-sm shadow-md transition disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In to Portal"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center space-y-2">
          <p className="text-xs text-gray-400">
            Republic Act No. 10173 • Philippine Data Privacy Act of 2012
          </p>
          <p className="text-xs text-gray-400">
            All clinic consultations and patient record queries are logged in immutable audit records.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading M-Care Portal...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
