import Link from "next/link";
import { BrandLink, SiteHeader } from "@/components/ui/SiteHeader";

export default function PublicHeader() {
  return (
    <SiteHeader className="mx-auto w-full max-w-5xl">
      <BrandLink href="/login" title="M-Care Clinic" subtitle="Patient information" />
      <nav className="menu menu-horizontal flex-wrap items-center gap-1 p-0" aria-label="Public navigation">
        <li><Link href="/privacy" className="min-h-11 rounded-btn px-3 text-sm font-semibold">Privacy</Link></li>
        <li><Link href="/delete-account" className="min-h-11 rounded-btn px-3 text-sm font-semibold">Account deletion</Link></li>
        <li><Link href="/login" className="btn btn-primary min-h-11 rounded-btn px-4 text-sm font-semibold">Sign in</Link></li>
      </nav>
    </SiteHeader>
  );
}
