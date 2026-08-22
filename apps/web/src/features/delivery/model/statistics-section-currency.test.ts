import { describe, expect, it, vi } from "vitest";

import { sectionCurrencyControl } from "./statistics-section-currency";

const AVAILABLE = ["UAH", "EUR", "USD"] as const;

function control({
  available = AVAILABLE,
  commit = vi.fn(),
  dashboardCurrency = "UAH" as const,
  override = null,
}: Partial<Parameters<typeof sectionCurrencyControl>[0]> = {}) {
  return { commit, ...sectionCurrencyControl({ available, commit, dashboardCurrency, override }) };
}

describe("sectionCurrencyControl", () => {
  it("follows the dashboard currency while the section has no override", () => {
    expect(control({ dashboardCurrency: "EUR" }).value).toBe("EUR");
  });

  it("shows the section override instead of the dashboard currency", () => {
    expect(control({ dashboardCurrency: "UAH", override: "USD" }).value).toBe("USD");
  });

  it("falls back to a currency the data actually has when the override went missing", () => {
    expect(control({ available: ["EUR"], dashboardCurrency: "EUR", override: "USD" }).value).toBe(
      "EUR",
    );
  });

  it("writes the override when the reader picks another currency", () => {
    const section = control({ dashboardCurrency: "UAH" });

    section.onChange("EUR");

    expect(section.commit).toHaveBeenCalledWith("EUR");
  });

  it("drops the override when the reader picks the dashboard currency back", () => {
    const section = control({ dashboardCurrency: "UAH", override: "EUR" });

    section.onChange("UAH");

    expect(section.commit).toHaveBeenCalledWith(null);
  });
});
