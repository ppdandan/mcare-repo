import type { TableHTMLAttributes, ReactNode } from "react";

export default function DataTable({ className = "", children, ...props }: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table {...props} className={`table table-zebra w-full ${className}`}>{children}</table>
    </div>
  );
}
