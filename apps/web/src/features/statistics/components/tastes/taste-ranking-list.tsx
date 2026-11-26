"use client";

import type {
  Nullable,
  ReadingStatisticsContextAction,
  ReadingStatisticsDrilldown,
} from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import {
  buildStatisticsDrilldownTarget,
  toContextActionLinks,
} from "../../model/statistics-drilldown";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { StatisticsSubsetDetails } from "../details/statistics-subset-details";

type TasteRankingVariant = "compact" | "default";

type TasteRankingVariantConfig = {
  actionTooltips: boolean;
  hiddenRow: string;
  hidesSingleOrdinal: boolean;
  list: string;
  row: string;
  toggle: string;
  toggleIcon: Nullable<{ collapsed: UiIconName; expanded: UiIconName }>;
  visibleRows: number;
};

const TASTE_RANKING = {
  variants: {
    compact: {
      actionTooltips: true,
      hiddenRow: "hidden",
      hidesSingleOrdinal: true,
      list: "gap-2.5",
      row: "gap-1",
      toggle: "self-start",
      toggleIcon: { collapsed: "chevron-down", expanded: "chevron-up" },
      visibleRows: 5,
    },
    default: {
      actionTooltips: false,
      hiddenRow: "hidden lg:flex",
      hidesSingleOrdinal: false,
      list: "gap-3",
      row: "gap-1.5",
      toggle: "self-start lg:hidden",
      toggleIcon: null,
      visibleRows: 3,
    },
  },
} as const satisfies {
  variants: Record<TasteRankingVariant, TasteRankingVariantConfig>;
};

export type TasteRankingRow = {
  contextActions?: readonly ReadingStatisticsContextAction[];
  drilldown?: ReadingStatisticsDrilldown;
  key: string;
  label: string;
  secondary?: ReactNode;
  value: number;
  valueLabel: string;
};

export function TasteRankingList({
  rows,
  scaleMax,
  variant = "default",
}: {
  rows: readonly TasteRankingRow[];
  scaleMax?: number;
  variant?: TasteRankingVariant;
}) {
  const t = useTranslations("statistics.rankings");
  const [expanded, setExpanded] = useState(false);
  const peak = rows.reduce((max, row) => Math.max(max, row.value), 0);
  const barScale = scaleMax ?? peak;
  const config: TasteRankingVariantConfig = TASTE_RANKING.variants[variant];
  const hiddenCount = Math.max(rows.length - config.visibleRows, 0);
  const isOrdinalShown = !(config.hidesSingleOrdinal && rows.length === 1);

  return (
    <div className="@container flex flex-col gap-3">
      <ol className={cn("flex flex-col", config.list)}>
        {rows.map((row, index) => (
          <li
            className={cn(
              "flex flex-col",
              config.row,
              index >= config.visibleRows && !expanded && config.hiddenRow,
            )}
            key={row.key}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                {isOrdinalShown ? (
                  <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                ) : null}
                <TasteRankingLabel drilldown={row.drilldown} label={row.label} />
                <TasteContextActions actions={row.contextActions ?? []} variant={variant} />
              </span>
              <span className="flex shrink-0 flex-col items-end @sm:flex-row @sm:items-baseline @sm:gap-2">
                {row.secondary === undefined ? null : (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {row.secondary}
                  </span>
                )}
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {row.valueLabel}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${barScale <= 0 ? 0 : (row.value / barScale) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      {hiddenCount === 0 ? null : (
        <Button
          aria-expanded={expanded}
          className={config.toggle}
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          variant="ghost"
        >
          {expanded ? t("showLess") : t("showMore", { count: hiddenCount })}
          {config.toggleIcon === null ? null : (
            <UiIcon
              aria-hidden
              data-icon="inline-end"
              name={expanded ? config.toggleIcon.expanded : config.toggleIcon.collapsed}
              size={14}
            />
          )}
        </Button>
      )}
    </div>
  );
}

function TasteContextActions({
  actions,
  variant,
}: {
  actions: readonly ReadingStatisticsContextAction[];
  variant: TasteRankingVariant;
}) {
  const tActions = useTranslations("statistics.contextActions");
  const links = toContextActionLinks(actions);
  const hasTooltips = TASTE_RANKING.variants[variant].actionTooltips;

  if (links.length === 0) return null;

  return (
    <>
      {links.map((link) => {
        const label = tActions(link.kind);
        const action = (
          <Link
            aria-label={label}
            className="-my-2.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
            href={link.href}
            key={link.kind}
          >
            <UiIcon aria-hidden name="arrow-up-right" size={14} />
          </Link>
        );

        return hasTooltips ? (
          <TooltipHint key={link.kind} label={label}>
            {action}
          </TooltipHint>
        ) : (
          action
        );
      })}
    </>
  );
}

function TasteRankingLabel({
  drilldown,
  label,
}: {
  drilldown?: ReadingStatisticsDrilldown;
  label: string;
}) {
  const t = useTranslations("statistics.details.subset");
  const target = drilldown === undefined ? null : buildStatisticsDrilldownTarget(drilldown);
  const labelClassName =
    "min-w-0 text-sm font-medium break-words whitespace-normal text-foreground";

  if (target === null || target.kind !== "completed_reads_subset") {
    return <span className={labelClassName}>{label}</span>;
  }

  const { filter, period } = target;

  return (
    <StatisticsDetailSurface
      contentClassName="max-h-(--radix-popover-content-available-height) overflow-y-auto"
      detail={() => <StatisticsSubsetDetails filter={filter} period={period} />}
      key={[filter.field, filter.value, period.from ?? "", period.to].join("|")}
      label={t("open", { name: label })}
      title={t("title", { name: label })}
      triggerClassName={cn(
        labelClassName,
        "rounded-sm underline-offset-4 transition-colors outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    >
      {label}
    </StatisticsDetailSurface>
  );
}
