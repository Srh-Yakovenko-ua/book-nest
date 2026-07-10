import type { ChangelogEntryView, ChangelogLocale } from "@app/shared";

import type { ChangelogEntryModel } from "../../../generated/prisma/models.js";

export type PublishedChangelogEntry = Omit<ChangelogEntryModel, "publishedAt"> & {
  publishedAt: Date;
};

type LocalizedText = {
  body: string;
  title: string;
};

type ToChangelogEntryViewInput = {
  entry: PublishedChangelogEntry;
  locale: ChangelogLocale;
};

export function isPublishedEntry(entry: ChangelogEntryModel): entry is PublishedChangelogEntry {
  return entry.publishedAt !== null;
}

export function toChangelogEntryView({
  entry,
  locale,
}: ToChangelogEntryViewInput): ChangelogEntryView {
  const localized: Record<ChangelogLocale, LocalizedText> = {
    en: { body: entry.bodyEn, title: entry.titleEn },
    uk: { body: entry.bodyUk, title: entry.titleUk },
  };
  const { body, title } = localized[locale];

  return {
    body,
    category: entry.category,
    id: entry.id,
    publishedAt: entry.publishedAt.toISOString(),
    slug: entry.slug,
    title,
    version: entry.version,
  };
}
