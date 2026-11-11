import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";

export default function TextAreaField({ label, id, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="form-control w-full gap-1.5">
      <label htmlFor={fieldId} className="label cursor-pointer justify-start py-0">
        <span className="label-text font-semibold text-base-content">{label}</span>
      </label>
      <textarea
        {...props}
        id={fieldId}
        className={`textarea textarea-bordered min-h-28 w-full bg-base-100 text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      />
    </div>
  );
}
