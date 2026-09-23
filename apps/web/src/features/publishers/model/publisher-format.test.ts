import { describe, expect, it } from "vitest";

import {
  formatCoveragePercent,
  publisherCountryLabel,
  publisherPriceLabel,
} from "./publisher-format";

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

describe("formatCoveragePercent", () => {
  it("renders a positive share below one percent as <1", () => {
    expect(formatCoveragePercent(0.4, "uk")).toBe("<1");
  });

  it("rounds any other share to a whole percent", () => {
    expect(formatCoveragePercent(0, "uk")).toBe("0");
    expect(formatCoveragePercent(1, "uk")).toBe("1");
    expect(formatCoveragePercent(62.6, "uk")).toBe("63");
  });
});
