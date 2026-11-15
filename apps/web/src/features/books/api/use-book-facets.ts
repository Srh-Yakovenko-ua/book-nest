import type { BookFacetScope, BookFacetsView } from "@app/shared";

import { BookFacetsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { booksControllerFacets } from "@/shared/api/generated/endpoints/books/books";

import type { LibraryPublisherContext } from "../model/library-query";

import { bookKeys } from "./book-keys";

const FACET_SEARCH_MIN_LENGTH = 2;

export function useBookFacets(
  scope: BookFacetScope,
  search = "",
  context?: LibraryPublisherContext,
) {
  const query = search.trim();
  const params = {
    scope,
    ...(query.length < FACET_SEARCH_MIN_LENGTH ? {} : { q: query }),
    ...(context === undefined ? {} : { publisher: context.publisherId }),
  };

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<BookFacetsView> =>
      BookFacetsViewSchema.parse(await booksControllerFacets(params, { signal })),
    queryKey: bookKeys.facets(params),
  });
}
