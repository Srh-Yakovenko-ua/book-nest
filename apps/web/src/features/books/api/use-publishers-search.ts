import type { PublisherView } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import { publishersControllerSearch } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherViewSchema } from "../model/publisher-view-schema";

const publisherSearchResultSchema = z.object({
  items: z.array(publisherViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const PUBLISHER_SEARCH_PAGE_SIZE = 20;

type PublisherSearchOptions = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  items: PublisherView[];
};

type PublisherSearchPage = z.infer<typeof publisherSearchResultSchema>;

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
      return publisherSearchResultSchema.parse(response);
    },
    queryKey: ["publishers", "search", trimmed, locale],
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
