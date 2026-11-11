import type { HTMLAttributes, ReactNode } from "react";

export default function PageContainer({ className = "", children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <main {...props} className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 ${className}`}>{children}</main>;
}
