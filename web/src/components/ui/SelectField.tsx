import { useId } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";

export default function SelectField({ label, id, children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="form-control w-full gap-1.5">
      <label htmlFor={fieldId} className="label cursor-pointer justify-start py-0">
        <span className="label-text font-semibold text-base-content">{label}</span>
      </label>
      <select
        {...props}
        id={fieldId}
        className={`select select-bordered min-h-11 w-full bg-base-100 text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      >
        {children}
      </select>
    </div>
  );
}
