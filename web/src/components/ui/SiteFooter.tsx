import type { HTMLAttributes, ReactNode } from "react";

export default function SiteFooter({ className = "", children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <footer {...props} className={`footer footer-center border-t border-base-300 bg-base-200 px-4 py-6 text-center text-sm text-base-content/75 ${className}`}>{children}</footer>;
}
