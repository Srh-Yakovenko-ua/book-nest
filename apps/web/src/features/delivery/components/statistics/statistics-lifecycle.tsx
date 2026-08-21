"use client";

import type { BookOrderStatisticsLifecycle, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { LifecycleMode, LifecycleRow } from "../../model/statistics-lifecycle";

import { DELIVERY_ROUTES } from "../../model/statistics-drilldown";
import { LIFECYCLE_MODES, lifecycleBreakdown } from "../../model/statistics-lifecycle";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";

const STAGE_HREF: Partial<Record<LifecycleRow["stage"], string>> = {
  cancelled: `${DELIVERY_ROUTES.history}?tab=cancelled`,
  received: `${DELIVERY_ROUTES.history}?tab=received`,
};

export function StatisticsLifecycle({ lifecycle }: { lifecycle: BookOrderStatisticsLifecycle }) {
  const t = useTranslations("delivery.statistics.lifecycle");
  const tStatus = useTranslations("delivery.statistics.orderStatus");
  const locale = useLocale();
  const [mode, setMode] = useState<LifecycleMode>("orders");

  const breakdown = lifecycleBreakdown(lifecycle, mode);

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("modeLabel")}
          metrics={LIFECYCLE_MODES}
          onChange={setMode}
          optionLabel={(value) => t(`modes.${value}`)}
          value={mode}
        />
      }
      className="h-full"
      description={t("subtitle")}
      title={t("title")}
    >
      {breakdown.total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {breakdown.stages.map((row) => (
              <StageRow
                key={row.stage}
                label={tStatus(row.stage)}
                locale={locale}
                row={row}
                unit={t(`units.${mode}`)}
              />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <UiIcon className="text-icon" name="x-circle" size={15} />
              {tStatus("cancelled")}
            </span>
            <StageValue locale={locale} row={breakdown.cancelled} unit={t(`units.${mode}`)} />
          </div>
        </>
      )}
    </StatisticsSection>
  );
}

function LifecycleDelta({ delta, locale }: { delta: Nullable<number>; locale: string }) {
  if (delta === null || delta === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
      <UiIcon name={delta > 0 ? "arrow-up" : "arrow-down"} size={11} />
      {formatNumber(Math.abs(delta), locale)}
    </span>
  );
}

function StageRow({
  label,
  locale,
  row,
  unit,
}: {
  label: string;
  locale: string;
  row: LifecycleRow;
  unit: string;
}) {
  const href = STAGE_HREF[row.stage] ?? null;

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        <StageValue locale={locale} row={row} unit={unit} />
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.max(row.share * 100, row.count > 0 ? 4 : 0)}%` }}
        />
      </div>
    </>
  );

  return (
    <li className="flex flex-col gap-1.5">
      {href === null ? (
        content
      ) : (
        <Link
          className={cn(
            "flex cursor-pointer flex-col gap-1.5 rounded-md transition-colors outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:[&_span:first-child]:text-primary",
          )}
          href={href}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function StageValue({ locale, row, unit }: { locale: string; row: LifecycleRow; unit: string }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-sm font-semibold text-ink tabular-nums">
        {formatNumber(row.count, locale)}
      </span>
      <span className="text-xs text-muted-foreground">{unit}</span>
      <LifecycleDelta delta={row.delta} locale={locale} />
    </span>
  );
}
