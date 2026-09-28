import type { TimelineImportance } from "@app/shared";

import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { importanceMeta } from "../model/importance-meta";

const importanceChipVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        primary: "border-primary/30 bg-primary/10 text-primary",
        warning: "border-warning/40 bg-warning-soft/60 text-warning",
      },
    },
  },
);

type TimelineImportanceChipProps = {
  className?: string;
  importance: TimelineImportance;
  withLabel?: boolean;
};

export function TimelineImportanceChip({
  className,
  importance,
  withLabel = false,
}: TimelineImportanceChipProps) {
  const t = useTranslations("timeline");
  const meta = importanceMeta(importance);
  const value = t(meta.labelKey);

  return (
    <span className={cn(importanceChipVariants({ tone: meta.tone }), className)}>
      <UiIcon aria-hidden className="shrink-0" name={meta.icon} size={12} />
      {withLabel ? t("card.importance", { value }) : value}
    </span>
  );
}
