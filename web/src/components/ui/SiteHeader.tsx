import Link from "next/link";
import type { ReactNode } from "react";

const headerClasses = "navbar mb-6 min-h-16 flex-wrap gap-x-4 gap-y-2 rounded-box border border-base-300 bg-base-100 px-4 shadow-sm sm:px-5";

export function SiteHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <header className={[headerClasses, className].filter(Boolean).join(" ")}>{children}</header>;
}

export function BrandLink({ href, title, subtitle, className = "" }: { href: string; title: string; subtitle: string; className?: string }) {
  return (
    <Link href={href} className={["inline-flex min-w-0 items-center gap-3 rounded-btn text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className].filter(Boolean).join(" ")}>
      <img src="/logo.png" alt="" width={38} height={44} className="h-11 w-10 shrink-0 object-contain" />
      <span className="min-w-0">
        <strong className="block truncate text-base font-bold">{title}</strong>
        <span className="block truncate text-sm text-base-content/75">{subtitle}</span>
      </span>
    </Link>
  );
}
