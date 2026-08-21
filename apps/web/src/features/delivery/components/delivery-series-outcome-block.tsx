"use client";

import type { ReceivedSeriesInsight } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import type { DeliverySeriesOutcomeRow } from "../model/history-outcome";

import { buildDeliverySeriesOutcomeRows } from "../model/history-outcome";

type DeliverySeriesOutcomeBlockProps = {
  insights: readonly ReceivedSeriesInsight[];
};

export function DeliverySeriesOutcomeBlock({ insights }: DeliverySeriesOutcomeBlockProps) {
  const t = useTranslations("delivery.history.seriesOutcome");

  const rows = buildDeliverySeriesOutcomeRows({
    insights,
    labels: {
      series_completed: {
        detail: (count) => t("series_completed.detail", { count }),
        label: (count) => t("series_completed.label", { count }),
      },
      series_gaps_closed: {
        detail: (count) => t("series_gaps_closed.detail", { count }),
        label: (count) => t("series_gaps_closed.label", { count }),
      },
      series_topped_up: {
        detail: (count) => t("series_topped_up.detail", { count }),
        label: (count) => t("series_topped_up.label", { count }),
      },
    },
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
        <UiIcon aria-hidden className="shrink-0 text-primary" name="sparkles" size={16} />
        {t("title")}
      </h2>
      <ul className="-mx-1.5 flex flex-col gap-0.5">
        {rows.map((row) => (
          <SeriesOutcomeRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

function SeriesOutcomeRow({ row }: { row: DeliverySeriesOutcomeRow }) {
  return (
    <li className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
      <UiIcon
        aria-hidden
        className="mt-px shrink-0 self-start text-primary"
        name={row.icon}
        size={16}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-xs text-ink">{row.label}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground tabular-nums">
          {row.detail}
        </span>
      </span>
    </li>
  );
}
