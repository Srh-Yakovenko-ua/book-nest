import type { BookOrderHistorySummaryView, LatestReceiptView, Nullable } from "@app/shared";

export type OrderHistorySummaryData = {
  cancelledBooksCount: number;
  cancelledOrdersCount: number;
  completedOrdersCount: number;
  completedWithCancellationsCount: number;
  completedWithoutCancellationsCount: number;
  receivedBooksCount: number;
  receivedOrdersCount: number;
  receivedSeriesBooksCount: number;
  receivedSeriesCount: number;
  receivedShipmentsCount: number;
  receivedStandaloneBooksCount: number;
};

export type OrderHistorySummarySource = OrderHistorySummaryData & {
  latestReceipt: Nullable<LatestReceiptView>;
};

export function buildOrderHistorySummaryView(
  data: OrderHistorySummarySource,
): BookOrderHistorySummaryView {
  return {
    cancelledBooksCount: data.cancelledBooksCount,
    cancelledOrdersCount: data.cancelledOrdersCount,
    completedOrdersCount: data.completedOrdersCount,
    completedWithCancellationsCount: data.completedWithCancellationsCount,
    completedWithoutCancellationsCount: data.completedWithoutCancellationsCount,
    latestReceipt: data.latestReceipt,
    receivedBooksCount: data.receivedBooksCount,
    receivedOrdersCount: data.receivedOrdersCount,
    receivedSeriesBooksCount: data.receivedSeriesBooksCount,
    receivedSeriesCount: data.receivedSeriesCount,
    receivedShipmentsCount: data.receivedShipmentsCount,
    receivedStandaloneBooksCount: data.receivedStandaloneBooksCount,
  };
}
