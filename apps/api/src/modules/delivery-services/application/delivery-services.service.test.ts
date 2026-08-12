import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { DeliveryServiceModel } from "../../../generated/prisma/models.js";
import type { DeliveryServicesRepository } from "../infrastructure/delivery-services.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { DeliveryServicesService } from "./delivery-services.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GLOBAL_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOM_ID = "33333333-3333-4333-8333-333333333333";
const EXTRA_ID = "44444444-4444-4444-8444-444444444444";
const TX = {} as unknown as Prisma.TransactionClient;

function buildService(): {
  repository: {
    count: ReturnType<typeof vi.fn>;
    deleteOwnCustom: ReturnType<typeof vi.fn>;
    findVisibleByNormalizedName: ReturnType<typeof vi.fn>;
    findVisibleByNormalizedNames: ReturnType<typeof vi.fn>;
    recentDeliveryServiceNames: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    upsertCustom: ReturnType<typeof vi.fn>;
  };
  service: DeliveryServicesService;
} {
  const repository = {
    count: vi.fn().mockResolvedValue(0),
    deleteOwnCustom: vi.fn().mockResolvedValue(0),
    findVisibleByNormalizedName: vi.fn().mockResolvedValue(null),
    findVisibleByNormalizedNames: vi.fn().mockResolvedValue([]),
    recentDeliveryServiceNames: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    upsertCustom: vi.fn().mockResolvedValue(deliveryService({ userId: USER_ID })),
  };
  const service = new DeliveryServicesService(repository as unknown as DeliveryServicesRepository);
  return { repository, service };
}

function deliveryService(overrides: Partial<DeliveryServiceModel> = {}): DeliveryServiceModel {
  return {
    countryCode: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    id: GLOBAL_ID,
    isDefault: true,
    name: "Нова Пошта",
    normalizedName: "нова пошта",
    sortOrder: 0,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: null,
    ...overrides,
  };
}

describe("DeliveryServicesService.search", () => {
  it("passes the search term, pagination window, and user to the repository", async () => {
    const { repository, service } = buildService();

    await service.search(USER_ID, { pageNumber: 2, pageSize: 10, search: "пошта" });

    expect(repository.search).toHaveBeenCalledWith({
      query: "пошта",
      skip: 10,
      take: 10,
      userId: USER_ID,
    });
    expect(repository.count).toHaveBeenCalledWith({ query: "пошта", userId: USER_ID });
  });

  it("maps a global row to isCustom false and an own custom row to isCustom true", async () => {
    const { repository, service } = buildService();
    repository.search.mockResolvedValue([
      deliveryService({ id: GLOBAL_ID, name: "Нова Пошта", userId: null }),
      deliveryService({ id: CUSTOM_ID, name: "My Courier", userId: USER_ID }),
    ]);
    repository.count.mockResolvedValue(2);

    const result = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
    });

    expect(result.items).toEqual([
      {
        countryCode: null,
        id: GLOBAL_ID,
        isCustom: false,
        name: "Нова Пошта",
        providerKey: null,
        trackingUrlTemplate: null,
      },
      {
        countryCode: null,
        id: CUSTOM_ID,
        isCustom: true,
        name: "My Courier",
        providerKey: null,
        trackingUrlTemplate: null,
      },
    ]);
  });

  it("wraps the mapped rows and total count in a paginator", async () => {
    const { repository, service } = buildService();
    repository.search.mockResolvedValue([deliveryService()]);
    repository.count.mockResolvedValue(25);

    const result = await service.search(USER_ID, {
      pageNumber: 2,
      pageSize: 10,
      search: undefined,
    });

    expect(result).toMatchObject({ page: 2, pagesCount: 3, pageSize: 10, totalCount: 25 });
    expect(result.items).toHaveLength(1);
  });
});

describe("DeliveryServicesService.ensureCustomForName", () => {
  it("does not create a custom when the normalized name matches a visible global row", async () => {
    const { repository, service } = buildService();
    repository.findVisibleByNormalizedName.mockResolvedValue(deliveryService({ userId: null }));

    await service.ensureCustomForName({ name: "Нова Пошта", userId: USER_ID }, TX);

    expect(repository.upsertCustom).not.toHaveBeenCalled();
  });

  it("does not create a custom when the normalized name matches an own custom row", async () => {
    const { repository, service } = buildService();
    repository.findVisibleByNormalizedName.mockResolvedValue(
      deliveryService({ name: "My Courier", normalizedName: "my courier", userId: USER_ID }),
    );

    await service.ensureCustomForName({ name: "My Courier", userId: USER_ID }, TX);

    expect(repository.upsertCustom).not.toHaveBeenCalled();
  });

  it("creates a custom for the user when nothing visible matches the name", async () => {
    const { repository, service } = buildService();
    repository.findVisibleByNormalizedName.mockResolvedValue(null);

    await service.ensureCustomForName({ name: "Brand New Courier", userId: USER_ID }, TX);

    expect(repository.upsertCustom).toHaveBeenCalledWith(
      { name: "Brand New Courier", normalizedName: "brand new courier", userId: USER_ID },
      TX,
    );
  });

  it("normalizes the name before lookup so spacing and case route to the same row", async () => {
    const { repository, service } = buildService();

    await service.ensureCustomForName({ name: "  Нова   ПОШТА ", userId: USER_ID }, TX);

    expect(repository.findVisibleByNormalizedName).toHaveBeenCalledWith(
      { normalizedName: "нова пошта", userId: USER_ID },
      TX,
    );
  });
});

