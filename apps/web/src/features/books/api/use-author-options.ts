import type { AuthorView } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { authorsControllerSearch } from "@/shared/api/generated/endpoints/authors/authors";

import { authorSearchResultSchema } from "./use-author-search";

const AUTHOR_OPTIONS_PAGE_SIZE = 12;

export function useAuthorOptions(search: string) {
  const trimmed = search.trim();
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AuthorView[]> => {
      const response = await authorsControllerSearch({
        locale,
        pageSize: AUTHOR_OPTIONS_PAGE_SIZE,
        ...(trimmed.length > 0 ? { search: trimmed } : {}),
      });
      return authorSearchResultSchema.parse(response).items;
    },
    queryKey: ["authors", "options", trimmed, locale],
  });
}
