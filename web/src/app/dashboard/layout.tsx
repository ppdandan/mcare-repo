"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@m-care/shared";
import Icon, { type IconName } from "@/components/Icon";

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Loading M-Care Portal...
          </p>
        </div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    doctor: "bg-primary-100 text-primary-800",
    nurse: "bg-primary-50 text-primary-700",
    receptionist: "bg-gray-100 text-gray-700",
    admin: "bg-primary-100 text-primary-800",
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 lg:flex-row">
      <header className="border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-700">
            <img src="/logo.png" alt="" width={30} height={35} className="h-9 w-8 object-contain" />
            <span className="min-w-0"><strong className="block truncate text-sm text-gray-900">M-Care Clinic</strong><span className="block truncate text-xs text-gray-600">{profile?.full_name} · {profile?.role}</span></span>
          </Link>
          <button type="button" onClick={handleSignOut} aria-label="Sign out" className="inline-flex shrink-0 items-center gap-2 border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-100">
            <Icon name="logout" size={16} /><span className="hidden min-[380px]:inline">Sign out</span>
          </button>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Clinic navigation">
          {navItems.map((item) => {
            if (item.roles && profile?.role && !item.roles.includes(profile.role)) return null;
            const isActive = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${isActive ? "bg-primary-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}><Icon name={item.icon} size={16} /><span>{item.label}</span></Link>;
          })}
        </nav>
      </header>
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-gray-200 bg-white lg:flex">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            <img src="/logo.png" alt="M-Care" width={36} height={42} className="mr-3 h-10 w-9 object-contain" />
            <div>
              <span className="font-extrabold text-gray-900 tracking-tight text-base">M-CARE</span>
              <span className="text-xs block font-semibold text-pink-600 uppercase tracking-wider">
                OB-GYN Clinic
              </span>
            </div>
          </div>

          {/* User Profile Capsule */}
          <div className="p-4 mx-3 my-3 bg-pink-50/50 rounded-xl border border-pink-100/60 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-gray-900 truncate">{profile?.full_name}</p>
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
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-pink-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-xs font-semibold rounded-lg text-gray-600 transition"
          >
            <Icon name="logout" size={16} />
            <span>Sign Out</span>
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
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

