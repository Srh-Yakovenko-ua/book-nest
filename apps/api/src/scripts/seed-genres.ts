import { PrismaPg } from "@prisma/adapter-pg";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { env } from "../config/env.js";
import { createLogger } from "../core/logger.js";
import { normalizeName } from "../core/normalize-name.js";
import { PrismaClient } from "../generated/prisma/client.js";

const logger = createLogger("seed.genres");

const DATA_URL = new URL("./data/book-genres.json", import.meta.url);

const GenreItemSchema = z.object({
  group: z.string().min(1),
  groupName: z.string().min(1),
  id: z.string().min(1),
  isDefault: z.boolean(),
  name: z.string().min(1),
});

const GenreFileSchema = z.object({
  items: z.array(GenreItemSchema).min(1),
});

async function loadGenreItems(): Promise<z.infer<typeof GenreItemSchema>[]> {
  const raw = await readFile(DATA_URL, "utf8");
  return GenreFileSchema.parse(JSON.parse(raw)).items;
}

async function seedGenres(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

  try {
    const items = await loadGenreItems();

    const [deleted, created] = await prisma.$transaction([
      prisma.genre.deleteMany({ where: { userId: null } }),
      prisma.genre.createMany({
        data: items.map((item, index) => ({
          groupKey: item.group,
          groupName: item.groupName,
          isDefault: true,
          key: item.id,
          name: item.name,
          normalizedName: normalizeName(item.name),
          sortOrder: index,
          userId: null,
        })),
      }),
    ]);

    logger.info({ deleted: deleted.count }, "cleared existing default genres");
    logger.info({ created: created.count }, "genre seed completed");
  } finally {
    await prisma.$disconnect();
  }
}

seedGenres()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "genre seed failed");
    process.exit(1);
  });
