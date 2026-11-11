import type { HTMLAttributes, ReactNode } from "react";

export default function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div {...props} className={["card card-bordered rounded-box border-base-300 bg-base-100 shadow-sm", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function CardBody({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div {...props} className={`card-body ${className}`}>{children}</div>;
}
