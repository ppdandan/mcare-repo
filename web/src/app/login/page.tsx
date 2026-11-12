"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { userFacingErrorMessage } from "@m-care/shared";
import SiteFooter from "@/components/ui/SiteFooter";
import Button from "@/components/ui/Button";
import Card, { CardBody } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/AsyncStates";
import StatusAlert from "@/components/ui/StatusAlert";
import TextField from "@/components/ui/TextField";

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
  const supabase = createClient();

  const verifyRoleAndRedirect = async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Unable to retrieve your profile. Please contact the clinic.");
    }

    if (profile.role === "patient") {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSuccess("This website is for clinic staff. Please use the M-Care mobile app. You have been signed out.");
      return;
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
        await verifyRoleAndRedirect(data.user.id);
      }
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err, "We couldn’t sign you in. Check your details and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address.");
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
      setSuccess("A 6-digit OTP code has been sent to your email.");
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err, "We couldn’t send a sign-in code. Check your email address and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !cleanOtp) {
      setError("Please enter both your email and the 6-digit OTP code.");
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
        await verifyRoleAndRedirect(data.user.id);
      }
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err, "We couldn’t verify that code. Request a new code and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-base-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardBody className="p-6 sm:p-8">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="M-Care logo" width={64} height={75} className="mx-auto mb-3 h-[75px] w-16 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-base-content">M-CARE CLINIC</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-primary">
            Staff sign in
          </p>
          <p className="mt-2 text-xs text-base-content/75">
            Balibago, Angeles City • Clinic staff access
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

        {error && <div className="mb-5"><ErrorState title="" description={error} /></div>}

        {success && <div className="mb-5"><StatusAlert variant="success">{success}</StatusAlert></div>}

        {/* Password Form */}
        {mode === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <TextField label="Email Address" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value.trim())} />
            <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" loading={loading} fullWidth>{loading ? "Signing In..." : "Sign In to Portal"}</Button>
          </form>
        )}

        {/* OTP Form */}
        {mode === "otp" && (
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
            <TextField label="Email Address" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value.trim())} />

            {otpSent && (
              <TextField label="6-Digit OTP Code" type="text" inputMode="numeric" maxLength={8} required value={otpCode} onChange={(e) => setOtpCode(e.target.value.trim())} className="text-center font-bold tracking-widest" />
            )}

            <Button type="submit" loading={loading} fullWidth>
              {loading
                ? otpSent
                  ? "Verifying OTP..."
                  : "Sending Code..."
                : otpSent
                ? "Verify OTP & Sign In"
                : "Send One-Time Code"}
            </Button>

            {otpSent && (
              <div className="text-right">
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  variant="outline"
                >
                  Resend OTP Code
                </Button>
              </div>
            )}
          </form>
        )}

        {/* Regulatory footer */}
        <SiteFooter className="mt-6 space-y-1.5">
          <a href="/privacy" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Privacy Policy</a>
          <p><a href="/delete-account" className="inline-flex min-h-11 items-center text-sm text-primary underline">Request account deletion</a></p>
          <p className="text-xs text-base-content/75">
            Republic Act No. 10173 • Philippine Data Privacy Act of 2012
          </p>
          <p className="text-xs text-base-content/75">
            All clinic consultations and patient record queries are logged in immutable audit records.
          </p>
        </SiteFooter>
        </CardBody>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
