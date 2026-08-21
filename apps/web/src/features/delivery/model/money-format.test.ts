import { describe, expect, it } from "vitest";

import { toAveragesStatValue, toTotalsStatValue } from "./money-format";

const locale = "en-US";

describe("toTotalsStatValue", () => {
  it("shows a dash and no caption when nothing is priced", () => {
    expect(toTotalsStatValue([], locale)).toEqual({ value: "—" });
  });

  it("leaves a single currency on the headline alone", () => {
    expect(toTotalsStatValue([{ currency: "UAH", total: 1450 }], locale)).toEqual({
      caption: undefined,
      value: "1,450 UAH",
      valueClassName: undefined,
    });
  });

  it("keeps the leading currency on the headline and moves the rest into the caption", () => {
    const result = toTotalsStatValue(
      [
        { currency: "UAH", total: 27128 },
        { currency: "EUR", total: 30.5 },
        { currency: "USD", total: 59.99 },
      ],
      locale,
    );

    expect(result.value).toBe("27,128 UAH");
    expect(result.caption).toBe("30.5 EUR · 59.99 USD");
  });

  it("drops the headline a size once the leading amount stops fitting", () => {
    expect(toTotalsStatValue([{ currency: "UAH", total: 144873.48 }], locale).valueClassName).toBe(
      "text-2xl",
    );
    expect(
      toTotalsStatValue([{ currency: "UAH", total: 1179.48 }], locale).valueClassName,
    ).toBeUndefined();
  });
});

describe("toAveragesStatValue", () => {
  it("splits averages the same way totals are split", () => {
    const result = toAveragesStatValue(
      [
        { average: 725, currency: "UAH" },
        { average: 15, currency: "USD" },
      ],
      locale,
    );

    expect(result.value).toBe("725 UAH");
    expect(result.caption).toBe("15 USD");
  });

  it("shows a dash when no book carries a price", () => {
    expect(toAveragesStatValue([], locale)).toEqual({ value: "—" });
  });
});
