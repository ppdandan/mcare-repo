import type { ReactNode } from "react";
import Button from "./Button";

export default function Modal({ open, title, onClose, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="mcare-dialog-title">
      <div className="modal-box relative max-h-[90vh] overflow-y-auto">
        <h2 id="mcare-dialog-title" className="mb-5 pr-10 text-xl font-bold text-base-content">{title}</h2>
        <Button variant="outline" className="absolute right-4 top-4 min-h-10 px-3" aria-label="Close dialog" onClick={onClose}>Close</Button>
        {children}
      </div>
      <button type="button" className="modal-backdrop" aria-label="Close dialog" onClick={onClose} />
    </div>
  );
}
