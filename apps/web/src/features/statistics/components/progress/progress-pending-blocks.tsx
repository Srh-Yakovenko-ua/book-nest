"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";

import type { StatisticsProgressBlock } from "../../model/statistics-progress-blocks";

export function ProgressPendingBlocks({ blocks }: { blocks: readonly StatisticsProgressBlock[] }) {
  const t = useTranslations("statistics.progressPending");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-xl border border-dashed border-border/70 p-4"
    >
      <h2
        className="flex items-center gap-2 font-heading text-lg leading-snug font-semibold text-ink"
        id={headingId}
      >
        <UiIcon aria-hidden className="shrink-0 text-primary" name="info" size={20} />
        {t("title")}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {blocks.map((block) => (
          <li key={block}>{t(`items.${block}`)}</li>
        ))}
      </ul>
    </section>
  );
}
