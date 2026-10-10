import type { CatalogLocale } from "@app/shared";

import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type {
  SpeciesCatalog,
  SpeciesCatalogItem,
} from "../modules/species/infrastructure/species-catalog-file.js";

import { normalizeSpeciesName } from "../modules/species/domain/species-name-normalizer.js";

export type SystemSpeciesSeedResult = {
  created: number;
  updated: number;
};

type ExistingSystemSpecies = Prisma.SpeciesGetPayload<{ include: { names: true } }>;

type SystemSpeciesLabel = {
  locale: CatalogLocale;
  name: string;
  normalizedName: string;
};

export async function seedSystemSpecies({
  catalog,
  prisma,
}: {
  catalog: SpeciesCatalog;
  prisma: PrismaClient;
}): Promise<SystemSpeciesSeedResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.species.findMany({
      include: { names: true },
      where: { key: { in: catalog.items.map((item) => item.key) }, userId: null },
    });
    const existingByKey = new Map(existing.map((species) => [species.key, species]));

    const created = await createMissingSpecies({
      items: catalog.items.filter((item) => !existingByKey.has(item.key)),
      tx,
    });

    let updated = 0;
    for (const item of catalog.items) {
      const current = existingByKey.get(item.key);
      if (current === undefined) continue;
      if (await syncExistingSpecies({ current, item, tx })) updated += 1;
    }

    return { created, updated };
  });
}

async function createMissingSpecies({
  items,
  tx,
}: {
  items: readonly SpeciesCatalogItem[];
  tx: Prisma.TransactionClient;
}): Promise<number> {
  const created = items.map((item) => ({ id: randomUUID(), item }));
  await tx.species.createMany({
    data: created.map(({ id, item }) => ({ id, key: item.key, ...speciesFieldsOf(item) })),
  });
  await tx.speciesName.createMany({
    data: created.flatMap(({ id, item }) =>
      labelsOf(item).map((label) => ({ ...label, kind: "label" as const, speciesId: id })),
    ),
  });
  return created.length;
}

function labelsOf(item: SpeciesCatalogItem): SystemSpeciesLabel[] {
  return [
    { locale: "uk", name: item.nameUk, normalizedName: normalizeSpeciesName(item.nameUk) },
    { locale: "en", name: item.nameEn, normalizedName: normalizeSpeciesName(item.nameEn) },
  ];
}

function speciesFieldsOf(item: SpeciesCatalogItem) {
  return {
    categoryKey: item.categoryKey,
    name: item.nameEn,
    normalizedName: normalizeSpeciesName(item.nameEn),
  };
}

async function syncExistingSpecies({
  current,
  item,
  tx,
}: {
  current: ExistingSystemSpecies;
  item: SpeciesCatalogItem;
  tx: Prisma.TransactionClient;
}): Promise<boolean> {
  const fields = speciesFieldsOf(item);
  const speciesChanged =
    current.name !== fields.name ||
    current.normalizedName !== fields.normalizedName ||
    current.categoryKey !== fields.categoryKey;
  if (speciesChanged) {
    await tx.species.update({ data: fields, where: { id: current.id } });
  }

  let labelsChanged = false;
  for (const label of labelsOf(item)) {
    const currentLabel = current.names.find(
      (name) => name.kind === "label" && name.locale === label.locale,
    );
    const changed = await syncLabel({ current: currentLabel, label, speciesId: current.id, tx });
    labelsChanged = labelsChanged || changed;
  }

  return speciesChanged || labelsChanged;
}

async function syncLabel({
  current,
  label,
  speciesId,
  tx,
}: {
  current: ExistingSystemSpecies["names"][number] | undefined;
  label: SystemSpeciesLabel;
  speciesId: string;
  tx: Prisma.TransactionClient;
}): Promise<boolean> {
  if (current === undefined) {
    await tx.speciesName.create({ data: { ...label, kind: "label", speciesId } });
    return true;
  }
  if (current.name === label.name && current.normalizedName === label.normalizedName) {
    return false;
  }
  await tx.speciesName.update({
    data: { name: label.name, normalizedName: label.normalizedName },
    where: { id: current.id },
  });
  return true;
}
