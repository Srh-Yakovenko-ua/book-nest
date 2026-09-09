"use client";

import type { QuoteView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

type QuoteMetaProps = {
  quote: QuoteView;
  trailing?: ReactNode;
};

export function QuoteMeta({ quote, trailing }: QuoteMetaProps) {
  const t = useTranslations("quotes.card");

  const parts = [
    quote.chapter?.trim(),
    quote.page === null ? undefined : t("pageLabel", { page: quote.page }),
  ].filter((part): part is string => part !== undefined && part.length > 0);

  if (parts.length === 0 && trailing === undefined) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {parts.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>
      )}
      {trailing === undefined ? null : <span className="ml-auto">{trailing}</span>}
    </div>
  );
}
