import type { CatalogLocale } from "@app/shared";

const AUTHORS_ROOT = "/api/authors";

export const authorKeys = {
  options: ({ locale, search }: { locale: CatalogLocale; search: string }) =>
    [AUTHORS_ROOT, "options", search, locale] as const,
  recent: (locale: CatalogLocale) => [AUTHORS_ROOT, "recent", locale] as const,
};
