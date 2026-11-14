"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode, RefObject } from "react";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SummaryErrorState = {
  onRetry: () => void;
};

type SummaryErrorCardProps = {
  onRetry: (retryButton: HTMLButtonElement) => void;
  regionRef: SummaryRegionRef;
  retried: boolean;
};

type SummaryErrorProps = {
  children: ReactNode;
  className?: string;
  state: Nullable<SummaryErrorState>;
};

type SummaryRegionRef = RefObject<Nullable<HTMLDivElement>>;

export function SummaryError({ children, className, state }: SummaryErrorProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const [retried, setRetried] = useState(false);

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
          onRetry={(retryButton) => {
            if (retryButton === document.activeElement) regionRef.current?.focus();
            setRetried(true);
            state.onRetry();
          }}
          regionRef={regionRef}
          retried={retried}
        />
      )}
    </div>
  );
}

function focusUnlessFocusLeftRegion(regionRef: SummaryRegionRef) {
  return (element: Nullable<HTMLElement>) => {
    const { activeElement } = document;
    const focusStayedInRegion =
      activeElement === document.body || regionRef.current?.contains(activeElement) === true;
    if (focusStayedInRegion) element?.focus();
  };
}

function SummaryErrorCard({ onRetry, regionRef, retried }: SummaryErrorCardProps) {
  const t = useTranslations("common.summaryError");
  const [retryButtonRef] = useState(() =>
    retried ? focusUnlessFocusLeftRegion(regionRef) : undefined,
  );

  return (
    <div
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
      role="alert"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      <Button
        onClick={(event) => onRetry(event.currentTarget)}
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
