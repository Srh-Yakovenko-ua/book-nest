import type { HomeActiveBooksPage, HomeActiveBooksQuery } from "@app/shared";

import { HomeActiveBooksPageSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { homeControllerGetActiveBooks } from "@/shared/api/generated/endpoints/home/home";

import { mergeActiveBookPages } from "../model/home-active-books";
import { homeKeys } from "./home-keys";

const FIRST_ACTIVE_BOOKS_PAGE: HomeActiveBooksQuery = {};

export function useHomeActiveBooks({
  initialPage,
  initialPageUpdatedAt,
}: {
  initialPage: HomeActiveBooksPage;
  initialPageUpdatedAt: number;
}) {
  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: HomeActiveBooksPage): HomeActiveBooksQuery | undefined =>
      lastPage.nextCursor === null ? undefined : { cursor: lastPage.nextCursor },
    initialData: { pageParams: [FIRST_ACTIVE_BOOKS_PAGE], pages: [initialPage] },
    initialDataUpdatedAt: initialPageUpdatedAt,
    initialPageParam: FIRST_ACTIVE_BOOKS_PAGE,
    queryFn: async ({ pageParam, signal }): Promise<HomeActiveBooksPage> =>
      HomeActiveBooksPageSchema.parse(await homeControllerGetActiveBooks(pageParam, { signal })),
    queryKey: homeKeys.activeBooks(),
  });
  const { pages } = query.data;

  return {
    books: mergeActiveBookPages(pages),
    fetchNextPage: () => {
      if (!query.hasNextPage || query.isFetchingNextPage) return;
      void query.fetchNextPage();
    },
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetchError: query.isRefetchError,
    total: pages.at(-1)?.total ?? initialPage.total,
  };
}
