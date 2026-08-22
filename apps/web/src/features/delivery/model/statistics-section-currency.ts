import type { Currency, Nullable } from "@app/shared";

import { resolveMoneyCurrency } from "./statistics-currency";

export type StatisticsSectionCurrencies = {
  budget: StatisticsSectionCurrency;
  costs: StatisticsSectionCurrency;
  dynamics: StatisticsSectionCurrency;
  records: StatisticsSectionCurrency;
  stores: StatisticsSectionCurrency;
  topOrders: StatisticsSectionCurrency;
};

export type StatisticsSectionCurrency = {
  onChange: (currency: Currency) => void;
  value: Currency;
};

export function sectionCurrencyControl({
  available,
  commit,
  dashboardCurrency,
  override,
}: {
  available: readonly Currency[];
  commit: (override: Nullable<Currency>) => void;
  dashboardCurrency: Currency;
  override: Nullable<Currency>;
}): StatisticsSectionCurrency {
  return {
    onChange: (next) => commit(next === dashboardCurrency ? null : next),
    value: resolveMoneyCurrency({ available, preferred: override ?? dashboardCurrency }),
  };
}
