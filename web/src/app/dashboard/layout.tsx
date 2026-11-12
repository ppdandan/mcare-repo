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
  section: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "layout-dashboard", section: "Workspace" },
  { label: "Appointments", href: "/dashboard/appointments", icon: "calendar", section: "Workspace" },
  { label: "Doctor Schedules", href: "/dashboard/schedules", icon: "clock", section: "Workspace" },
  { label: "Patients", href: "/dashboard/patients", icon: "users", section: "Care" },
  { label: "Medical Records", href: "/dashboard/records", icon: "clipboard", section: "Care", roles: ["doctor", "nurse", "admin"] },
  { label: "Patient Inquiries", href: "/dashboard/inquiries", icon: "message", section: "Care" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "receipt", section: "Operations", roles: ["doctor", "admin"] },
  { label: "Analytics", href: "/dashboard/analytics", icon: "chart", section: "Operations", roles: ["admin"] },
  { label: "Reports & Export", href: "/dashboard/reports", icon: "file", section: "Operations" },
  { label: "Staff Management", href: "/dashboard/staff", icon: "settings", section: "Administration", roles: ["admin"] },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const pageTitle = navItems.find((item) => item.href === pathname)?.label ?? "M-Care Dashboard";
  const visibleItems = navItems.filter((item) => !item.roles || (profile?.role && item.roles.includes(profile.role)));
  const renderNavigation = () => {
    let previousSection = "";
    return visibleItems.map((item) => {
      const showSection = item.section !== previousSection;
      previousSection = item.section;
      const isActive = pathname === item.href;
      return <React.Fragment key={item.href}>
        {showSection && <p className="px-3 pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-base-content/60">{item.section}</p>}
        <Link href={item.href} onClick={() => setDrawerOpen(false)} aria-current={isActive ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-btn px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isActive ? "bg-primary text-primary-content" : "text-base-content hover:bg-base-200"}`}>
          <Icon name={item.icon} size={18} /><span>{item.label}</span>
        </Link>
      </React.Fragment>;
    });
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
    <div className="min-h-screen bg-base-200">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 sm:px-6 lg:pl-[17rem]">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" className="btn btn-ghost btn-square lg:hidden"><Icon name="menu" size={20} /></button>
          <h1 className="truncate text-lg font-bold text-base-content">{pageTitle}</h1>
        </div>
        <button type="button" onClick={handleSignOut} className="btn btn-outline btn-sm min-h-11 shrink-0"><Icon name="logout" size={16} /><span className="hidden sm:inline">Sign out</span></button>
      </header>

      {drawerOpen && <button type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-40 bg-neutral/50 lg:hidden" />}

      <aside className={`${drawerOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-base-300 bg-base-100 shadow-xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none`}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-base-300 px-5">
          <img src="/logo.png" alt="M-Care" width={36} height={42} className="h-10 w-9 object-contain" />
          <div><span className="block text-base font-extrabold tracking-tight text-base-content">M-CARE</span><span className="block text-xs font-semibold uppercase tracking-wider text-primary">OB-GYN Clinic</span></div>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="btn btn-ghost btn-square btn-sm ml-auto lg:hidden"><Icon name="close" size={18} /></button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Clinic navigation">{renderNavigation()}</nav>
        <div className="shrink-0 border-t border-base-300 p-4">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2 rounded-box border border-base-300 bg-base-200 p-3">
            <div className="min-w-0"><p className="truncate text-sm font-bold text-base-content">{profile?.full_name}</p><span className={`badge mt-1 ${profile?.role ? roleColors[profile.role] : "badge-ghost"}`}>{profile?.role}</span></div>
            <Icon name="shield-check" size={18} className="shrink-0 text-success" aria-label="Clinic staff account" />
          </div>
          <p className="text-center text-xs text-base-content/70">RA 10173 · DPA 2012 Protected</p>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:ml-64 lg:p-8">{children}</main>
    </div>
  );
}

