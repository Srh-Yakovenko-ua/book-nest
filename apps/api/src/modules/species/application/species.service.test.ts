import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { SpeciesCategoryLabelsSource } from "../infrastructure/species-category-labels.source.js";
import type { SpeciesRepository, SpeciesWithNames } from "../infrastructure/species.repository.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { SpeciesService } from "./species.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_ID = "44444444-4444-4444-8444-444444444444";
const STAMP = new Date("2026-10-01T10:00:00.000Z");
const TX = fakeOf<Prisma.TransactionClient>({});

function buildService(repository: Partial<SpeciesRepository>): SpeciesService {
  return new SpeciesService(
    fakeOf<SpeciesRepository>({
      acquireUserLock: vi.fn().mockResolvedValue(undefined),
      ...repository,
    }),
    fakeOf<SpeciesCategoryLabelsSource>({ load: vi.fn().mockReturnValue(new Map()) }),
    fakeOf<TransactionRunner>({
      run: <T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(TX),
    }),
  );
}

function customSpecies(overrides: Partial<SpeciesWithNames> = {}): SpeciesWithNames {
  return {
    categoryKey: null,
    createdAt: STAMP,
    id: SOURCE_ID,
    key: null,
    name: "Скельник",
    names: [],
    normalizedName: "скельник",
    updatedAt: STAMP,
    userId: USER_ID,
    ...overrides,
  };
}

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("constraint violation", {
    clientVersion: "test",
    code,
  });
}

describe("SpeciesService.create when the unique index wins a race the lock missed", () => {
  it("answers species_duplicate naming the visible species that took the name", async () => {
    const winner = customSpecies({ id: OTHER_ID, name: "Скельник" });
    const service = buildService({
      createCustom: vi.fn().mockRejectedValue(knownRequestError("P2002")),
      findVisibleByNormalizedName: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([winner]),
    });

    await expect(
      service.create({ locale: "uk", name: "скельник", userId: USER_ID }),
    ).rejects.toMatchObject({
      code: "species_duplicate",
      details: {
        species: { category: null, id: OTHER_ID, isOwn: true, key: null, name: "Скельник" },
      },
      status: 409,
    });
  });

  it("answers species_duplicate without details when the winner is no longer visible", async () => {
    const service = buildService({
      createCustom: vi.fn().mockRejectedValue(knownRequestError("P2002")),
      findVisibleByNormalizedName: vi.fn().mockResolvedValue([]),
    });

    const rejection = await service
      .create({ locale: "uk", name: "Скельник", userId: USER_ID })
      .catch((error: unknown) => error);

    expect(rejection).toMatchObject({ code: "species_duplicate", status: 409 });
    expect(rejection).not.toHaveProperty("details.species");
  });

  it("lets a failure that is not a unique violation through unchanged", async () => {
    const outage = new Error("connection reset");
    const service = buildService({
      createCustom: vi.fn().mockRejectedValue(outage),
      findVisibleByNormalizedName: vi.fn().mockResolvedValue([]),
    });

    await expect(service.create({ locale: "uk", name: "Скельник", userId: USER_ID })).rejects.toBe(
      outage,
    );
  });
});

describe("SpeciesService.rename when the unique index wins a race the lock missed", () => {
  it("names the other holder of the name, never the species being renamed", async () => {
    const renamed = customSpecies();
    const holder = customSpecies({ id: OTHER_ID, name: "Кам'яник", normalizedName: "кам'яник" });
    const service = buildService({
      findVisibleById: vi.fn().mockResolvedValue(renamed),
      findVisibleByNormalizedName: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([renamed, holder]),
      renameCustom: vi.fn().mockRejectedValue(knownRequestError("P2002")),
    });

    await expect(
      service.rename({ locale: "uk", name: "Кам'яник", speciesId: SOURCE_ID, userId: USER_ID }),
    ).rejects.toMatchObject({
      code: "species_duplicate",
      details: { species: { id: OTHER_ID } },
      status: 409,
    });
  });
});

describe("SpeciesService.deleteOwn when a reference lands after the usage check", () => {
  it("maps the foreign-key refusal to species_in_use with the counts read afterwards", async () => {
    const service = buildService({
      countUsage: vi
        .fn()
        .mockResolvedValueOnce(new Map())
        .mockResolvedValueOnce(
          new Map([[SOURCE_ID, { bookOverrides: 2, characters: 1, trashed: 0 }]]),
        ),
      deleteCustom: vi.fn().mockRejectedValue(knownRequestError("P2003")),
      findVisibleById: vi.fn().mockResolvedValue(customSpecies()),
    });

    await expect(
      service.deleteOwn({ speciesId: SOURCE_ID, userId: USER_ID }),
    ).rejects.toMatchObject({
      code: "species_in_use",
      details: { bookOverrides: 2, characters: 1, trashed: 0 },
      status: 409,
    });
  });
});

describe("SpeciesService.merge when a concurrent change interferes", () => {
  it("maps a foreign-key refusal while deleting the source to species_merge_conflict", async () => {
    const service = buildService({
      deleteCustom: vi.fn().mockRejectedValue(knownRequestError("P2003")),
      findVisibleById: vi
        .fn()
        .mockResolvedValueOnce(customSpecies())
        .mockResolvedValueOnce(customSpecies({ id: TARGET_ID, name: "Кам'яник" })),
      reassignReferences: vi.fn().mockResolvedValue({ bookOverrides: 0, characters: 1 }),
    });

    await expect(
      service.merge({ locale: "uk", sourceId: SOURCE_ID, targetId: TARGET_ID, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "species_merge_conflict", status: 409 });
  });
});
