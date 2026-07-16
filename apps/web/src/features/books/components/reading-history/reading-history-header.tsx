"use client";

import { useTranslations } from "next-intl";

export function ReadingHistoryHeader() {
  const t = useTranslations("books.details.readingHistory");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-lg leading-tight font-semibold text-ink">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}
