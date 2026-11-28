"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@m-care/shared";
import Icon, { type IconName } from "@/components/Icon";
import "./shell.css";
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
  { label: "Inventory", href: "/dashboard/inventory", icon: "list", section: "Operations", roles: ["admin"] },
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
  const [expanded, setExpanded] = useState(true);
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
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

  useEffect(() => {
    const restore = () => {
      try { setExpanded(localStorage.getItem("mcare_sidebar_open") !== "0"); } catch {}
    };
    restore();
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => { drawer.current?.close(); setTip(null); };
    desktop.addEventListener("change", onResize);
    window.addEventListener("storage", restore);
    return () => {
      desktop.removeEventListener("change", onResize);
      window.removeEventListener("storage", restore);
    };
  }, []);

  useEffect(() => {
    main.current?.scrollTo(0, 0);
    drawer.current?.close();
    setTip(null);
  }, [pathname]);

  function toggleSidebar() {
    setTip(null);
    setExpanded(!expanded);
    try { localStorage.setItem("mcare_sidebar_open", expanded ? "0" : "1"); } catch {}
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const pageTitle = navItems.find((item) => item.href === pathname)?.label ?? "M-Care Dashboard";
  const visibleItems = navItems.filter((item) => !item.roles || (profile?.role && item.roles.includes(profile.role)));
  function renderNavigation(labels: boolean, mobile = false) {
    return <nav aria-label="Clinic navigation" className="shell-nav" onScroll={() => setTip(null)}>
      {visibleItems.map((item, index) => {
        const sectionStart = item.section !== visibleItems[index - 1]?.section;
        const showTip = (anchor: HTMLAnchorElement) => {
          if (labels) return;
          const bounds = anchor.getBoundingClientRect();
          setTip({ label: item.label, top: bounds.top + bounds.height / 2, left: bounds.right + 12 });
        };
        return <React.Fragment key={item.href}>
          {sectionStart && (labels
            ? <p className="shell-section">{item.section}</p>
            : index > 0 && <hr className="mx-2 my-2 border-base-300" />)}
          <Link href={item.href} aria-label={item.label} aria-current={pathname === item.href ? "page" : undefined}
            className={`shell-link ${labels ? "" : "justify-center"}`}
            onFocus={e => showTip(e.currentTarget)} onBlur={() => setTip(null)}
            onMouseEnter={e => showTip(e.currentTarget)} onMouseLeave={() => setTip(null)}
            onKeyDown={e => { if (e.key === "Escape") setTip(null); }}
            onClick={() => { setTip(null); if (mobile) drawer.current?.close(); }}>
            <Icon name={item.icon} size={18} className="shrink-0" />
            {labels && <span>{item.label}</span>}
          </Link>
        </React.Fragment>;
      })}
    </nav>;
  }

  function brand(labels: boolean) {
    return <div className="shell-brand">
      <img src="/logo.png" alt={labels ? "" : "M-Care"} width={32} height={38} className="h-9 w-8 shrink-0 object-contain" />
      {labels && <div><strong className="block text-lg leading-tight">M-Care</strong>
        <span className="text-xs text-base-content/75">OB-GYN Clinic</span></div>}
    </div>;
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-base-200 p-4">
    <LoadingState label="Loading dashboard…" />
  </div>;

  return (
    <div className="dashboard-shell">
      <aside id="desktop-navigation" aria-label="Sidebar" className={`shell-sidebar ${expanded ? "w-64" : "w-16"}`}>
        {brand(expanded)}
        {renderNavigation(expanded)}
        {expanded && profile && <div className="shell-account">
          <span className="block truncate font-semibold">{profile.full_name}</span>
          <span className="capitalize text-base-content/75">{profile.role}</span>
        </div>}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shell-header">
          <button className="shell-control hidden md:inline-flex" onClick={toggleSidebar}
            aria-controls="desktop-navigation" aria-expanded={expanded} aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}>
            <Icon name={expanded ? "chevron-left" : "chevron-right"} size={20} />
          </button>
          <button className="shell-control inline-flex md:hidden" aria-label="Open navigation" aria-haspopup="dialog"
            onClick={() => drawer.current?.showModal()}><Icon name="menu" size={20} /></button>
          <h1 className="min-w-0 flex-1 text-lg font-semibold leading-tight">{pageTitle}</h1>
          <button className="shell-control inline-flex gap-2 px-3" onClick={handleSignOut} aria-label="Sign out">
            <Icon name="logout" size={18} /><span className="hidden sm:inline">Sign out</span>
          </button>
        </header>
        <main ref={main} className="shell-main">{children}</main>
      </div>
      <dialog ref={drawer} className="shell-drawer" aria-label="Clinic menu"
        onClick={event => { if (event.clientX > event.currentTarget.getBoundingClientRect().right) drawer.current?.close(); }}>
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-base-300 pr-2">
            {brand(true)}
            <button className="shell-control inline-flex" aria-label="Close navigation" onClick={() => drawer.current?.close()}>
              <Icon name="close" size={20} /></button>
          </div>
          {renderNavigation(true, true)}
        </div>
      </dialog>
      {tip && <span role="tooltip" className="shell-tooltip" style={{ top: tip.top, left: tip.left }}>{tip.label}</span>}
    </div>
  );
}
