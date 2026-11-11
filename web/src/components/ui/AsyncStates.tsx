import type { ReactNode } from "react";
import Button from "./Button";
import Card, { CardBody } from "./Card";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-28 items-center justify-center gap-3 rounded-box border border-base-300 bg-base-100 p-6 text-base-content/75">
      <span className="loading loading-spinner loading-md text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <Card>
      <CardBody className="items-center py-10 text-center">
        <h2 className="text-lg font-bold text-base-content">{title}</h2>
        {description && <p className="max-w-prose text-base-content/75">{description}</p>}
        {children}
      </CardBody>
    </Card>
  );
}

export function ErrorState({ title = "We could not load this information", description = "Check your connection and try again.", onRetry }: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="alert alert-error items-start">
      <div className="min-w-0 flex-1">
        <h2 className="font-bold">{title}</h2>
        <p>{description}</p>
      </div>
      {onRetry && <Button variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}
