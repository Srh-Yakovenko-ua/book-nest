"use client";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type RelationshipsErrorStateProps = {
  description: string;
  onRetry: () => void;
  retryLabel: string;
  title: string;
};

export function RelationshipsErrorState({
  description,
  onRetry,
  retryLabel,
  title,
}: RelationshipsErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center"
      role="alert"
    >
      <span className="grid size-10 place-items-center rounded-full bg-error-soft text-error">
        <UiIcon name="alert-triangle" size={20} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {retryLabel}
      </Button>
    </div>
  );
}
