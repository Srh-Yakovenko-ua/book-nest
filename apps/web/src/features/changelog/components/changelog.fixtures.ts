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

export const changelogEntries: ChangelogEntryView[] = Array.from({ length: 30 }, (_, index) =>
  makeChangelogEntry({
    body: SAMPLE_BODIES[index % SAMPLE_BODIES.length] ?? "Оновлення інтерфейсу.",
    category: CATEGORY_CYCLE[index % CATEGORY_CYCLE.length] ?? "feature",
    id: String(index + 1),
    publishedAt: `2026-07-${String(((index * 3) % 28) + 1).padStart(2, "0")}`,
    slug: `entry-${index + 1}`,
    title: SAMPLE_TITLES[index % SAMPLE_TITLES.length] ?? "Оновлення",
    version: index % 4 === 0 ? `1.${index}.0` : null,
  }),
);
