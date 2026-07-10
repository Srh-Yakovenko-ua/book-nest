import type { ChangelogCategory, ChangelogEntryView } from "@app/shared";

export function makeChangelogEntry(
  overrides: Partial<ChangelogEntryView> = {},
): ChangelogEntryView {
  return {
    body: "Тепер книги можна впорядковувати в чергу читання та змінювати порядок перетягуванням.",
    category: "feature",
    id: "1",
    publishedAt: "2026-07-08",
    slug: "reading-queue",
    title: "Черга читання",
    version: "1.4.0",
    ...overrides,
  };
}

const CATEGORY_CYCLE: readonly ChangelogCategory[] = ["feature", "improvement", "fix"];

const SAMPLE_TITLES = [
  "Черга читання",
  "Швидший пошук авторів",
  "Виправлено дублювання доставки",
  "Списки для покупок",
  "Покращено темну тему",
];

const SAMPLE_BODIES = [
  "Тепер книги можна впорядковувати в чергу читання та змінювати порядок перетягуванням.",
  "Пошук авторів працює на кількох мовах і повертає результати помітно швидше.",
  "Усунено рідкісний випадок, коли одна книга могла мати дві активні доставки.",
  "Додано власні списки з можливістю додавати книги та змінювати їхній порядок.",
  "Підвищено контраст і плавність переходів у темній темі інтерфейсу.",
];

const DATE_CLUSTERS: readonly { count: number; date: string }[] = [
  { count: 3, date: "2026-07-10" },
  { count: 2, date: "2026-07-09" },
  { count: 1, date: "2026-07-07" },
  { count: 3, date: "2026-07-05" },
  { count: 2, date: "2026-07-03" },
  { count: 2, date: "2026-07-01" },
  { count: 3, date: "2026-06-28" },
  { count: 1, date: "2026-06-25" },
  { count: 2, date: "2026-06-22" },
  { count: 3, date: "2026-06-20" },
];

export const changelogEntries: ChangelogEntryView[] = DATE_CLUSTERS.flatMap((cluster) =>
  Array.from({ length: cluster.count }, () => cluster.date),
).map((publishedAt, index) =>
  makeChangelogEntry({
    body: SAMPLE_BODIES[index % SAMPLE_BODIES.length] ?? "Оновлення інтерфейсу.",
    category: CATEGORY_CYCLE[index % CATEGORY_CYCLE.length] ?? "feature",
    id: String(index + 1),
    publishedAt,
    slug: `entry-${index + 1}`,
    title: SAMPLE_TITLES[index % SAMPLE_TITLES.length] ?? "Оновлення",
    version: index % 4 === 0 ? `1.${index}.0` : null,
  }),
);
