import type { Currency, CurrencyDelta, CurrencyTotal, Nullable, NumericDelta } from "@app/shared";

import { CurrencySchema } from "@app/shared";

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;

const PERCENT_DELTA = Object.freeze({
  multiplier: 100,
  undefinedDenominator: 0,
});

export function toCurrencyDeltas({
  current,
  previous,
}: {
  current: readonly CurrencyTotal[];
  previous: readonly CurrencyTotal[];
}): CurrencyDelta[] {
  const currentTotals = totalsByCurrency(current);
  const previousTotals = totalsByCurrency(previous);

  return CURRENCY_ORDER.filter(
    (currency) => currentTotals.has(currency) || previousTotals.has(currency),
  ).map((currency) => ({
    ...toNumericDelta({
      current: currentTotals.get(currency) ?? null,
      previous: previousTotals.get(currency) ?? null,
    }),
    currency,
  }));
}

export function toNumericDelta({
  current,
  previous,
}: {
  current: Nullable<number>;
  previous: Nullable<number>;
}): NumericDelta {
  return {
    absoluteDelta: current === null || previous === null ? null : current - previous,
    current,
    percentDelta: toPercentDelta({ current, previous }),
    previous,
  };
}

function toPercentDelta({
  current,
  previous,
}: {
  current: Nullable<number>;
  previous: Nullable<number>;
}): Nullable<number> {
  if (current === null || previous === null || previous === PERCENT_DELTA.undefinedDenominator) {
    return null;
  }

  return ((current - previous) / previous) * PERCENT_DELTA.multiplier;
}

function totalsByCurrency(rows: readonly CurrencyTotal[]): ReadonlyMap<Currency, number> {
  return new Map(rows.map((row): [Currency, number] => [row.currency, row.total]));
}
