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
    bodyEn: "Pick book genres from a shared catalog and add your own custom ones.",
    bodyUk: "Обирайте жанри книг зі спільного каталогу та додавайте власні.",
    category: "feature",
    publishedAt: "2026-06-26T00:00:00.000Z",
    slug: "genres",
    titleEn: "Genres",
    titleUk: "Жанри",
    version: null,
  },
  {
    bodyEn: "Upload and crop book covers to bring your library to life.",
    bodyUk: "Завантажуйте та обрізайте обкладинки книг, щоб бібліотека виглядала жваво.",
    category: "feature",
    publishedAt: "2026-06-27T00:00:00.000Z",
    slug: "book-covers",
    titleEn: "Book covers",
    titleUk: "Обкладинки книг",
    version: null,
  },
  {
    bodyEn:
      "Rating stars now snap cleanly to half or full, and a duplicate series-part link opens the book's edit page.",
    bodyUk:
      "Зірки рейтингу тепер чітко фіксуються на половині або цілій зірці, а посилання на дубль частини серії відкриває сторінку редагування книги.",
    category: "fix",
    publishedAt: "2026-06-30T00:00:00.000Z",
    slug: "reading-polish",
    titleEn: "Rating and link fixes",
    titleUk: "Виправлення рейтингу та посилань",
    version: null,
  },
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
    bodyEn:
      "Every book now has a full page with reading progress, rating, cover, and one-click quick actions.",
    bodyUk:
      "Кожна книга тепер має повноцінну сторінку: прогрес читання, рейтинг, обкладинка та швидкі дії в один клік.",
    category: "feature",
    publishedAt: "2026-07-02T00:00:00.000Z",
    slug: "book-details",
    titleEn: "Detailed book page",
    titleUk: "Детальна сторінка книги",
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
  {
    bodyEn: "The reading-impression text limit is now 5000 characters.",
    bodyUk: "Ліміт тексту вражень від читання збільшено до 5000 символів.",
    category: "improvement",
    publishedAt: "2026-07-05T00:00:00.000Z",
    slug: "longer-impressions",
    titleEn: "Longer reading impressions",
    titleUk: "Довші враження від читання",
    version: null,
  },
  {
    bodyEn:
      "Plan your reading order: add books to a queue, reorder them, and start reading right from it.",
    bodyUk:
      "Плануйте порядок читання: додавайте книги в чергу, змінюйте послідовність і починайте читати прямо звідти.",
    category: "feature",
    publishedAt: "2026-07-07T00:00:00.000Z",
    slug: "reading-queue",
    titleEn: "Reading queue",
    titleUk: "Черга читання",
    version: null,
  },
  {
    bodyEn: "Mark books as favorites and collect them on a dedicated favorites page.",
    bodyUk: "Позначайте улюблені книги та збирайте їх на окремій сторінці обраного.",
    category: "feature",
    publishedAt: "2026-07-07T00:00:00.000Z",
    slug: "favorites",
    titleEn: "Favorites",
    titleUk: "Обране",
    version: null,
  },
  {
    bodyEn: "Keep track of books you lent out or borrowed, with a full loan history.",
    bodyUk: "Ведіть облік книг, які ви позичили комусь або взяли почитати, з історією позик.",
    category: "feature",
    publishedAt: "2026-07-08T00:00:00.000Z",
    slug: "loans",
    titleEn: "Book loans",
    titleUk: "Позики книг",
    version: null,
  },
  {
    bodyEn: "Create your own book lists, add books to them, and arrange them however you like.",
    bodyUk: "Створюйте власні списки книг, додавайте до них книги та впорядковуйте на свій смак.",
    category: "feature",
    publishedAt: "2026-07-09T00:00:00.000Z",
    slug: "custom-lists",
    titleEn: "Custom lists",
    titleUk: "Власні списки",
    version: null,
  },
  {
    bodyEn: "Follow app updates in the What's New feed, with an unread indicator.",
    bodyUk: "Слідкуйте за оновленнями застосунку у стрічці «Що нового» з позначкою непрочитаних.",
    category: "feature",
    publishedAt: "2026-07-09T00:00:00.000Z",
    slug: "whats-new",
    titleEn: "What's New feed",
    titleUk: "Стрічка «Що нового»",
    version: null,
  },
  {
    bodyEn: "Track ordered books in transit, and review your delivery history and statistics.",
    bodyUk: "Відстежуйте замовлені книги в дорозі та переглядайте історію доставок і статистику.",
    category: "feature",
    publishedAt: "2026-07-10T00:00:00.000Z",
    slug: "delivery",
    titleEn: "Book deliveries",
    titleUk: "Доставки книг",
    version: null,
  },
  {
    bodyEn: "The series sequence on the book page now shows book covers.",
    bodyUk: "У розділі послідовності серії на сторінці книги тепер показуються обкладинки книг.",
    category: "improvement",
    publishedAt: "2026-07-10T00:00:00.000Z",
    slug: "series-book-covers",
    titleEn: "Covers in the series sequence",
    titleUk: "Обкладинки в послідовності серії",
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
