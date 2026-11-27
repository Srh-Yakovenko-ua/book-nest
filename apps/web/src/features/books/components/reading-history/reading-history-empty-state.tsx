"use client";

import { useLocale, useTranslations } from "next-intl";

import { Illustration } from "@/components/illustration";

export function ReadingHistoryEmptyState() {
  const t = useTranslations("books.details.readingHistory");
  const locale = useLocale();

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Illustration
        name={locale === "uk" ? "empty-reading-history-uk" : "empty-reading-history-en"}
        size="sm"
      />
      <p className="font-medium text-ink">{t("emptyTitle")}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("emptySubtitle")}</p>
    </div>
  );
}
