import { BookOrderHistoryQuerySchema } from "@app/shared";
import { describe, expect, it } from "vitest";

function issuePaths(query: Record<string, unknown>): string[] {
  const result = parseQuery(query);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

function parseQuery(query: Record<string, unknown>) {
  return BookOrderHistoryQuerySchema.safeParse(query);
}

describe("BookOrderHistoryQuerySchema", () => {
  it("reads a single store, service or currency as a one-value selection", () => {
    const result = parseQuery({ currency: "UAH", service: "Nova Poshta", store: "Yakaboo" });

    expect(result.success).toBe(true);
    expect(result.data?.currency).toEqual(["UAH"]);
    expect(result.data?.service).toEqual(["Nova Poshta"]);
    expect(result.data?.store).toEqual(["Yakaboo"]);
  });

  it("keeps every value of a repeated parameter", () => {
    const result = parseQuery({ currency: ["UAH", "EUR"], store: ["Yakaboo", "Book24"] });

    expect(result.data?.currency).toEqual(["UAH", "EUR"]);
    expect(result.data?.store).toEqual(["Yakaboo", "Book24"]);
  });

  it("drops the tracking parameters the history no longer answers to", () => {
    const result = parseQuery({ hasTrackingNumber: "true", hasTrackingUrl: "false" });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("hasTrackingNumber");
    expect(result.data).not.toHaveProperty("hasTrackingUrl");
  });

  it("takes a receipt range on the received tab", () => {
    expect(parseQuery({ receivedFrom: "2026-08-01", tab: "received" }).success).toBe(true);
  });

  it("refuses a receipt range anywhere but the received tab", () => {
    expect(issuePaths({ receivedFrom: "2026-08-01", tab: "cancelled" })).toEqual(["receivedFrom"]);
    expect(issuePaths({ receivedTo: "2026-08-01", tab: "all" })).toEqual(["receivedTo"]);
  });

  it("refuses a cancellation range anywhere but the cancelled tab", () => {
    expect(issuePaths({ cancelledFrom: "2026-08-01", tab: "received" })).toEqual(["cancelledFrom"]);
  });

  it("refuses an order total range that names no currency to measure it in", () => {
    expect(issuePaths({ priceMin: 100 })).toEqual(["priceCurrency"]);
    expect(issuePaths({ priceMax: 100 })).toEqual(["priceCurrency"]);
  });

  it("refuses an order total range spread across several currencies", () => {
    expect(issuePaths({ currency: ["UAH", "EUR"], priceCurrency: "UAH", priceMin: 100 })).toEqual([
      "currency",
    ]);
  });

  it("refuses a total currency that sits outside the selected currencies", () => {
    expect(issuePaths({ currency: ["EUR"], priceCurrency: "UAH", priceMin: 100 })).toEqual([
      "priceCurrency",
    ]);
  });

  it("takes an order total range gated by exactly one currency", () => {
    const result = parseQuery({
      currency: ["UAH"],
      priceCurrency: "UAH",
      priceMax: 2000,
      priceMin: 500,
      tab: "received",
    });

    expect(result.success).toBe(true);
    expect(result.data?.priceCurrency).toBe("UAH");
  });

  it("takes a book count range", () => {
    const result = parseQuery({ booksMax: "10", booksMin: "3" });

    expect(result.data?.booksMin).toBe(3);
    expect(result.data?.booksMax).toBe(10);
  });
});
