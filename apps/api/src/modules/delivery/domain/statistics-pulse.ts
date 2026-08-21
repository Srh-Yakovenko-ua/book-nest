import type {
  BookOrderStatisticsComparison,
  BookOrderStatisticsCosts,
  BookOrderStatisticsPulse,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecordScope,
  CurrencyDelta,
  Nullable,
} from "@app/shared";

export const PULSE_RULES = {
  avgBookPriceChangePercent: 8,
  avgLandedCostChangePercent: 8,
  deliverySharePercent: 10,
  discountShareOfSpendPercent: 5,
  maxSignals: 4,
  minLandedCoveragePercent: 50,
  spendChangePercent: 10,
} as const;

type LandedCoverage = {
  coveragePercent: number;
  currency: string;
};

export function buildSpendingPulse({
  comparison,
  costs,
  landedCostDeltas,
  landedCoverage,
  recordMonthByCurrency,
  scope,
  storeGrowth,
}: {
  comparison: Nullable<BookOrderStatisticsComparison>;
  costs: BookOrderStatisticsCosts;
  landedCostDeltas: readonly CurrencyDelta[];
  landedCoverage: readonly LandedCoverage[];
  recordMonthByCurrency: readonly BookOrderStatisticsRecordMonth[];
  scope: BookOrderStatisticsRecordScope;
  storeGrowth: readonly (CurrencyDelta & { store: string })[];
}): BookOrderStatisticsPulse {
  const signals: BookOrderStatisticsPulseSignal[] = [
    ...spendChangeSignals(comparison),
    ...avgBookPriceSignals(comparison),
    ...avgLandedCostSignals({ landedCostDeltas, landedCoverage }),
    ...storeGrowthSignals(storeGrowth),
    ...recordMonthSignals({ recordMonthByCurrency, scope }),
    ...deliveryShareSignals(costs),
    ...discountSavingsSignals(costs),
  ];

  return signals.slice(0, PULSE_RULES.maxSignals);
}

function avgBookPriceSignals(
  comparison: Nullable<BookOrderStatisticsComparison>,
): BookOrderStatisticsPulseSignal[] {
  if (comparison === null) {
    return [];
  }

  return comparison.averageBookPriceByCurrency
    .filter((delta) => isSignificant({ delta, threshold: PULSE_RULES.avgBookPriceChangePercent }))
    .map((delta) => ({ ...delta, code: "avg_book_price_change", tone: "neutral" }));
}

function avgLandedCostSignals({
  landedCostDeltas,
  landedCoverage,
}: {
  landedCostDeltas: readonly CurrencyDelta[];
  landedCoverage: readonly LandedCoverage[];
}): BookOrderStatisticsPulseSignal[] {
  return landedCostDeltas
    .filter((delta) => {
      const coverage = landedCoverage.find((row) => row.currency === delta.currency);
      return (
        coverage !== undefined &&
        coverage.coveragePercent >= PULSE_RULES.minLandedCoveragePercent &&
        isSignificant({ delta, threshold: PULSE_RULES.avgLandedCostChangePercent })
      );
    })
    .map((delta) => ({ ...delta, code: "avg_landed_cost_change", tone: "attention" }));
}

function deliveryShareSignals(costs: BookOrderStatisticsCosts): BookOrderStatisticsPulseSignal[] {
  return costs.flatMap((row) => {
    if (
      row.deliveryShareOfSpendPercent === null ||
      row.deliveryShareOfSpendPercent < PULSE_RULES.deliverySharePercent
    ) {
      return [];
    }

    return [
      {
        code: "delivery_share",
        currency: row.currency,
        deliveryShareOfSpendPercent: row.deliveryShareOfSpendPercent,
        deliveryTotal: row.deliveryTotal,
        tone: "attention",
      },
    ];
  });
}

function discountSavingsSignals(costs: BookOrderStatisticsCosts): BookOrderStatisticsPulseSignal[] {
  return costs.flatMap((row) => {
    if (row.discountTotal <= 0) {
      return [];
    }
    if (
      row.discountShareOfRawSubtotalPercent !== null &&
      row.discountShareOfRawSubtotalPercent < PULSE_RULES.discountShareOfSpendPercent
    ) {
      return [];
    }

    return [
      {
        code: "discount_savings",
        currency: row.currency,
        discountShareOfRawSubtotalPercent: row.discountShareOfRawSubtotalPercent,
        discountTotal: row.discountTotal,
        tone: "positive",
      },
    ];
  });
}

function isSignificant({ delta, threshold }: { delta: CurrencyDelta; threshold: number }): boolean {
  return delta.percentDelta !== null && Math.abs(delta.percentDelta) >= threshold;
}

function recordMonthSignals({
  recordMonthByCurrency,
  scope,
}: {
  recordMonthByCurrency: readonly BookOrderStatisticsRecordMonth[];
  scope: BookOrderStatisticsRecordScope;
}): BookOrderStatisticsPulseSignal[] {
  return recordMonthByCurrency.map((record) => ({
    booksCount: record.booksCount,
    code: "record_month",
    currency: record.currency,
    month: record.month,
    ordersCount: record.ordersCount,
    scope,
    tone: "neutral",
    total: record.total,
  }));
}

function spendChangeSignals(
  comparison: Nullable<BookOrderStatisticsComparison>,
): BookOrderStatisticsPulseSignal[] {
  if (comparison === null) {
    return [];
  }

  return comparison.totalsByCurrency
    .filter((delta) => isSignificant({ delta, threshold: PULSE_RULES.spendChangePercent }))
    .map((delta) => ({ ...delta, code: "spend_change", tone: "neutral" }));
}

function storeGrowthSignals(
  storeGrowth: readonly (CurrencyDelta & { store: string })[],
): BookOrderStatisticsPulseSignal[] {
  return storeGrowth
    .filter((delta) => delta.absoluteDelta !== null && delta.absoluteDelta > 0)
    .map((delta) => ({ ...delta, code: "store_growth", tone: "neutral" }));
}
