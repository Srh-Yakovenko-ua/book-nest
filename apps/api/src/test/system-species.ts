import type { INestApplication } from "@nestjs/common";

import { PrismaService } from "../core/database/prisma.service.js";
import { readSpeciesCatalog } from "../modules/species/infrastructure/species-catalog-file.js";
import { seedSystemSpecies, type SystemSpeciesSeedResult } from "../scripts/seed-system-species.js";

export async function findSystemSpeciesId({
  app,
  key,
}: {
  app: INestApplication;
  key: string;
}): Promise<string> {
  const species = await app
    .get(PrismaService)
    .species.findFirstOrThrow({ select: { id: true }, where: { key, userId: null } });
  return species.id;
}

export async function seedSystemSpeciesCatalog(
  app: INestApplication,
): Promise<SystemSpeciesSeedResult> {
  return seedSystemSpecies({ catalog: await readSpeciesCatalog(), prisma: app.get(PrismaService) });
}
