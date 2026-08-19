import type { Currency } from "./book-enums.js";
import type { Nullable } from "./common.js";

export const ORDER_FINANCIAL_MESSAGES = {
  currencyRequired: "An order must name the currency it was paid in",
  freeOrderCarriesAmounts:
    "A free order cannot carry book prices, a delivery price, a discount or a total",
  mismatch: "Total amount must match item prices plus delivery minus discount",
  negativeAmount: "Order money amounts cannot be negative",
  negativeTotal: "Discount cannot make the order total negative",
  paidOrderNeedsPositiveTotal:
    "A paid order must cost more than zero - mark it as received for free instead",
  unknownTotal:
    "An order needs a known total - enter a final amount, price every book, or mark it as received for free",
} as const;

export type OrderFinancialInput = {
  deliveryPrice?: Nullable<number>;
  discount?: Nullable<number>;
  isFree?: boolean;
  itemPrices: readonly Nullable<number>[];
  totalAmount?: Nullable<number>;
};

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
  error: Nullable<OrderFinancialMessage>;
  summary: OrderFinancialSummary;
};

export type OrderInvariantInput = OrderFinancialInput & { currency?: Nullable<Currency> };

export type OrderTotalSource = "calculated" | "free" | "manual" | "unknown";

type OrderFinancialMessage =
  (typeof ORDER_FINANCIAL_MESSAGES)[keyof typeof ORDER_FINANCIAL_MESSAGES];

export function moneyAmountsEqual(left: number, right: number): boolean {
  return toMoneyMinorUnits(left) === toMoneyMinorUnits(right);
}

export function resolveOrderFinancials({
  deliveryPrice,
  discount,
  isFree = false,
  itemPrices,
  totalAmount,
}: OrderFinancialInput): OrderFinancialSummary {
  const pricedItems = itemPrices.filter((price): price is number => price !== null);
  const itemsSubtotalMinor = pricedItems.reduce(
    (subtotal, price) => subtotal + toMoneyMinorUnits(price),
    0,
  );
  const deliveryPriceMinor = toMoneyMinorUnits(deliveryPrice ?? 0);
  const discountMinor = toMoneyMinorUnits(discount ?? 0);
  const isItemBreakdownComplete =
    !isFree && pricedItems.length === itemPrices.length && itemPrices.length > 0;
  const calculatedTotalMinor = itemsSubtotalMinor + deliveryPriceMinor - discountMinor;

  return {
    deliveryPrice: isFree ? 0 : fromMoneyMinorUnits(deliveryPriceMinor),
    discount: isFree ? 0 : fromMoneyMinorUnits(discountMinor),
    effectiveTotalAmount: isFree
      ? FREE_ORDER_TOTAL
      : isItemBreakdownComplete
        ? fromMoneyMinorUnits(calculatedTotalMinor)
        : (totalAmount ?? null),
    isItemBreakdownComplete,
    itemsCount: itemPrices.length,
    itemsSubtotal: isFree ? 0 : fromMoneyMinorUnits(itemsSubtotalMinor),
    pricedItemsCount: isFree ? 0 : pricedItems.length,
    totalSource: resolveTotalSource({ isFree, isItemBreakdownComplete, totalAmount }),
  };
}

export function validateOrderFinancials(input: OrderFinancialInput): OrderFinancialValidation {
  const summary = resolveOrderFinancials(input);
  if (input.isFree === true) {
    return {
      error: carriesAnyAmount(input) ? ORDER_FINANCIAL_MESSAGES.freeOrderCarriesAmounts : null,
      summary,
    };
  }

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

export function validateOrderInvariant({
  currency,
  ...financials
}: OrderInvariantInput): OrderFinancialValidation {
  const validation = validateOrderFinancials(financials);
  if (validation.error !== null) {
    return validation;
  }
  if (currency === null || currency === undefined) {
    return { error: ORDER_FINANCIAL_MESSAGES.currencyRequired, summary: validation.summary };
  }

  const { effectiveTotalAmount } = validation.summary;
  if (effectiveTotalAmount === null) {
    return { error: ORDER_FINANCIAL_MESSAGES.unknownTotal, summary: validation.summary };
  }
  if (financials.isFree !== true && toMoneyMinorUnits(effectiveTotalAmount) <= 0) {
    return {
      error: ORDER_FINANCIAL_MESSAGES.paidOrderNeedsPositiveTotal,
      summary: validation.summary,
    };
  }
  return validation;
}

const FREE_ORDER_TOTAL = 0;

function carriesAnyAmount({
  deliveryPrice,
  discount,
  itemPrices,
  totalAmount,
}: OrderFinancialInput): boolean {
  return [...itemPrices, deliveryPrice, discount, totalAmount].some(
    (amount) => amount !== null && amount !== undefined,
  );
}

function fromMoneyMinorUnits(value: number): number {
  return Number((value / 100).toFixed(2));
}

function resolveTotalSource({
  isFree,
  isItemBreakdownComplete,
  totalAmount,
}: {
  isFree: boolean;
  isItemBreakdownComplete: boolean;
  totalAmount: OrderFinancialInput["totalAmount"];
}): OrderTotalSource {
  if (isFree) return "free";
  if (isItemBreakdownComplete) return "calculated";
  return totalAmount === null || totalAmount === undefined ? "unknown" : "manual";
}

function toMoneyMinorUnits(value: number): number {
  return Number(value.toFixed(2).replace(".", ""));
}
