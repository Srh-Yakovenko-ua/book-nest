"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";
import { assertNever } from "@/lib/assert-never";
import { focusOnMount } from "@/lib/focus-on-mount";
import { cn } from "@/lib/utils";

const FOOTER = {
  allShown: "text-xs text-muted-foreground",
  error: "flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center",
  retryIconSize: 14,
  sentinel: "flex min-h-12 items-center justify-center",
} as const;

type InfiniteScrollFooterProps = {
  allShownLabel?: string;
  className?: string;
  errorLabel: string;
  onLoadMore: () => void;
  retryLabel?: string;
  state: InfiniteScrollState;
};

export function InfiniteScrollFooter({
  allShownLabel,
  className,
  errorLabel,
  onLoadMore,
  retryLabel,
  state,
}: InfiniteScrollFooterProps) {
  const t = useTranslations("common");
  const sentinelRef = useInfiniteScrollSentinel({ enabled: state === "idle", onLoadMore });

  switch (state) {
    case "error":
      return (
        <div className={cn(FOOTER.error, className)} role="alert">
          <p className="text-sm text-error">{errorLabel}</p>
          <Button onClick={onLoadMore} ref={focusOnMount} size="sm" variant="secondary">
            <UiIcon name="refresh" size={FOOTER.retryIconSize} />
            {retryLabel ?? t("retry")}
          </Button>
        </div>
      );
    case "idle":
    case "loading":
      return (
        <div
          aria-busy={state === "loading"}
          aria-live="polite"
          className={cn(FOOTER.sentinel, className)}
          ref={sentinelRef}
          role="status"
        >
          {state === "loading" ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
              <span className="sr-only">{t("loadingMore")}</span>
            </>
          ) : null}
        </div>
      );
    case "none":
      if (allShownLabel === undefined) return null;
      return <p className={cn(FOOTER.allShown, className)}>{allShownLabel}</p>;
    default:
      return assertNever(state);
  }
}
