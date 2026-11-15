"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode, Ref } from "react";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { assertNever } from "@/lib/assert-never";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

export type SummaryErrorState = {
  onRetry: () => void;
};

type SummaryErrorCardProps = {
  onRetry: () => void;
  retryButtonRef?: Ref<HTMLButtonElement>;
  retryLabel?: string;
  role?: "alert";
  title?: string;
};

type SummaryErrorContentProps = {
  children: ReactNode;
  className?: string;
  regionLabel?: string;
  retryLabel?: string;
  state: Nullable<SummaryErrorState>;
  title?: string;
};

type SummaryErrorProps = SummaryErrorContentProps & {
  variant?: SummaryErrorVariant;
};

type SummaryErrorVariant = "embedded" | "standalone";

export function SummaryError({ variant = "standalone", ...props }: SummaryErrorProps) {
  switch (variant) {
    case "embedded":
      return <EmbeddedSummaryError {...props} />;
    case "standalone":
      return <StandaloneSummaryError {...props} />;
    default:
      return assertNever(variant);
  }
}

function EmbeddedSummaryError({
  children,
  className,
  regionLabel,
  retryLabel,
  state,
  title,
}: SummaryErrorContentProps) {
  return (
    <div
      aria-label={regionLabel}
      className={className}
      role={regionLabel === undefined ? undefined : "region"}
    >
      {state === null ? (
        children
      ) : (
        <SummaryErrorCard onRetry={state.onRetry} retryLabel={retryLabel} title={title} />
      )}
    </div>
  );
}

function StandaloneSummaryError({
  children,
  className,
  regionLabel,
  retryLabel,
  state,
  title,
}: SummaryErrorContentProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(regionRef);

  return (
    <div
      aria-label={regionLabel}
      className={cn(RETRY_FOCUS_RING.onTarget, className)}
      ref={regionRef}
      role={regionLabel === undefined ? undefined : "region"}
      tabIndex={-1}
    >
      {state === null ? (
        children
      ) : (
        <SummaryErrorCard
          onRetry={withRetryFocus(state.onRetry)}
          retryButtonRef={retryButtonRef}
          retryLabel={retryLabel}
          role="alert"
          title={title}
        />
      )}
    </div>
  );
}

function SummaryErrorCard({
  onRetry,
  retryButtonRef,
  retryLabel,
  role,
  title,
}: SummaryErrorCardProps) {
  const t = useTranslations("common.summaryError");
  const titleId = useId();

  return (
    <div
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
      role={role}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink" id={titleId}>
          {title ?? t("title")}
        </p>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      <Button
        aria-describedby={titleId}
        aria-label={retryLabel}
        onClick={onRetry}
        ref={retryButtonRef}
        size="sm"
        variant="secondary"
      >
        <UiIcon name="refresh" size={16} />
        {t("retry")}
      </Button>
    </div>
  );
}
