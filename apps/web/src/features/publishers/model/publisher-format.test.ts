import { describe, expect, it } from "vitest";

import { publisherCountryLabel, publisherPriceLabel } from "./publisher-format";

describe("publisherCountryLabel", () => {
  it("falls back when the country code is missing", () => {
    expect(publisherCountryLabel(null, "uk", "Країна невідома")).toBe("Країна невідома");
  });

  it("falls back when the country code is blank", () => {
    expect(publisherCountryLabel("   ", "uk", "Країна невідома")).toBe("Країна невідома");
  });

  it("resolves a known country code to its localized name", () => {
    expect(publisherCountryLabel("UA", "en", "Unknown")).toBe("Ukraine");
  });

  it("normalizes a lowercase code before resolving it", () => {
    expect(publisherCountryLabel("ua", "en", "Unknown")).toBe("Ukraine");
  });
});

describe("publisherPriceLabel", () => {
  it("includes the amount in the formatted price", () => {
    expect(publisherPriceLabel(450, "UAH", "uk")).toContain("450");
  });

  it("falls back to a plain amount and code for an unknown currency", () => {
    expect(publisherPriceLabel(450, "INVALID", "uk")).toBe("450 INVALID");
  });
});
