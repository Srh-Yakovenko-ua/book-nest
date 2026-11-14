"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RefetchErrorState = {
  isRetrying: boolean;
  onRetry: () => void;
};

type RefetchErrorBannerProps = {
  className?: string;
  state: Nullable<RefetchErrorState>;
};

export function RefetchErrorBanner({ className, state }: RefetchErrorBannerProps) {
  const t = useTranslations("common");
  const regionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={
        state === null
          ? "sr-only outline-none"
          : cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )
      }
      ref={regionRef}
      role="status"
      tabIndex={-1}
    >
      {state === null ? null : (
        <>
          <span className="flex items-start gap-2">
            <UiIcon
              aria-hidden
              className="mt-0.5 shrink-0 text-warning"
              name="alert-circle"
              size={16}
            />
            {t("refetchError")}
          </span>
          <Button
            className="h-7 px-2 text-xs"
            loading={state.isRetrying}
            onClick={(event) => {
              if (event.currentTarget === document.activeElement) regionRef.current?.focus();
              state.onRetry();
            }}
            size="sm"
            variant="secondary"
          >
            {t("retry")}
          </Button>
        </>
      )}
    </div>
  );
}
