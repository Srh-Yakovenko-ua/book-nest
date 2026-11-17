"use client";

import type {
  Nullable,
  NumericMetricComparison,
  RateMetricComparison,
  ScoreMetricComparison,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import {
  formatPercentagePoints,
  formatRatingScore,
  formatShare,
  isZeroAtPercentPrecision,
  isZeroAtRatingPrecision,
} from "../model/statistics-format";

const DIRECTION_ICON = { down: "arrow-down", flat: "minus", up: "arrow-up" } as const;

type ChangeDirection = Exclude<DeltaDirection, "flat">;

type DeltaDirection = keyof typeof DIRECTION_ICON;

export function StatisticsCountDelta({
  comparison,
  current,
  formatValue,
}: {
  comparison: Nullable<NumericMetricComparison>;
  current: number;
  formatValue: (value: number) => string;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.delta");

  if (comparison === null) return null;

  if (comparison.absoluteDelta === 0) {
    return <DeltaShell direction="flat">{t("unchanged")}</DeltaShell>;
  }

  if (comparison.percentDelta === null) {
    return (
      <DeltaShell direction={toDirection(comparison.absoluteDelta)}>
        {t("fromZero", { current: formatValue(current) })}
      </DeltaShell>
    );
  }

  const direction = toDirection(comparison.absoluteDelta);

  return (
    <DeltaShell direction={direction}>
      <DeltaValue direction={direction}>
        {formatShare(Math.abs(comparison.percentDelta) / 100, locale)}%
      </DeltaValue>
      <span>{t("previous", { previous: formatValue(comparison.previous) })}</span>
    </DeltaShell>
  );
}

export function StatisticsRateDelta({
  comparison,
}: {
  comparison: Nullable<RateMetricComparison>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.delta");

  if (comparison === null) return null;

  if (isZeroAtPercentPrecision(comparison.percentagePointDelta)) {
    return <DeltaShell direction="flat">{t("unchanged")}</DeltaShell>;
  }

  const direction = toDirection(comparison.percentagePointDelta);

  return (
    <DeltaShell direction={direction}>
      <DeltaValue direction={direction}>
        {t("percentagePoints", {
          value: formatPercentagePoints(comparison.percentagePointDelta, locale),
        })}
      </DeltaValue>
      <span>{t("previous", { previous: `${formatShare(comparison.previousRate, locale)}%` })}</span>
    </DeltaShell>
  );
}

export function StatisticsScoreDelta({
  comparison,
}: {
  comparison: Nullable<ScoreMetricComparison>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.delta");

  if (comparison === null) return null;

  if (isZeroAtRatingPrecision(comparison.absoluteDelta)) {
    return <DeltaShell direction="flat">{t("unchanged")}</DeltaShell>;
  }

  const direction = toDirection(comparison.absoluteDelta);

  return (
    <DeltaShell direction={direction}>
      <DeltaValue direction={direction}>
        {formatRatingScore(Math.abs(comparison.absoluteDelta), locale)}
      </DeltaValue>
      <span>{t("previous", { previous: formatRatingScore(comparison.previous, locale) })}</span>
    </DeltaShell>
  );
}

function DeltaShell({ children, direction }: { children: ReactNode; direction: DeltaDirection }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted-foreground">
      <UiIcon aria-hidden className="text-icon" name={DIRECTION_ICON[direction]} size={13} />
      {children}
    </span>
  );
}

function DeltaValue({ children, direction }: { children: ReactNode; direction: ChangeDirection }) {
  const t = useTranslations("statistics.delta.direction");

  return (
    <span className="font-medium text-foreground tabular-nums">
      <span className="sr-only">{t(direction)} </span>
      {children}
    </span>
  );
}

function toDirection(value: number): ChangeDirection {
  return value > 0 ? "up" : "down";
}
