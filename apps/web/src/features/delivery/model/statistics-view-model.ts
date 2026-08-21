import type { BookOrderStatisticsView, Nullable, NumericDelta } from "@app/shared";

export type StatisticsDeltaView = {
  direction: "down" | "flat" | "up";
  percent: Nullable<number>;
  previous: Nullable<number>;
};

export function hasAnyOrders(view: BookOrderStatisticsView): boolean {
  return view.summary.ordersCount > 0 || view.monthly.length > 0;
}

export function toDeltaView(delta: Nullable<NumericDelta>): Nullable<StatisticsDeltaView> {
  if (delta === null) return null;
  if (delta.previous === null && delta.absoluteDelta === null) return null;

  return {
    direction: toDirection(delta.absoluteDelta),
    percent: delta.percentDelta,
    previous: delta.previous,
  };
}

function toDirection(absoluteDelta: Nullable<number>): StatisticsDeltaView["direction"] {
  if (absoluteDelta === null || absoluteDelta === 0) return "flat";
  return absoluteDelta > 0 ? "up" : "down";
}
