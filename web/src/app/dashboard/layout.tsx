"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@m-care/shared";
import Icon, { type IconName } from "@/components/Icon";
import { LoadingState } from "@/components/ui/AsyncStates";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Appointments", href: "/dashboard/appointments", icon: "calendar" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "receipt", roles: ["doctor", "admin"] },
  { label: "Doctor Schedules", href: "/dashboard/schedules", icon: "clock" },
  { label: "Patients", href: "/dashboard/patients", icon: "users" },
  { label: "Medical Records", href: "/dashboard/records", icon: "clipboard", roles: ["doctor", "nurse", "admin"] },
  { label: "Patient Inquiries", href: "/dashboard/inquiries", icon: "message" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "chart", roles: ["admin"] },
  { label: "Reports & Export", href: "/dashboard/reports", icon: "file" },
  { label: "Staff Management", href: "/dashboard/staff", icon: "settings", roles: ["admin"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getSessionProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error || !data || data.role === "patient") {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    }

    getSessionProfile();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md"><LoadingState label="Loading M-Care Portal..." /></div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    doctor: "bg-primary-100 text-primary-800",
    nurse: "bg-primary-50 text-primary-700",
    receptionist: "bg-base-200 text-base-content",
    admin: "bg-primary-100 text-primary-800",
  };

  return (
    <div className="min-h-screen flex flex-col bg-base-200 lg:flex-row">
      <header className="border-b border-base-300 bg-base-100 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <img src="/logo.png" alt="" width={30} height={35} className="h-9 w-8 object-contain" />
            <span className="min-w-0"><strong className="block truncate text-sm text-base-content">M-Care Clinic</strong><span className="block truncate text-xs text-base-content/80">{profile?.full_name} · {profile?.role}</span></span>
          </Link>
          <button type="button" onClick={handleSignOut} aria-label="Sign out" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-btn border border-base-300 px-3 text-sm text-base-content hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <Icon name="logout" size={16} /><span className="hidden min-[380px]:inline">Sign out</span>
          </button>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Clinic navigation">
          {navItems.map((item) => {
            if (item.roles && profile?.role && !item.roles.includes(profile.role)) return null;
            const isActive = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-btn px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isActive ? "bg-primary text-primary-content" : "text-base-content hover:bg-base-200"}`}><Icon name={item.icon} size={16} /><span>{item.label}</span></Link>;
          })}
        </nav>
      </header>
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-base-300 bg-base-100 lg:flex">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center px-6 border-b border-base-300">
            <img src="/logo.png" alt="M-Care" width={36} height={42} className="mr-3 h-10 w-9 object-contain" />
            <div>
              <span className="font-extrabold text-base-content tracking-tight text-base">M-CARE</span>
              <span className="text-xs block font-semibold text-primary uppercase tracking-wider">
                OB-GYN Clinic
              </span>
            </div>
          </div>

          {/* User Profile Capsule */}
          <div className="p-4 mx-3 my-3 bg-primary/5 rounded-xl border border-primary/20/60 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-base-content truncate">{profile?.full_name}</p>
              <span
                className={`inline-block px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded mt-0.5 ${
                  profile?.role ? roleColors[profile.role] : ""
                }`}
              >
                {profile?.role}
              </span>
            </div>
            <span className="text-xs text-emerald-500" title="DPA 2012 Active">●</span>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              if (item.roles && profile?.role && !item.roles.includes(profile.role)) {
                return null;
              }
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center space-x-3 px-3 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-base-content/80 hover:bg-base-200 hover:text-base-content"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-base-300">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 border border-base-300 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-xs font-semibold rounded-lg text-base-content/80 transition"
          >
            <Icon name="logout" size={16} />
            <span>Sign Out</span>
          </button>
          <p className="text-xs text-base-content/60 text-center mt-3">
            RA 10173 • DPA 2012 Protected
          </p>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

