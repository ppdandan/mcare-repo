import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "primary" | "secondary" | "accent" | "neutral" | "info" | "success" | "warning" | "error" | "outline";

export default function Badge({ variant = "neutral", className = "", children, ...props }: HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  const color = variant === "outline" ? "badge-outline" : `badge-${variant}`;
  return <span {...props} className={`badge ${color} min-h-6 px-2.5 font-semibold ${className}`}>{children}</span>;
}
