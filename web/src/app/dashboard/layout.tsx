"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@m-care/shared";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "📊" },
  { label: "Appointments", href: "/dashboard/appointments", icon: "📅" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "🧾", roles: ["doctor", "admin"] },
  { label: "Doctor Schedules", href: "/dashboard/schedules", icon: "🕒" },
  { label: "Patients", href: "/dashboard/patients", icon: "👥" },
  { label: "Medical Records", href: "/dashboard/records", icon: "📋", roles: ["doctor", "nurse", "admin"] },
  { label: "Patient Inquiries", href: "/dashboard/inquiries", icon: "💬" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "📈", roles: ["admin"] },
  { label: "Reports & Export", href: "/dashboard/reports", icon: "📑" },
  { label: "Staff Management", href: "/dashboard/staff", icon: "⚙️", roles: ["admin"] },
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
    doctor: "bg-purple-100 text-purple-700",
    nurse: "bg-blue-100 text-blue-700",
    receptionist: "bg-emerald-100 text-emerald-700",
    admin: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            <img src="/logo.png" alt="M-Care" width={36} height={42} className="mr-3 h-10 w-9 object-contain" />
            <div>
              <span className="font-extrabold text-gray-900 tracking-tight text-base">M-CARE</span>
              <span className="text-[10px] block font-semibold text-pink-600 uppercase tracking-wider">
                OB-GYN Clinic
              </span>
            </div>
          </div>

          {/* User Profile Capsule */}
          <div className="p-4 mx-3 my-3 bg-pink-50/50 rounded-xl border border-pink-100/60 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-gray-900 truncate">{profile?.full_name}</p>
              <span
                className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded mt-0.5 ${
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
                  <span className="text-base">{item.icon}</span>
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
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-3">
            RA 10173 • DPA 2012 Protected
          </p>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

