import type { ChangelogCategory, Nullable } from "@app/shared";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../config/env.js";
import { createLogger } from "../core/logger.js";
import { PrismaClient } from "../generated/prisma/client.js";

const logger = createLogger("seed.changelog");

type ChangelogSeedEntry = {
  bodyEn: string;
  bodyUk: string;
  category: ChangelogCategory;
  publishedAt: string;
  slug: string;
  titleEn: string;
  titleUk: string;
  version: Nullable<string>;
};

const CHANGELOG_ENTRIES: ChangelogSeedEntry[] = [
  {
    bodyEn:
      "Add books to your personal library, track reading statuses, and open a detailed page for each book.",
    bodyUk:
      "Додавайте книги до особистої бібліотеки, ведіть статуси читання та відкривайте детальну сторінку кожної книги.",
    category: "feature",
    publishedAt: "2026-06-30T00:00:00.000Z",
    slug: "book-library",
    titleEn: "My library and book page",
    titleUk: "Моя бібліотека та картка книги",
    version: null,
  },
  {
    bodyEn: "Group books into series and track which part is next to read.",
    bodyUk: "Об'єднуйте книги в серії та стежте, яка частина наступна до прочитання.",
    category: "feature",
    publishedAt: "2026-07-03T00:00:00.000Z",
    slug: "series",
    titleEn: "Book series",
    titleUk: "Серії книг",
    version: null,
  },
];

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

async function seedChangelog(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

  try {
    await seedEntries(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedEntries(prisma: PrismaClientInstance): Promise<void> {
  const slugs = CHANGELOG_ENTRIES.map((entry) => entry.slug);
  const existing = await prisma.changelogEntry.findMany({
    select: { slug: true },
    where: { slug: { in: slugs } },
  });
  const existingSlugs = new Set(existing.map((row) => row.slug));

  for (const entry of CHANGELOG_ENTRIES) {
    const publishedAt = new Date(entry.publishedAt);
    await prisma.changelogEntry.upsert({
      create: {
        bodyEn: entry.bodyEn,
        bodyUk: entry.bodyUk,
        category: entry.category,
        publishedAt,
        slug: entry.slug,
        titleEn: entry.titleEn,
        titleUk: entry.titleUk,
        version: entry.version,
      },
      update: {
        bodyEn: entry.bodyEn,
        bodyUk: entry.bodyUk,
        category: entry.category,
        publishedAt,
        titleEn: entry.titleEn,
        titleUk: entry.titleUk,
        version: entry.version,
      },
      where: { slug: entry.slug },
    });
  }

  const created = CHANGELOG_ENTRIES.filter((entry) => !existingSlugs.has(entry.slug)).length;
  logger.info({ created, updated: CHANGELOG_ENTRIES.length - created }, "changelog entries seeded");
}

seedChangelog()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "changelog seed failed");
    process.exit(1);
  });
