"use client";

import type { ReadingStatisticsSeriesSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

import { StatisticsNote } from "../statistics-states";
import { ProgressInfoHint } from "./progress-info-hint";

type SeriesLifecycleCounts = NonNullable<ReadingStatisticsSeriesSection["lifecycle"]["data"]>;

const LIFECYCLE_STAGES = [
  { icon: "book-open-text", key: "started" },
  { icon: "trend-up", key: "continued" },
  { icon: "check-circle", key: "completed" },
  { icon: "check-check", key: "caughtUp" },
] as const satisfies readonly { icon: UiIconName; key: keyof SeriesLifecycleCounts }[];

export function SeriesLifecycle({
  lifecycle,
}: {
  lifecycle: ReadingStatisticsSeriesSection["lifecycle"];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");
  const counts = lifecycle.data;

  if (lifecycle.availability === "unavailable" || counts === null) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UiIcon aria-hidden className="shrink-0" name="circle-slash" size={14} />
        <span className="min-w-0">{t("lifecycleUnavailable")}</span>
        <ProgressInfoHint topic={t("lifecycleUnavailable")}>
          {t(`reason.${lifecycle.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
        </ProgressInfoHint>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <dl className="grid grid-cols-2 gap-2 @md:grid-cols-4">
        {LIFECYCLE_STAGES.map((stage) => (
          <div
            className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-secondary/50 px-2.5 py-1.5"
            key={stage.key}
          >
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UiIcon aria-hidden className="shrink-0 text-primary" name={stage.icon} size={14} />
              <span className="min-w-0">{t(`lifecycle.${stage.key}`)}</span>
            </dt>
            <dd className="font-heading text-lg leading-tight font-semibold text-ink tabular-nums">
              {formatNumber(counts[stage.key], locale)}
            </dd>
          </div>
        ))}
      </dl>
      <StatisticsNote>{t("lifecycleNote")}</StatisticsNote>
    </div>
  );
}
