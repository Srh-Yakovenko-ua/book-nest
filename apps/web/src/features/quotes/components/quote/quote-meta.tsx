"use client";

import type { QuoteView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type QuoteMetaProps = {
  isCompact?: boolean;
  quote: QuoteView;
  trailing?: ReactNode;
};

export function QuoteMeta({ isCompact = false, quote, trailing }: QuoteMetaProps) {
  const t = useTranslations("quotes.card");

  const parts = [
    quote.chapter?.trim(),
    quote.page === null ? undefined : t("pageLabel", { page: quote.page }),
  ].filter((part): part is string => part !== undefined && part.length > 0);

  if (parts.length === 0 && trailing === undefined) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        isCompact && "md:shrink-0 md:flex-nowrap md:overflow-hidden",
      )}
    >
      {parts.length === 0 ? null : (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            isCompact && "md:min-w-0",
          )}
        >
          <UiIcon className="shrink-0 text-icon" name="book" size={13} />
          <span className={cn(isCompact && "md:min-w-0 md:truncate")}>{parts.join(" · ")}</span>
        </p>
      )}
      {trailing === undefined ? null : <span className="ml-auto shrink-0">{trailing}</span>}
    </div>
  );
}
