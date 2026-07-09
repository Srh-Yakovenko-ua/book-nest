import type { Currency, CurrencyAverage, CurrencyTotal, Nullable } from "@app/shared";

export function formatCurrencyAverages(
  averages: readonly CurrencyAverage[],
  locale: string,
): string {
  if (averages.length === 0) return "—";
  return averages
    .map((entry) => formatMoney({ amount: entry.average, currency: entry.currency, locale }))
    .join(" · ");
}

export function formatCurrencyTotals(totals: readonly CurrencyTotal[], locale: string): string {
  if (totals.length === 0) return "—";
  return totals
    .map((entry) => formatMoney({ amount: entry.total, currency: entry.currency, locale }))
    .join(" · ");
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
