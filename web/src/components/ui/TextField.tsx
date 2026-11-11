import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export default function TextField({ label, id, hint, error, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? descriptionId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-control w-full gap-1.5">
      <label htmlFor={fieldId} className="label cursor-pointer justify-start py-0">
        <span className="label-text font-semibold text-base-content">{label}</span>
      </label>
      <input
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={`input input-bordered min-h-11 w-full bg-base-100 text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${error ? "input-error" : ""} ${className}`}
      />
      {hint && <span id={descriptionId} className="text-sm text-base-content/75">{hint}</span>}
      {error && <span id={errorId} className="text-sm text-error">{error}</span>}
    </div>
  );
}
