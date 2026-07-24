import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { DeliveryRepository } from "../infrastructure/delivery.repository.js";

import { DeliveryService } from "./delivery.service.js";

const mediaStub = { buildViewOrNull: vi.fn().mockReturnValue(null) } as unknown as MediaService;

describe("DeliveryService.inTransitSummary", () => {
  it("maps the repository counts onto the summary view", async () => {
    const repository = {
      summaryData: vi.fn().mockResolvedValue({
        activeCount: 3,
        currencyTotals: [{ currency: "UAH", total: 300 }],
        delayedCount: 1,
        expectedThisWeek: 2,
        storeNames: ["Yakaboo"],
      }),
    } as unknown as DeliveryRepository;
    const service = new DeliveryService(repository, mediaStub);

    const result = await service.inTransitSummary({ userId: "user-1" });

    expect(result.activeCount).toBe(3);
    expect(result.delayedCount).toBe(1);
    expect(result.expectedThisWeek).toBe(2);
  });

  it("folds null-currency totals into UAH and merges them with the explicit UAH group", async () => {
    const repository = {
      summaryData: vi.fn().mockResolvedValue({
        activeCount: 2,
        currencyTotals: [
          { currency: "UAH", total: 300 },
          { currency: null, total: 40 },
          { currency: "USD", total: 50 },
        ],
        delayedCount: 0,
        expectedThisWeek: 0,
        storeNames: [],
      }),
    } as unknown as DeliveryRepository;
    const service = new DeliveryService(repository, mediaStub);

    const result = await service.inTransitSummary({ userId: "user-1" });

    expect(result.totalByCurrency).toEqual([
      { currency: "UAH", total: 340 },
      { currency: "USD", total: 50 },
    ]);
  });

  it("counts unique stores case-insensitively and ignores blank or null names", async () => {
    const repository = {
      summaryData: vi.fn().mockResolvedValue({
        activeCount: 0,
        currencyTotals: [],
        delayedCount: 0,
        expectedThisWeek: 0,
        storeNames: ["Yakaboo", "  yakaboo ", "Book Depot", null, "   "],
      }),
    } as unknown as DeliveryRepository;
    const service = new DeliveryService(repository, mediaStub);

    const result = await service.inTransitSummary({ userId: "user-1" });

    expect(result.uniqueStores).toBe(2);
  });
});

describe("DeliveryService.bulkReceive", () => {
  it("splits the repository outcomes into received ids and skipped reasons", async () => {
    const repository = {
      bulkReceive: vi.fn().mockResolvedValue([
        { bookId: "a", status: "received" },
        { bookId: "b", reason: "not_found", status: "skipped" },
        { bookId: "c", reason: "not_active", status: "skipped" },
      ]),
    } as unknown as DeliveryRepository;
    const service = new DeliveryService(repository, mediaStub);

    const result = await service.bulkReceive({ bookIds: ["a", "b", "c"], userId: "user-1" });

    expect(result).toEqual({
      receivedBookIds: ["a"],
      skipped: [
        { bookId: "b", reason: "not_found" },
        { bookId: "c", reason: "not_active" },
      ],
    });
  });

  it("de-duplicates the incoming book ids before handing them to the repository", async () => {
    const bulkReceive = vi.fn().mockResolvedValue([]);
    const repository = { bulkReceive } as unknown as DeliveryRepository;
    const service = new DeliveryService(repository, mediaStub);

    await service.bulkReceive({ bookIds: ["a", "a", "b"], userId: "user-1" });

    expect(bulkReceive).toHaveBeenCalledWith(expect.objectContaining({ bookIds: ["a", "b"] }));
  });
});
