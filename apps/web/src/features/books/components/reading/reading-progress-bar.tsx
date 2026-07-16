"use client";

import { useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ReadingProgressBarProps = {
  currentPage: number;
  muted?: boolean;
  pagesCount: null | number;
  percent: null | number;
};

export function ReadingProgressBar({
  currentPage,
  muted = false,
  pagesCount,
  percent,
}: ReadingProgressBarProps) {
  const t = useTranslations("books.details.reading");

  if (pagesCount === null) {
    return (
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("pagesOnly", { current: currentPage })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-sm text-muted-foreground">
          {t("pagesOf", { current: currentPage, total: pagesCount })}
        </span>
        {percent === null ? null : (
          <span className="text-sm font-semibold text-primary">{percent}%</span>
        )}
      </div>
      {percent === null ? null : (
        <Progress
          aria-label={t("progressLabel")}
          aria-valuenow={percent}
          className={cn("h-1.5", muted && "opacity-60")}
          value={percent}
        />
      )}
    </div>
  );
}
