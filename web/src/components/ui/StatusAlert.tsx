import type { HTMLAttributes, ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "error";

export default function StatusAlert({ variant = "info", className = "", children, ...props }: HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  children: ReactNode;
}) {
  return (
    <div {...props} role={props.role ?? (variant === "error" ? "alert" : "status")} className={`alert alert-${variant} ${className}`}>
      {children}
    </div>
  );
}
