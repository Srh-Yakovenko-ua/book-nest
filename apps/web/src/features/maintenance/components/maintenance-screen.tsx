"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export type MaintenanceScreenProps = {
  checking: boolean;
  longWait: boolean;
  onRetry: () => void;
};

export function MaintenanceScreen({ checking, longWait, onRetry }: MaintenanceScreenProps) {
  const t = useTranslations("maintenance");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.current?.focus();
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-background px-6 py-12 text-foreground outline-none"
      ref={container}
      role="status"
      tabIndex={-1}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, var(--color-primary), transparent 70%)",
        }}
      />

      <main className="relative w-full max-w-lg text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <BookOpen className="size-7 text-primary motion-safe:animate-pulse" />
        </span>

        <h1 className="mt-7 font-display text-[clamp(1.75rem,5vw,2.25rem)] font-semibold tracking-[-0.01em]">
          {t("title")}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          {longWait ? t("longWait") : t("description")}
        </p>

        <Button className="mt-8 cursor-pointer" disabled={checking} onClick={onRetry}>
          <RefreshCw className={checking ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
          {checking ? t("checking") : t("retry")}
        </Button>

        <p className="mt-5 text-sm text-muted-foreground">{t("autoHint")}</p>
      </main>
    </div>
  );
}
