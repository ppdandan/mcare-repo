"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { BrandLink, SiteHeader } from "@/components/ui/SiteHeader";

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
    <SiteHeader>
      <BrandLink href="/book" title="M-Care" subtitle="Patient portal" />
      <nav className="menu menu-horizontal flex-wrap items-center gap-1 p-0" aria-label="Patient navigation">
        {patientLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active === link.href ? "page" : undefined}
              className={["min-h-11 rounded-btn px-2.5 text-sm font-semibold sm:px-3", active === link.href ? "active" : ""].filter(Boolean).join(" ")}
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li><Button type="button" variant="outline" className="min-h-11 px-3" onClick={() => void signOut()}>Sign out</Button></li>
      </nav>
    </SiteHeader>
  );
}
