"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type DeliveryBulkBarProps = {
  count: number;
  onClear: () => void;
  onReceive: () => void;
};

export function DeliveryBulkBar({ count, onClear, onReceive }: DeliveryBulkBarProps) {
  const t = useTranslations("delivery.bulk");

  return (
    <div className="sticky inset-x-0 bottom-3 z-30 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-3">
      <div
        aria-label={t("regionLabel")}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-pop backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 sm:flex-row sm:items-center sm:justify-between"
        role="region"
      >
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm font-medium text-ink" role="status">
            {t("selected", { count })}
          </span>
          <Button
            className="text-muted-foreground hover:text-foreground sm:hidden"
            onClick={onClear}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="x" size={16} />
            <span className="sr-only">{t("clear")}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
          <Button onClick={onReceive} size="sm">
            <UiIcon name="check-circle" size={16} />
            {t("receive")}
          </Button>
          <Button
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            onClick={onClear}
            size="sm"
            variant="ghost"
          >
            {t("clear")}
          </Button>
        </div>
      </div>
    </div>
  );
}
