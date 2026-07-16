"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

export function ReadingHistoryEmptyState() {
  const t = useTranslations("books.details.readingHistory");

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="chart" size={24} />
      </span>
      <p className="font-medium text-ink">{t("emptyTitle")}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("emptySubtitle")}</p>
    </div>
  );
}