describe("DeliveryServicesService.delete", () => {
  it("resolves when the repository removes the caller's own custom", async () => {
    const { repository, service } = buildService();
    repository.deleteOwnCustom.mockResolvedValue(1);

    await expect(service.delete(USER_ID, CUSTOM_ID)).resolves.toBeUndefined();
    expect(repository.deleteOwnCustom).toHaveBeenCalledWith({ id: CUSTOM_ID, userId: USER_ID });
  });

  it("throws NotFoundError when the repository deletes nothing", async () => {
    const { repository, service } = buildService();
    repository.deleteOwnCustom.mockResolvedValue(0);

    await expect(service.delete(USER_ID, CUSTOM_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DeliveryServicesService.recent", () => {
  it("returns an empty array without loading catalog rows when no snapshots are recent", async () => {
    const { repository, service } = buildService();
    repository.recentDeliveryServiceNames.mockResolvedValue([]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result).toEqual([]);
    expect(repository.findVisibleByNormalizedNames).not.toHaveBeenCalled();
  });

  it("passes the requested limit and user to the repository", async () => {
    const { repository, service } = buildService();

    await service.recent({ limit: 5, userId: USER_ID });

    expect(repository.recentDeliveryServiceNames).toHaveBeenCalledWith({
      limit: 5,
      userId: USER_ID,
    });
  });

  it("dedupes case and spacing snapshot variants preserving the first-seen recency order", async () => {
    const { repository, service } = buildService();
    repository.recentDeliveryServiceNames.mockResolvedValue([
      "Нова Пошта",
      "  нова  ПОШТА ",
      "Meest",
    ]);
    repository.findVisibleByNormalizedNames.mockResolvedValue([
      deliveryService({ id: CUSTOM_ID, name: "Meest", normalizedName: "meest", userId: null }),
      deliveryService({ id: GLOBAL_ID, name: "Нова Пошта", normalizedName: "нова пошта" }),
    ]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(repository.findVisibleByNormalizedNames).toHaveBeenCalledWith({
      normalizedNames: ["нова пошта", "meest"],
      userId: USER_ID,
    });
    expect(result.map((view) => view.name)).toEqual(["Нова Пошта", "Meest"]);
  });

  it("caps the returned views at the requested limit when more distinct services resolve", async () => {
    const { repository, service } = buildService();
    repository.recentDeliveryServiceNames.mockResolvedValue(["dhl", "ups", "fedex"]);
    repository.findVisibleByNormalizedNames.mockResolvedValue([
      deliveryService({ id: GLOBAL_ID, name: "DHL", normalizedName: "dhl", userId: null }),
      deliveryService({ id: CUSTOM_ID, name: "UPS", normalizedName: "ups", userId: null }),
      deliveryService({ id: EXTRA_ID, name: "FedEx", normalizedName: "fedex", userId: null }),
    ]);

    const result = await service.recent({ limit: 2, userId: USER_ID });

    expect(result.map((view) => view.name)).toEqual(["DHL", "UPS"]);
  });

  it("drops a recent snapshot that has no visible catalog row", async () => {
    const { repository, service } = buildService();
    repository.recentDeliveryServiceNames.mockResolvedValue(["Нова Пошта", "Ghost Courier"]);
    repository.findVisibleByNormalizedNames.mockResolvedValue([
      deliveryService({ id: GLOBAL_ID, name: "Нова Пошта", normalizedName: "нова пошта" }),
    ]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result.map((view) => view.name)).toEqual(["Нова Пошта"]);
  });

  it("keeps the first visible row per normalized name so a global wins over an own custom", async () => {
    const { repository, service } = buildService();
    repository.recentDeliveryServiceNames.mockResolvedValue(["Нова Пошта"]);
    repository.findVisibleByNormalizedNames.mockResolvedValue([
      deliveryService({
        id: GLOBAL_ID,
        name: "Нова Пошта",
        normalizedName: "нова пошта",
        userId: null,
      }),
      deliveryService({
        id: CUSTOM_ID,
        name: "Нова Пошта",
        normalizedName: "нова пошта",
        userId: USER_ID,
      }),
    ]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result).toEqual([
      {
        countryCode: null,
        id: GLOBAL_ID,
        isCustom: false,
        name: "Нова Пошта",
        providerKey: null,
        trackingUrlTemplate: null,
      },
    ]);
  });

  it("maps the country code into each returned view", async () => {
    const { repository, service } = buildService();
    repository.recentDeliveryServiceNames.mockResolvedValue(["Нова Пошта"]);
    repository.findVisibleByNormalizedNames.mockResolvedValue([
      deliveryService({
        countryCode: "UA",
        id: GLOBAL_ID,
        name: "Нова Пошта",
        normalizedName: "нова пошта",
      }),
    ]);

    const result = await service.recent({ limit: 8, userId: USER_ID });

    expect(result).toEqual([
      {
        countryCode: "UA",
        id: GLOBAL_ID,
        isCustom: false,
        name: "Нова Пошта",
        providerKey: null,
        trackingUrlTemplate: null,
      },
    ]);
  });
});
