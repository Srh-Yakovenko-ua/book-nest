"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode, Ref } from "react";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

export type SummaryErrorState = {
  onRetry: () => void;
};

type SummaryErrorCardProps = {
  onRetry: () => void;
  retryButtonRef?: Ref<HTMLButtonElement>;
  role?: "alert";
  title?: string;
};

type SummaryErrorContentProps = {
  children: ReactNode;
  className?: string;
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

function EmbeddedSummaryError({ children, className, state, title }: SummaryErrorContentProps) {
  return (
    <div className={className}>
      {state === null ? children : <SummaryErrorCard onRetry={state.onRetry} title={title} />}
    </div>
  );
}

function StandaloneSummaryError({ children, className, state, title }: SummaryErrorContentProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(regionRef);

  return (
    <div
      className={cn(
        "rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      ref={regionRef}
      tabIndex={-1}
    >
      {state === null ? (
        children
      ) : (
        <SummaryErrorCard
          onRetry={withRetryFocus(state.onRetry)}
          retryButtonRef={retryButtonRef}
          role="alert"
          title={title}
        />
      )}
    </div>
  );
}

function SummaryErrorCard({ onRetry, retryButtonRef, role, title }: SummaryErrorCardProps) {
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
