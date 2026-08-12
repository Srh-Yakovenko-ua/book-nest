import type { BookFacetScope, BookFacetsView } from "@app/shared";

import { BookFacetsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  booksControllerFacets,
  getBooksControllerFacetsQueryKey,
} from "@/shared/api/generated/endpoints/books/books";

const FACET_SEARCH_MIN_LENGTH = 2;

export function useBookFacets(scope: BookFacetScope, search = "") {
  const query = search.trim();
  const params = query.length < FACET_SEARCH_MIN_LENGTH ? { scope } : { q: query, scope };

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<BookFacetsView> =>
      BookFacetsViewSchema.parse(await booksControllerFacets(params, { signal })),
    queryKey: getBooksControllerFacetsQueryKey(params),
  });
}
