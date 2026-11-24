import type { HomeAttentionGroup, InTransitAttention, Nullable } from "@app/shared";

import { assertNever } from "../../../core/assert-never.js";

export type ReadyForPickupParcels = {
  count: number;
  nearestPickupUntil: Nullable<string>;
};

export function buildDeliveryAttention({
  attention,
  readyForPickup,
}: {
  attention: readonly InTransitAttention[];
  readyForPickup: ReadyForPickupParcels;
}): HomeAttentionGroup[] {
  const groups = attention.flatMap(toDeliveryGroups);
  if (readyForPickup.count === 0) {
    return groups;
  }
  return [
    ...groups,
    {
      count: readyForPickup.count,
      dueDate: readyForPickup.nearestPickupUntil,
      id: "delivery_ready_for_pickup",
      reason: "delivery_ready_for_pickup",
      severity: "high",
      unit: "parcels",
    },
  ];
}

function toDeliveryGroups(item: InTransitAttention): HomeAttentionGroup[] {
  switch (item.reason) {
    case "awaiting_dispatch":
      return [
        {
          count: item.count,
          dueDate: null,
          id: "delivery_awaiting_dispatch",
          maxWaitingDays: item.maxWaitingDays,
          reason: "delivery_awaiting_dispatch",
          severity: "medium",
          unit: "orders",
        },
      ];
    case "delayed":
      return [
        {
          count: item.count,
          dueDate: null,
          id: "delivery_delayed",
          maxDelayDays: item.maxDelayDays,
          reason: "delivery_delayed",
          severity: "high",
          unit: "parcels",
        },
      ];
    case "pickup_expiring":
      return [
        {
          count: item.count,
          dueDate: item.nearestPickupUntil,
          expiredCount: item.expiredCount,
          id: "delivery_pickup_expiring",
          reason: "delivery_pickup_expiring",
          severity: "critical",
          unit: "parcels",
        },
      ];
    case "unassigned_books":
      return [
        {
          count: item.count,
          dueDate: null,
          id: "delivery_unassigned_books",
          ordersCount: item.ordersCount,
          reason: "delivery_unassigned_books",
          revealOrderId: item.revealOrderId,
          severity: "low",
          unit: "books",
        },
      ];
    case "without_expected_date":
    case "without_tracking":
      return [];
    default:
      return assertNever(item);
  }
}
