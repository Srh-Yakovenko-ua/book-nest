import type { CurrencyTotal } from "@app/shared";

import type { InTransitCurrencyTotal } from "./delivery-summary.js";

import { toCurrencyTotals } from "./delivery-summary.js";

export type OrderHistorySummaryData = {
  activeBooksCount: number;
  booksCount: number;
  cancelledBooksCount: number;
  currencyTotals: InTransitCurrencyTotal[];
  ordersCount: number;
  receivedBooksCount: number;
  shipmentsCount: number;
};

export type OrderHistorySummaryView = {
  activeBooksCount: number;
  booksCount: number;
  cancelledBooksCount: number;
  ordersCount: number;
  receivedBooksCount: number;
  shipmentsCount: number;
  totalByCurrency: CurrencyTotal[];
};

export function buildOrderHistorySummaryView(
  data: OrderHistorySummaryData,
): OrderHistorySummaryView {
  return {
    activeBooksCount: data.activeBooksCount,
    booksCount: data.booksCount,
    cancelledBooksCount: data.cancelledBooksCount,
    ordersCount: data.ordersCount,
    receivedBooksCount: data.receivedBooksCount,
    shipmentsCount: data.shipmentsCount,
    totalByCurrency: toCurrencyTotals(data.currencyTotals),
  };
}
