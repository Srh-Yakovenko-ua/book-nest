import type { AuthorView } from "@app/shared";
import type { z } from "zod";

import { CatalogLocaleSchema, PaginatedAuthorsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { authorsControllerSearch } from "@/shared/api/generated/endpoints/authors/authors";

import { authorKeys } from "./author-keys";

const AUTHOR_OPTIONS_PAGE_SIZE = 20;

type AuthorOptions = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  items: AuthorView[];
};

type AuthorSearchPage = z.infer<typeof PaginatedAuthorsSchema>;

export function useAuthorOptions(search: string): AuthorOptions {
  const trimmed = search.trim();
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: AuthorSearchPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<AuthorSearchPage> => {
      const response = await authorsControllerSearch({
        locale,
        pageNumber: pageParam,
        pageSize: AUTHOR_OPTIONS_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      return PaginatedAuthorsSchema.parse(response);
    },
    queryKey: authorKeys.options({ locale, search: trimmed }),
  });

  return {
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}
