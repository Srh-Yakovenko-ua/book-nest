import type { OrderStatisticsRecord } from "./statistics-scope.js";

export const ORDER_STATISTICS_FETCH = Object.freeze({
  maxOrders: 5000,
  overshootRows: 1,
});

export type OrderStatisticsRecordsPage = {
  isTruncated: boolean;
  loadedOrdersCount: number;
  maxOrders: number;
  records: OrderStatisticsRecord[];
};

export function capOrderStatisticsRecords(
  fetchedRecords: OrderStatisticsRecord[],
): OrderStatisticsRecordsPage {
  const isTruncated = fetchedRecords.length > ORDER_STATISTICS_FETCH.maxOrders;
  const records = isTruncated
    ? fetchedRecords.slice(0, ORDER_STATISTICS_FETCH.maxOrders)
    : fetchedRecords;

  return {
    isTruncated,
    loadedOrdersCount: records.length,
    maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    records,
  };
}
