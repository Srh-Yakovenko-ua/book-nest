"use client";

import { useTranslations } from "next-intl";

import { Spinner } from "@/components/spinner";

export function GuardFallback() {
  const t = useTranslations("auth.session");

  return (
    <div
      aria-busy
      aria-live="polite"
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
      role="status"
    >
      <Spinner className="text-primary" size="lg" />
      <span className="text-sm">{t("checking")}</span>
    </div>
  );
}
