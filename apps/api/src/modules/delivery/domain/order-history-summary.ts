import type { BookOrderHistorySummaryView } from "@app/shared";

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

export function buildOrderHistorySummaryView(
  data: OrderHistorySummaryData,
): BookOrderHistorySummaryView {
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
