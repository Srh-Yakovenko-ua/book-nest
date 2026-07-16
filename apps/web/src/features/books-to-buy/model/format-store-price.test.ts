import { describe, expect, it } from "vitest";

import { formatStorePrice } from "./format-store-price";

describe("formatStorePrice", () => {
  it.each([
    { currency: "UAH", expected: "450 грн" },
    { currency: "USD", expected: "450 $" },
    { currency: "EUR", expected: "450 €" },
  ] as const)("renders $currency prices with the $expected symbol", ({ currency, expected }) => {
    expect(formatStorePrice({ currency, locale: "uk", price: 450 })).toBe(expected);
  });

  it("falls back to the default currency when the link has none", () => {
    expect(formatStorePrice({ currency: null, locale: "uk", price: 450 })).toBe("450 грн");
  });
});
