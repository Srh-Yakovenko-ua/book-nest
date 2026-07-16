"use client";

import type { ReadingHistoryEventView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/lib/format";

type ReadingHistoryEventProps = {
  event: ReadingHistoryEventView;
};

export function ReadingHistoryEvent({ event }: ReadingHistoryEventProps) {
  const t = useTranslations("books.details.reading");
  const tHistory = useTranslations("books.details.readingHistory");
  const locale = useLocale();

  const hasTime = event.recordedAt.length > 0;

  return (
    <li className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-5 before:absolute before:top-1.5 before:left-0.5 before:size-2 before:-translate-x-1/2 before:rounded-full before:bg-primary/60">
      {hasTime ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="cursor-help text-xs font-medium text-muted-foreground tabular-nums outline-none focus-visible:text-foreground"
              type="button"
            >
              {formatTime(event.recordedAt, locale)}
            </button>
          </TooltipTrigger>
          <TooltipContent>{tHistory("recordedTimeHint")}</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="text-sm font-semibold text-primary tabular-nums">
        {t("pagesDelta", { count: event.pagesRead })}
      </span>
      <span className="text-sm text-muted-foreground tabular-nums">
        {t("toPage", { page: event.page })}
      </span>
    </li>
  );
}
