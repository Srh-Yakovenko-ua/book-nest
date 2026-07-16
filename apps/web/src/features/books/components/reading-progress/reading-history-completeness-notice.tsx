"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

export function ReadingHistoryCompletenessNotice() {
  const t = useTranslations("books.details.reading");

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" name="info" size={16} />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-foreground/90">{t("incompleteHistory")}</p>
        <p className="text-xs text-muted-foreground">{t("incompleteHistoryHint")}</p>
      </div>
    </div>
  );
}
