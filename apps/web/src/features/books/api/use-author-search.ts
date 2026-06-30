import type { AuthorView } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import { authorsControllerSearch } from "@/shared/api/generated/endpoints/authors/authors";

export const authorViewSchema = z.object({
  bio: z.string().nullable(),
  birthYear: z.number().nullable(),
  countryCode: z.string().nullable(),
  deathYear: z.number().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  openLibraryKey: z.string().nullable(),
  photoAttribution: z.string().nullable(),
  photoLicense: z.string().nullable(),
  photoLicenseUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
}) satisfies z.ZodType<AuthorView>;

export const authorSearchResultSchema = z.object({
  items: z.array(authorViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const AUTHOR_SEARCH_MIN_LENGTH = 2;
const AUTHOR_SEARCH_PAGE_SIZE = 8;

export function useAuthorSearch(search: string) {
  const trimmed = search.trim();
  const enabled = trimmed.length >= AUTHOR_SEARCH_MIN_LENGTH;
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AuthorView[]> => {
      const response = await authorsControllerSearch({
        locale,
        pageSize: AUTHOR_SEARCH_PAGE_SIZE,
        search: trimmed,
      });
      const parsed = authorSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["authors", "search", trimmed, locale],
  });
}
