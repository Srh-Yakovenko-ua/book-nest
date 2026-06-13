"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

export function GuardFallback() {
  const t = useTranslations("auth.session");

  return (
    <div
      aria-busy
      aria-live="polite"
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
      role="status"
    >
      <UiIcon aria-hidden className="animate-spin text-primary" name="refresh" size={28} />
      <span className="text-sm">{t("checking")}</span>
    </div>
  );
}
