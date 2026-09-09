"use client";

import type { BookOrderStatisticsStore, Currency, Nullable } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { z } from "zod";

import type { ChartConfig } from "@/components/ui/chart";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { StoreScatterPoint } from "../../model/statistics-stores";

import { formatMoney } from "../../model/money-format";
import { statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { storeScatter } from "../../model/statistics-stores";
import { StatisticsDrilldownMenuContent } from "./statistics-drilldown-action";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const STORE_MAP = {
  activeRadius: 7,
  activeRing: { gap: 4, width: 2 },
  axisDomain: [0, "auto"],
  chartMargin: { bottom: 8, left: 4, right: 16, top: 16 },
  focusRing: { gap: 8, strokeDasharray: "3 3", strokeWidth: 1.5 },
  guideLine: {
    activeOpacity: 0.6,
    inactiveOpacity: 0,
    neutralSegment: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    stroke: "var(--accent-foreground)",
    strokeDasharray: "4 4",
  },
  hitRadius: 12,
  minimumPoints: 2,
  mutedOpacity: 0.35,
  pointRadius: 5,
  selectKeys: ["Enter", " "],
} as const;

const StorePointPayloadSchema = z.object({ storeKey: z.string() });

type ScatterPointShapeProps = {
  cx?: number;
  cy?: number;
  payload?: unknown;
};

type StoreMapPointState = {
  activePoint: Nullable<StoreScatterPoint>;
  blur: (storeKey: string) => void;
  currency: Currency;
  focus: (storeKey: string) => void;
  focusedStoreKey: Nullable<string>;
  hover: (storeKey: Nullable<string>) => void;
  points: readonly StoreScatterPoint[];
  select: (storeKey: string) => void;
  selectedStoreKey: Nullable<string>;
};

const StoreMapPointContext = createContext<Nullable<StoreMapPointState>>(null);

const renderStorePoint = (props: ScatterPointShapeProps) => <StorePoint {...props} />;

export function StatisticsStoreMap({
  activeStoreKey,
  currency,
  drilldown,
  onHover,
  onSelect,
  selectedStoreKey,
  stores,
}: {
  activeStoreKey: Nullable<string>;
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  onHover: (storeKey: Nullable<string>) => void;
  onSelect: (storeKey: string) => void;
  selectedStoreKey: Nullable<string>;
  stores: readonly BookOrderStatisticsStore[];
}) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();
  const [focusedStoreKey, setFocusedStoreKey] = useState<Nullable<string>>(null);

  const { excluded, points } = useMemo(
    () => storeScatter({ currency, stores }),
    [currency, stores],
  );
  const formatAxisTick = useCallback(
    (value: number) => formatNumber(value, locale, { notation: "compact" }),
    [locale],
  );

  if (points.length < STORE_MAP.minimumPoints) {
    return (
      <StatisticsSection
        className="h-full border-border/60 bg-background/50 shadow-none"
        description={t("subtitle")}
        title={t("title")}
      >
        <StatisticsSectionState
          description={t("insufficientHelper", { count: STORE_MAP.minimumPoints })}
          kind="insufficient"
          title={t("insufficient")}
        />
        <ExcludedStoresNote count={excluded.length} />
      </StatisticsSection>
    );
  }

  const activePoint = points.find((point) => point.storeKey === activeStoreKey) ?? null;
  const selectedPoint = points.find((point) => point.storeKey === selectedStoreKey) ?? null;

  const config = {
    averageOrderAmount: { color: "var(--chart-1)", label: t("axisY") },
  } satisfies ChartConfig;

  const guides = {
    opacity:
      activePoint === null
        ? STORE_MAP.guideLine.inactiveOpacity
        : STORE_MAP.guideLine.activeOpacity,
    toAxisX:
      activePoint === null
        ? STORE_MAP.guideLine.neutralSegment
        : ([
            { x: activePoint.averageLandedBookCost, y: 0 },
            { x: activePoint.averageLandedBookCost, y: activePoint.averageOrderAmount },
          ] as const),
    toAxisY:
      activePoint === null
        ? STORE_MAP.guideLine.neutralSegment
        : ([
            { x: 0, y: activePoint.averageOrderAmount },
            { x: activePoint.averageLandedBookCost, y: activePoint.averageOrderAmount },
          ] as const),
  };

  const pointState = {
    activePoint,
    blur: (storeKey: string) => {
      if (focusedStoreKey !== storeKey) return;
      setFocusedStoreKey(null);
      onHover(null);
    },
    currency,
    focus: (storeKey: string) => {
      setFocusedStoreKey(storeKey);
      onHover(storeKey);
    },
    focusedStoreKey,
    hover: onHover,
    points,
    select: onSelect,
    selectedStoreKey,
  } satisfies StoreMapPointState;

  return (
    <StatisticsSection
      className="h-full border-border/60 bg-background/50 shadow-none"
      description={t("subtitle")}
      title={t("title")}
    >
      <div className="flex min-w-0 items-stretch gap-1.5">
        <span className="rotate-180 self-center text-[0.6875rem] text-muted-foreground [writing-mode:vertical-rl]">
          {t("axisLabelY", { currency })}
        </span>
        <StoreMapPointContext value={pointState}>
          <ChartContainer
            aria-label={t("aria")}
            className="aspect-auto h-[16rem] min-w-0 flex-1 sm:h-[20rem]"
            config={config}
            role="group"
          >
            <ScatterChart margin={STORE_MAP.chartMargin}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis
                axisLine={{ stroke: "var(--border)" }}
                dataKey="averageLandedBookCost"
                domain={STORE_MAP.axisDomain}
                name={t("axisX")}
                tickFormatter={formatAxisTick}
                tickLine={false}
                type="number"
              />
              <YAxis
                axisLine={false}
                dataKey="averageOrderAmount"
                domain={STORE_MAP.axisDomain}
                name={t("axisY")}
                tickFormatter={formatAxisTick}
                tickLine={false}
                type="number"
                width={52}
              />
              <ReferenceLine
                segment={guides.toAxisX}
                stroke={STORE_MAP.guideLine.stroke}
                strokeDasharray={STORE_MAP.guideLine.strokeDasharray}
                strokeOpacity={guides.opacity}
              />
              <ReferenceLine
                segment={guides.toAxisY}
                stroke={STORE_MAP.guideLine.stroke}
                strokeDasharray={STORE_MAP.guideLine.strokeDasharray}
                strokeOpacity={guides.opacity}
              />
              <ChartTooltip
                content={<StoreMapTooltip activePoint={activePoint} currency={currency} />}
                cursor={false}
              />
              <Scatter data={points} isAnimationActive={false} shape={renderStorePoint} />
            </ScatterChart>
          </ChartContainer>
        </StoreMapPointContext>
      </div>

      <p className="text-center text-[0.6875rem] text-muted-foreground">
        {t("axisLabelX", { currency })}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("axisHintX")}</span>
        <span>{t("axisHintY")}</span>
      </div>

      <StoreMapAction drilldown={drilldown} point={selectedPoint} />

      <ExcludedStoresNote count={excluded.length} />
    </StatisticsSection>
  );
}

