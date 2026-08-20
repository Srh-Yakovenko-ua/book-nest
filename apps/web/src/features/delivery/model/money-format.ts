import type { Currency, CurrencyAverage, CurrencyTotal, Nullable } from "@app/shared";

type MoneyAmount = {
  amount: number;
  currency: Currency;
};

type MoneyStatValue = {
  caption?: string;
  value: string;
  valueClassName?: string;
};

const MONEY_STAT = {
  compactClassName: "text-2xl",
  compactFromLength: 13,
  emptyValue: "—",
  separator: " · ",
} as const;

export function formatCurrencyAverages(
  averages: readonly CurrencyAverage[],
  locale: string,
): string {
  if (averages.length === 0) return MONEY_STAT.emptyValue;
  return averages
    .map((entry) => formatMoney({ amount: entry.average, currency: entry.currency, locale }))
    .join(MONEY_STAT.separator);
}

export function formatCurrencyTotals(totals: readonly CurrencyTotal[], locale: string): string {
  if (totals.length === 0) return MONEY_STAT.emptyValue;
  return totals
    .map((entry) => formatMoney({ amount: entry.total, currency: entry.currency, locale }))
    .join(MONEY_STAT.separator);
}

export function formatMoney({
  amount,
  currency,
  locale,
}: {
  amount: number;
  currency: Nullable<Currency>;
  locale: string;
}): string {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  return currency === null ? value : `${value} ${currency}`;
}

export function toAveragesStatValue(
  averages: readonly CurrencyAverage[],
  locale: string,
): MoneyStatValue {
  return toMoneyStatValue(
    averages.map((entry) => ({ amount: entry.average, currency: entry.currency })),
    locale,
  );
}

export function toTotalsStatValue(
  totals: readonly CurrencyTotal[],
  locale: string,
): MoneyStatValue {
  return toMoneyStatValue(
    totals.map((entry) => ({ amount: entry.total, currency: entry.currency })),
    locale,
  );
}

function toMoneyStatValue(entries: readonly MoneyAmount[], locale: string): MoneyStatValue {
  const [primary, ...rest] = entries;
  if (primary === undefined) return { value: MONEY_STAT.emptyValue };

  const value = formatMoney({ ...primary, locale });
  const caption = rest.map((entry) => formatMoney({ ...entry, locale })).join(MONEY_STAT.separator);

  return {
    caption: caption === "" ? undefined : caption,
    value,
    valueClassName:
      value.length < MONEY_STAT.compactFromLength ? undefined : MONEY_STAT.compactClassName,
  };
}
