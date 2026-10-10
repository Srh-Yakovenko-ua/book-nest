import type { INestApplication } from "@nestjs/common";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../core/database/prisma.service.js";
import { createTestApp } from "../test/create-test-app.js";
import { seedSystemSpeciesCatalog } from "../test/system-species.js";
import { truncateAllTables } from "../test/truncate.js";

const SYSTEM_CATALOG = {
  labelCount: 228,
  speciesCount: 114,
} as const;

let app: INestApplication;
let prisma: PrismaService;

async function systemSpeciesIds(): Promise<Map<string, string>> {
  const rows = await prisma.species.findMany({
    select: { id: true, key: true },
    where: { userId: null },
  });
  return new Map(rows.map((row) => [row.key ?? "", row.id]));
}

beforeAll(async () => {
  app = await createTestApp([]);
  prisma = app.get(PrismaService);
});

beforeEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await truncateAllTables(app);
  await app.close();
});

describe("seedSystemSpecies", () => {
  it("creates all 114 system species with their uk and en labels on an empty table", async () => {
    await expect(seedSystemSpeciesCatalog(app)).resolves.toEqual({
      created: SYSTEM_CATALOG.speciesCount,
      updated: 0,
    });

    await expect(prisma.species.count({ where: { userId: null } })).resolves.toBe(
      SYSTEM_CATALOG.speciesCount,
    );
    await expect(prisma.speciesName.count({ where: { kind: "label" } })).resolves.toBe(
      SYSTEM_CATALOG.labelCount,
    );
    await expect(
      prisma.species.findFirst({
        include: { names: { orderBy: { locale: "asc" } } },
        where: { key: "dark_elf", userId: null },
      }),
    ).resolves.toMatchObject({
      categoryKey: "elven",
      name: "Dark elf",
      names: [
        { kind: "label", locale: "en", name: "Dark elf", normalizedName: "dark elf" },
        { kind: "label", locale: "uk", name: "Темний ельф", normalizedName: "темний ельф" },
      ],
      normalizedName: "dark elf",
    });
  });

  it("is a no-op on a second run and keeps every species id", async () => {
    await seedSystemSpeciesCatalog(app);
    const idsBefore = await systemSpeciesIds();

    await expect(seedSystemSpeciesCatalog(app)).resolves.toEqual({ created: 0, updated: 0 });

    await expect(systemSpeciesIds()).resolves.toEqual(idsBefore);
    await expect(prisma.speciesName.count()).resolves.toBe(SYSTEM_CATALOG.labelCount);
  });

  it("restores drifted labels in place without replacing the species row", async () => {
    await seedSystemSpeciesCatalog(app);
    const elf = await prisma.species.findFirstOrThrow({ where: { key: "elf", userId: null } });
    await prisma.species.update({ data: { name: "Elff" }, where: { id: elf.id } });
    await prisma.speciesName.updateMany({
      data: { name: "Ельфф", normalizedName: "ельфф" },
      where: { locale: "uk", speciesId: elf.id },
    });
    await prisma.speciesName.deleteMany({ where: { locale: "en", speciesId: elf.id } });

    await expect(seedSystemSpeciesCatalog(app)).resolves.toEqual({ created: 0, updated: 1 });

    await expect(
      prisma.species.findUniqueOrThrow({
        include: { names: { orderBy: { locale: "asc" } } },
        where: { id: elf.id },
      }),
    ).resolves.toMatchObject({
      name: "Elf",
      names: [
        { locale: "en", name: "Elf", normalizedName: "elf" },
        { locale: "uk", name: "Ельф", normalizedName: "ельф" },
      ],
    });
  });

  it("never deletes a system species that is missing from the fixture", async () => {
    await prisma.species.create({
      data: {
        categoryKey: "retired",
        key: "retired_species",
        name: "Retired species",
        normalizedName: "retired species",
      },
    });

    await seedSystemSpeciesCatalog(app);

    await expect(prisma.species.count({ where: { key: "retired_species" } })).resolves.toBe(1);
    await expect(prisma.species.count({ where: { userId: null } })).resolves.toBe(
      SYSTEM_CATALOG.speciesCount + 1,
    );
  });
});
