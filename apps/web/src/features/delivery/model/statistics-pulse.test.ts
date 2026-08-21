import type { BookOrderStatisticsPulseSignal } from "@app/shared";

import { describe, expect, it } from "vitest";

import { pulseItems } from "./statistics-pulse";

const FORMAT = {
  comparison: "1–20 липня 2026",
  money: (amount: number, currency: string) => `${amount} ${currency}`,
  month: (monthKey: string) => `місяць ${monthKey}`,
  percent: (value: number) => `${value}%`,
};

const SCOPE = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

function items(pulse: BookOrderStatisticsPulseSignal[]) {
  return pulseItems(pulse, FORMAT);
}

describe("pulseItems", () => {
  it("reads a rise as an increase and prefers the percentage", () => {
    const [item] = items([
      {
        absoluteDelta: 1840,
        code: "spend_change",
        currency: "UAH",
        current: 5840,
        percentDelta: 46,
        previous: 4000,
        tone: "neutral",
      },
    ]);

    expect(item?.messageKey).toBe("spend_change.up");
    expect(item?.values).toMatchObject({
      change: "46%",
      comparison: FORMAT.comparison,
      currency: "UAH",
    });
  });

  it("reads a fall as a decrease", () => {
    const [item] = items([
      {
        absoluteDelta: -300,
        code: "avg_book_price_change",
        currency: "UAH",
        current: 700,
        percentDelta: -30,
        previous: 1000,
        tone: "positive",
      },
    ]);

    expect(item?.messageKey).toBe("avg_book_price_change.down");
    expect(item?.values.change).toBe("30%");
  });

  it("falls back to the amount when the percentage cannot be computed", () => {
    const [item] = items([
      {
        absoluteDelta: 1840,
        code: "spend_change",
        currency: "UAH",
        current: 1840,
        percentDelta: null,
        previous: 0,
        tone: "neutral",
      },
    ]);

    expect(item?.values.change).toBe("1840 UAH");
  });

  it("says nothing moved when the change is zero", () => {
    const [item] = items([
      {
        absoluteDelta: 0,
        code: "avg_landed_cost_change",
        currency: "EUR",
        current: 20,
        percentDelta: 0,
        previous: 20,
        tone: "neutral",
      },
    ]);

    expect(item?.messageKey).toBe("avg_landed_cost_change.flat");
  });

  it("keeps a record inside the selected period when the scope says so", () => {
    const [item] = items([
      {
        booksCount: 24,
        code: "record_month",
        currency: "UAH",
        month: "2026-08",
        ordersCount: 15,
        scope: { ...SCOPE, isPeriodFiltered: true },
        tone: "neutral",
        total: 12378,
      },
    ]);

    expect(item?.messageKey).toBe("record_month.period");
    expect(item?.values).toEqual({ month: "місяць 2026-08", total: "12378 UAH" });
  });

  it("calls an unfiltered record an all-time one", () => {
    const [item] = items([
      {
        booksCount: 24,
        code: "record_month",
        currency: "UAH",
        month: "2026-08",
        ordersCount: 15,
        scope: SCOPE,
        tone: "neutral",
        total: 12378,
      },
    ]);

    expect(item?.messageKey).toBe("record_month.allTime");
  });

  it("stays vague about a truncated record", () => {
    const [item] = items([
      {
        booksCount: 24,
        code: "record_month",
        currency: "UAH",
        month: "2026-08",
        ordersCount: 15,
        scope: { ...SCOPE, isTruncated: true },
        tone: "attention",
        total: 12378,
      },
    ]);

    expect(item?.messageKey).toBe("record_month.period");
  });

  it("drops a store whose spending did not move", () => {
    expect(
      items([
        {
          absoluteDelta: 0,
          code: "store_growth",
          currency: "UAH",
          current: 100,
          percentDelta: 0,
          previous: 100,
          store: "Vivat",
          tone: "neutral",
        },
      ]),
    ).toEqual([]);
  });

  it("picks the discount wording that matches the data it has", () => {
    const [withPercent] = items([
      {
        code: "discount_savings",
        currency: "UAH",
        discountShareOfRawSubtotalPercent: 3,
        discountTotal: 500,
        tone: "positive",
      },
    ]);
    const [plain] = items([
      {
        code: "discount_savings",
        currency: "UAH",
        discountShareOfRawSubtotalPercent: null,
        discountTotal: 500,
        tone: "positive",
      },
    ]);

    expect(withPercent?.messageKey).toBe("discount_savings.withPercent");
    expect(plain?.messageKey).toBe("discount_savings.plain");
  });

  it("shows at most four insights", () => {
    const signal: BookOrderStatisticsPulseSignal = {
      code: "delivery_share",
      currency: "UAH",
      deliveryShareOfSpendPercent: 7,
      deliveryTotal: 500,
      tone: "attention",
    };

    expect(items(Array.from({ length: 6 }, () => signal))).toHaveLength(4);
  });
});
