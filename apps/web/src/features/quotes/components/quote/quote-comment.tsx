"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

export function QuoteComment({ text }: { text: Nullable<string> }) {
  const t = useTranslations("quotes.card");

  if (text === null) return null;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <UiIcon className="shrink-0 text-icon" name="note" size={13} />
        {t("commentLabel")}
      </p>
      <p className="text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
