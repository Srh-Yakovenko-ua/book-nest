import type {
  BookOrderDerivedStatus,
  BookOrderStatisticsLifecycle,
  BookOrderStatisticsLifecycleComparison,
  BookOrderStatisticsLifecycleStageCounts,
  BookOrderStatisticsLifecycleStageDeltas,
  Nullable,
} from "@app/shared";

import type {
  ClassifiedOrder,
  OrderStatisticsItemRecord,
  OrderStatisticsShipmentRecord,
} from "./statistics-scope.js";

import { isDispatchedShipmentStatus } from "./order-derived-status.js";
import { isActiveItem, isReceivedItem, ORDER_ENUMS } from "./statistics-scope.js";

const SINGLE_BOOK_UNREACHABLE_STAGES = Object.freeze({
  partially_received: 0,
  partially_shipped: 0,
});

type LifecycleBookStage = Extract<
  BookOrderDerivedStatus,
  "active" | "cancelled" | "received" | "shipped"
>;

type LifecycleStages = Pick<BookOrderStatisticsLifecycle, "books" | "orders">;

export function computeBookOrderLifecycle({
  includeCancelled,
  orders,
  previousOrders,
}: {
  includeCancelled: boolean;
  orders: ClassifiedOrder[];
  previousOrders: Nullable<ClassifiedOrder[]>;
}): BookOrderStatisticsLifecycle {
  const current = countStages({ includeCancelled, orders });

  return {
    ...current,
    comparison:
      previousOrders === null
        ? null
        : toLifecycleComparison({
            current,
            previous: countStages({ includeCancelled, orders: previousOrders }),
          }),
  };
}

function countBookStages({
  includeCancelled,
  orders,
}: {
  includeCancelled: boolean;
  orders: ClassifiedOrder[];
}): BookOrderStatisticsLifecycleStageCounts {
  const stages: Record<LifecycleBookStage, number> = {
    active: 0,
    cancelled: 0,
    received: 0,
    shipped: 0,
  };
  let total = 0;

  for (const order of orders) {
    const dispatchedShipmentIds = toDispatchedShipmentIds(order.record.shipments);
    for (const item of order.countedItems) {
      const stage = toBookStage({ dispatchedShipmentIds, item });
      if (!isCountedStage({ includeCancelled, stage })) {
        continue;
      }
      stages[stage] += 1;
      total += 1;
    }
  }

  return { ...stages, ...SINGLE_BOOK_UNREACHABLE_STAGES, total };
}

function countOrderStages({
  includeCancelled,
  orders,
}: {
  includeCancelled: boolean;
  orders: ClassifiedOrder[];
}): BookOrderStatisticsLifecycleStageCounts {
  const stages: Record<BookOrderDerivedStatus, number> = {
    active: 0,
    cancelled: 0,
    partially_received: 0,
    partially_shipped: 0,
    received: 0,
    shipped: 0,
  };
  let total = 0;

  for (const order of orders) {
    if (!isCountedStage({ includeCancelled, stage: order.derivedStatus })) {
      continue;
    }
    stages[order.derivedStatus] += 1;
    total += 1;
  }

  return { ...stages, total };
}

function countStages({
  includeCancelled,
  orders,
}: {
  includeCancelled: boolean;
  orders: ClassifiedOrder[];
}): LifecycleStages {
  const countedOrders = orders.filter((order) => order.isIncluded);

  return {
    books: countBookStages({ includeCancelled, orders: countedOrders }),
    orders: countOrderStages({ includeCancelled, orders: countedOrders }),
  };
}

function isAwaitingArrival({
  dispatchedShipmentIds,
  item,
}: {
  dispatchedShipmentIds: ReadonlySet<string>;
  item: OrderStatisticsItemRecord;
}): boolean {
  return (
    isActiveItem(item) && item.shipmentId !== null && dispatchedShipmentIds.has(item.shipmentId)
  );
}

function isCountedStage({
  includeCancelled,
  stage,
}: {
  includeCancelled: boolean;
  stage: BookOrderDerivedStatus;
}): boolean {
  return includeCancelled || stage !== ORDER_ENUMS.derivedStatus.cancelled;
}

function toBookStage({
  dispatchedShipmentIds,
  item,
}: {
  dispatchedShipmentIds: ReadonlySet<string>;
  item: OrderStatisticsItemRecord;
}): LifecycleBookStage {
  if (item.cancelledAt !== null) {
    return ORDER_ENUMS.derivedStatus.cancelled;
  }
  if (isReceivedItem(item)) {
    return ORDER_ENUMS.derivedStatus.received;
  }
  if (isAwaitingArrival({ dispatchedShipmentIds, item })) {
    return ORDER_ENUMS.derivedStatus.shipped;
  }

  return ORDER_ENUMS.derivedStatus.active;
}

function toDispatchedShipmentIds(
  shipments: readonly OrderStatisticsShipmentRecord[],
): ReadonlySet<string> {
  return new Set(
    shipments
      .filter((shipment) => isDispatchedShipmentStatus(shipment.status))
      .map((shipment) => shipment.id),
  );
}

function toLifecycleComparison({
  current,
  previous,
}: {
  current: LifecycleStages;
  previous: LifecycleStages;
}): BookOrderStatisticsLifecycleComparison {
  return {
    books: {
      delta: toStageDeltas({ current: current.books, previous: previous.books }),
      previous: previous.books,
    },
    orders: {
      delta: toStageDeltas({ current: current.orders, previous: previous.orders }),
      previous: previous.orders,
    },
  };
}

function toStageDeltas({
  current,
  previous,
}: {
  current: BookOrderStatisticsLifecycleStageCounts;
  previous: BookOrderStatisticsLifecycleStageCounts;
}): BookOrderStatisticsLifecycleStageDeltas {
  return {
    active: current.active - previous.active,
    cancelled: current.cancelled - previous.cancelled,
    partially_received: current.partially_received - previous.partially_received,
    partially_shipped: current.partially_shipped - previous.partially_shipped,
    received: current.received - previous.received,
    shipped: current.shipped - previous.shipped,
    total: current.total - previous.total,
  };
}
