"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReadingHistoryErrorProps = {
  className?: string;
  onRetry: () => void;
};

export function ReadingHistoryError({ className, onRetry }: ReadingHistoryErrorProps) {
  const t = useTranslations("books.details.reading");

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-6 text-center",
        className,
      )}
      role="alert"
    >
      <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      <Button onClick={onRetry} size="sm" variant="outline">
        <UiIcon name="refresh" size={16} />
        {t("retry")}
      </Button>
    </div>
  );
}
