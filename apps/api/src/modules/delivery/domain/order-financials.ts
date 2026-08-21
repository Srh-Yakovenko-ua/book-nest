import type { Nullable, OrderTotalSource } from "@app/shared";

import { OrderTotalSourceSchema } from "@app/shared";

import { fromMinorUnits, toMinorUnits } from "./money-minor-units.js";

const ORDER_TOTAL_SOURCE = OrderTotalSourceSchema.enum;

export type OrderFinancials = {
  componentSubtotal: Nullable<number>;
  effectiveTotalAmount: Nullable<number>;
  reconciliationAdjustment: Nullable<number>;
  source: OrderTotalSource;
};

export type OrderFinancialsItem = {
  price: Nullable<number>;
};

export function resolveOrderFinancials({
  countedItems,
  deliveryPrice,
  discount,
  totalAmount,
}: {
  countedItems: readonly OrderFinancialsItem[];
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  totalAmount: Nullable<number>;
}): OrderFinancials {
  const subtotalMinorUnits = sumItemPricesInMinorUnits(countedItems);
  const componentTotalMinorUnits =
    subtotalMinorUnits === null
      ? null
      : subtotalMinorUnits + toMinorUnits(deliveryPrice ?? 0) - toMinorUnits(discount ?? 0);
  const effectiveMinorUnits =
    totalAmount === null ? componentTotalMinorUnits : toMinorUnits(totalAmount);

  return {
    componentSubtotal: subtotalMinorUnits === null ? null : fromMinorUnits(subtotalMinorUnits),
    effectiveTotalAmount: effectiveMinorUnits === null ? null : fromMinorUnits(effectiveMinorUnits),
    reconciliationAdjustment: resolveReconciliationAdjustment({
      componentTotalMinorUnits,
      effectiveMinorUnits,
    }),
    source: resolveOrderTotalSource({ effectiveMinorUnits, totalAmount }),
  };
}

function resolveOrderTotalSource({
  effectiveMinorUnits,
  totalAmount,
}: {
  effectiveMinorUnits: Nullable<number>;
  totalAmount: Nullable<number>;
}): OrderTotalSource {
  if (effectiveMinorUnits === null) {
    return ORDER_TOTAL_SOURCE.unknown;
  }
  if (effectiveMinorUnits === 0) {
    return ORDER_TOTAL_SOURCE.free;
  }
  return totalAmount === null ? ORDER_TOTAL_SOURCE.calculated : ORDER_TOTAL_SOURCE.manual;
}

function resolveReconciliationAdjustment({
  componentTotalMinorUnits,
  effectiveMinorUnits,
}: {
  componentTotalMinorUnits: Nullable<number>;
  effectiveMinorUnits: Nullable<number>;
}): Nullable<number> {
  if (componentTotalMinorUnits === null || effectiveMinorUnits === null) {
    return null;
  }
  return fromMinorUnits(effectiveMinorUnits - componentTotalMinorUnits);
}

function sumItemPricesInMinorUnits(countedItems: readonly OrderFinancialsItem[]): Nullable<number> {
  const knownPrices = countedItems.flatMap((item) => (item.price === null ? [] : [item.price]));
  if (knownPrices.length !== countedItems.length) {
    return null;
  }
  return knownPrices.reduce((sum, price) => sum + toMinorUnits(price), 0);
}
