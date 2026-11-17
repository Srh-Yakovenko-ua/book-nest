import type { PublisherView } from "@app/shared";
import type { z } from "zod";

import { CatalogLocaleSchema, PaginatedPublishersSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { publisherKeys } from "@/features/publishers/api/publisher-keys";
import { publishersControllerSearch } from "@/shared/api/generated/endpoints/publishers/publishers";

const PUBLISHER_SEARCH_PAGE_SIZE = 20;

type PublisherSearchOptions = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  items: PublisherView[];
};

type PublisherSearchPage = z.infer<typeof PaginatedPublishersSchema>;

export function usePublishersSearch(search: string): PublisherSearchOptions {
  const trimmed = search.trim();
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: PublisherSearchPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<PublisherSearchPage> => {
      const response = await publishersControllerSearch({
        locale,
        pageNumber: pageParam,
        pageSize: PUBLISHER_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      return PaginatedPublishersSchema.parse(response);
    },
    queryKey: publisherKeys.picker.search(trimmed, locale),
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