function ExcludedStoresNote({ count }: { count: number }) {
  const t = useTranslations("delivery.statistics.storeMap");

  if (count === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        className="flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
        type="button"
      >
        <UiIcon aria-hidden name="info" size={13} />
        {t("excluded", { count })}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-xs">
        {t("excludedHint")}
      </PopoverContent>
    </Popover>
  );
}

function StoreMapAction({
  drilldown,
  point,
}: {
  drilldown: StatisticsDrilldownContext;
  point: Nullable<StoreScatterPoint>;
}) {
  const t = useTranslations("delivery.statistics.storeMap");

  if (point === null) {
    return <p className="text-xs text-muted-foreground">{t("selectHint")}</p>;
  }

  const links = statisticsDrilldownLinks({
    breakdown: point.drilldown,
    context: drilldown,
    metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
    scope: { kind: "store", store: point.store },
  });
  const only = links.at(0);

  if (only === undefined) {
    return null;
  }

  const label = t("openStore", { store: point.store });

  if (links.length === 1) {
    return (
      <Link
        className="w-fit text-sm text-primary underline-offset-2 hover:underline"
        href={only.href}
      >
        {label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-auto w-fit p-0 text-sm" size="sm" variant="link">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <StatisticsDrilldownMenuContent align="start" links={links} unit="orders" />
    </DropdownMenu>
  );
}

function StoreMapTooltip({
  active,
  activePoint,
  currency,
}: {
  active?: boolean;
  activePoint: Nullable<StoreScatterPoint>;
  currency: Currency;
}) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();

  if (active !== true || activePoint === null) {
    return null;
  }

  return (
    <div className="grid min-w-56 gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium text-ink">{activePoint.store}</div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{t("axisX")}</dt>
        <dd className="text-end font-semibold text-ink tabular-nums">
          {formatMoney({ amount: activePoint.averageLandedBookCost, currency, locale })}
        </dd>
        <dt className="text-muted-foreground">{t("axisY")}</dt>
        <dd className="text-end font-semibold text-ink tabular-nums">
          {formatMoney({ amount: activePoint.averageOrderAmount, currency, locale })}
        </dd>
      </dl>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>{t("booksInCalculation")}</dt>
        <dd className="text-end tabular-nums">
          {t("booksInCalculationValue", {
            counted: activePoint.landedEligibleBooksCount,
            total: activePoint.currencyBooksCount,
          })}
        </dd>
        <dt>{t("ordersCount")}</dt>
        <dd className="text-end tabular-nums">
          {formatNumber(activePoint.currencyOrdersCount, locale)}
        </dd>
        <dt>{t("coverage")}</dt>
        <dd className="text-end tabular-nums">
          {formatPercentValue(activePoint.coveragePercent, locale)}
        </dd>
      </dl>
    </div>
  );
}

function StorePoint({ cx, cy, payload }: ScatterPointShapeProps) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();
  const state = useContext(StoreMapPointContext);

  if (state === null || cx === undefined || cy === undefined) {
    return null;
  }

  const parsed = StorePointPayloadSchema.safeParse(payload);
  const point = parsed.success
    ? (state.points.find((entry) => entry.storeKey === parsed.data.storeKey) ?? null)
    : null;

  if (point === null) {
    return null;
  }

  const isActive = point.storeKey === state.activePoint?.storeKey;
  const isFocused = point.storeKey === state.focusedStoreKey;

  return (
    <g
      data-testid={`store-point-${point.storeKey}`}
      opacity={state.activePoint === null || isActive || isFocused ? 1 : STORE_MAP.mutedOpacity}
    >
      <circle
        aria-label={t("pointAria", {
          cost: formatMoney({
            amount: point.averageLandedBookCost,
            currency: state.currency,
            locale,
          }),
          order: formatMoney({
            amount: point.averageOrderAmount,
            currency: state.currency,
            locale,
          }),
          store: point.store,
        })}
        aria-pressed={point.storeKey === state.selectedStoreKey}
        className="cursor-pointer outline-none"
        cx={cx}
        cy={cy}
        fill="transparent"
        onBlur={() => state.blur(point.storeKey)}
        onClick={() => state.select(point.storeKey)}
        onFocus={() => state.focus(point.storeKey)}
        onKeyDown={(event) => {
          if (!STORE_MAP.selectKeys.some((key) => key === event.key)) return;
          event.preventDefault();
          state.select(point.storeKey);
        }}
        onMouseEnter={() => state.hover(point.storeKey)}
        onMouseLeave={() => state.hover(null)}
        r={STORE_MAP.hitRadius}
        role="button"
        tabIndex={0}
      />
      {isFocused ? (
        <circle
          cx={cx}
          cy={cy}
          data-testid="store-point-focus-ring"
          fill="none"
          pointerEvents="none"
          r={STORE_MAP.activeRadius + STORE_MAP.focusRing.gap}
          stroke="var(--ring)"
          strokeDasharray={STORE_MAP.focusRing.strokeDasharray}
          strokeWidth={STORE_MAP.focusRing.strokeWidth}
        />
      ) : null}
      {isActive ? (
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          pointerEvents="none"
          r={STORE_MAP.activeRadius + STORE_MAP.activeRing.gap}
          stroke="var(--accent-foreground)"
          strokeWidth={STORE_MAP.activeRing.width}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        fill={isActive ? "var(--chart-1)" : "color-mix(in srgb, var(--chart-1) 55%, var(--card))"}
        pointerEvents="none"
        r={isActive ? STORE_MAP.activeRadius : STORE_MAP.pointRadius}
        stroke="var(--chart-1)"
        strokeWidth={1.5}
      />
    </g>
  );
}
