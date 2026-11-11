"use client";

import React, { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type LoginMode = "password" | "otp";

function LoginForm() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const verifyStaffRoleAndRedirect = async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Unable to retrieve staff profile. Please contact the clinic administrator.");
    }

    if (profile.role === "patient") {
      await supabase.auth.signOut();
      throw new Error(
        "Access Denied: Patients must use the M-Care Patient Mobile App. Staff portal is restricted."
      );
    }

    router.push("/dashboard");
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;
      if (data.user) {
        await verifyStaffRoleAndRedirect(data.user.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your clinic staff email address.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) throw otpError;
      setOtpSent(true);
      setSuccess("A 6-digit OTP code has been sent to your staff email.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !cleanOtp) {
      setError("Please enter both your staff email and the 6-digit OTP code.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: "email",
      });

      if (verifyError) throw verifyError;
      if (data.user) {
        await verifyStaffRoleAndRedirect(data.user.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-pink-100 p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="M-Care" width={64} height={75} className="mx-auto mb-3 h-[75px] w-16 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">M-CARE CLINIC</h1>
          <p className="text-sm font-semibold text-pink-600 uppercase tracking-wider mt-1">
            Clinical & Administrative Portal
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Balibago, Angeles City • Doctors & Clinic Staff
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              mode === "password"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              mode === "otp"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            OTP Passcode
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border-l-4 border-red-500 rounded-lg text-xs text-red-700 leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-xs text-emerald-700 leading-relaxed">
            {success}
          </div>
        )}

        {/* Password Form */}
        {mode === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="staff@yourclinic.com"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign In to Portal"}
            </button>
          </form>
        )}

        {/* OTP Form */}
        {mode === "otp" && (
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="doctor@yourclinic.com"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
              />
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.trim())}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm tracking-widest font-bold text-center focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-sm shadow-md transition disabled:opacity-50"
            >
              {loading
                ? otpSent
                  ? "Verifying OTP..."
                  : "Sending Code..."
                : otpSent
                ? "Verify OTP & Sign In"
                : "Send One-Time Code"}
            </button>

            {otpSent && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs text-pink-600 hover:text-pink-700 font-semibold"
                >
                  Resend OTP Code
                </button>
              </div>
            )}
          </form>
        )}

        {/* Regulatory footer */}
        <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-1.5">
          <a href="/privacy" className="text-sm font-semibold text-pink-700 underline">Privacy Policy</a>
          <p><a href="/delete-account" className="text-sm text-pink-700 underline">Request account deletion</a></p>
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
