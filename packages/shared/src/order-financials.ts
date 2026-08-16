import type { Nullable } from "./common.js";

export const ORDER_FINANCIAL_MESSAGES = {
  mismatch: "Total amount must match item prices plus delivery minus discount",
  negativeAmount: "Order money amounts cannot be negative",
  negativeTotal: "Discount cannot make the order total negative",
} as const;

export type OrderFinancialSummary = {
  deliveryPrice: number;
  discount: number;
  effectiveTotalAmount: Nullable<number>;
  isItemBreakdownComplete: boolean;
  itemsCount: number;
  itemsSubtotal: number;
  pricedItemsCount: number;
  totalSource: OrderTotalSource;
};

export type OrderFinancialValidation = {
  error: Nullable<(typeof ORDER_FINANCIAL_MESSAGES)[keyof typeof ORDER_FINANCIAL_MESSAGES]>;
  summary: OrderFinancialSummary;
};

export type OrderTotalSource = "calculated" | "manual" | "unknown";

export function moneyAmountsEqual(left: number, right: number): boolean {
  return toMoneyMinorUnits(left) === toMoneyMinorUnits(right);
}

export function resolveOrderFinancials({
  deliveryPrice,
  discount,
  itemPrices,
  totalAmount,
}: {
  deliveryPrice?: Nullable<number>;
  discount?: Nullable<number>;
  itemPrices: readonly Nullable<number>[];
  totalAmount?: Nullable<number>;
}): OrderFinancialSummary {
  const pricedItems = itemPrices.filter((price): price is number => price !== null);
  const itemsSubtotalMinor = pricedItems.reduce(
    (subtotal, price) => subtotal + toMoneyMinorUnits(price),
    0,
  );
  const deliveryPriceMinor = toMoneyMinorUnits(deliveryPrice ?? 0);
  const discountMinor = toMoneyMinorUnits(discount ?? 0);
  const isItemBreakdownComplete = pricedItems.length === itemPrices.length && itemPrices.length > 0;
  const calculatedTotalMinor = itemsSubtotalMinor + deliveryPriceMinor - discountMinor;
  const effectiveTotalAmount = isItemBreakdownComplete
    ? fromMoneyMinorUnits(calculatedTotalMinor)
    : (totalAmount ?? null);

  return {
    deliveryPrice: fromMoneyMinorUnits(deliveryPriceMinor),
    discount: fromMoneyMinorUnits(discountMinor),
    effectiveTotalAmount,
    isItemBreakdownComplete,
    itemsCount: itemPrices.length,
    itemsSubtotal: fromMoneyMinorUnits(itemsSubtotalMinor),
    pricedItemsCount: pricedItems.length,
    totalSource: isItemBreakdownComplete
      ? "calculated"
      : totalAmount === null || totalAmount === undefined
        ? "unknown"
        : "manual",
  };
}

export function validateOrderFinancials(input: {
  deliveryPrice?: Nullable<number>;
  discount?: Nullable<number>;
  itemPrices: readonly Nullable<number>[];
  totalAmount?: Nullable<number>;
}): OrderFinancialValidation {
  const summary = resolveOrderFinancials(input);
  const amounts = [
    ...input.itemPrices,
    input.deliveryPrice,
    input.discount,
    input.totalAmount,
  ].filter((amount): amount is number => amount !== null && amount !== undefined);
  if (amounts.some((amount) => amount < 0)) {
    return { error: ORDER_FINANCIAL_MESSAGES.negativeAmount, summary };
  }
  if (
    summary.totalSource === "calculated" &&
    summary.effectiveTotalAmount !== null &&
    summary.effectiveTotalAmount < 0
  ) {
    return { error: ORDER_FINANCIAL_MESSAGES.negativeTotal, summary };
  }
  if (
    summary.totalSource === "calculated" &&
    summary.effectiveTotalAmount !== null &&
    input.totalAmount !== null &&
    input.totalAmount !== undefined &&
    !moneyAmountsEqual(input.totalAmount, summary.effectiveTotalAmount)
  ) {
    return { error: ORDER_FINANCIAL_MESSAGES.mismatch, summary };
  }
  return { error: null, summary };
}

function fromMoneyMinorUnits(value: number): number {
  return Number((value / 100).toFixed(2));
}

function toMoneyMinorUnits(value: number): number {
  return Number(value.toFixed(2).replace(".", ""));
}
