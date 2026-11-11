"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const patientLinks = [
  { label: "Book", href: "/book" },
  { label: "Appointments", href: "/appointments" },
  { label: "Transactions", href: "/transactions" },
  { label: "Profile", href: "/profile" },
];

export default function PatientHeader({ active }: { active: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) router.replace("/login");
  };

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-white px-4 py-4 shadow-sm sm:px-5">
      <Link href="/book" className="flex shrink-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-800">
        <img src="/logo.png" alt="M-Care" width={42} height={50} className="h-[50px] w-[42px] object-contain" />
        <span><strong className="block text-lg text-gray-900">M-Care</strong><span className="text-sm text-gray-700">Patient portal</span></span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1" aria-label="Patient navigation">
        {patientLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active === link.href ? "page" : undefined}
            className={`rounded-lg px-2.5 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-800 sm:px-3 ${active === link.href ? "bg-rose-100 text-rose-950" : "text-rose-900 hover:bg-rose-50"}`}
          >
            {link.label}
          </Link>
        ))}
        <button type="button" onClick={() => void signOut()} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-800 sm:px-3">Sign out</button>
      </nav>
    </header>
  );
}
