"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

export function QuoteSpoilerGate({ action }: { action: ReactNode }) {
  const t = useTranslations("quotes.spoiler");

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center md:h-48">
      <span className="mb-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-icon">
        <UiIcon name="eye-off" size={20} />
      </span>
      <p className="text-sm font-medium text-ink">{t("hiddenText")}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        {t("gateDescription")}
      </p>
      <div className="mt-2">{action}</div>
    </div>
  );
}
