import type { LibraryQuickCounts } from "@app/shared";

import { LibraryQuickCountsSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BooksControllerQuickCountsParams } from "@/shared/api/generated/model";

import { booksControllerQuickCounts } from "@/shared/api/generated/endpoints/books/books";

import { isLibraryRangeValid } from "../model/library-query";
import { bookKeys } from "./book-keys";

export function useLibraryQuickCounts(params: BooksControllerQuickCountsParams) {
  return useQuery({
    enabled: isLibraryRangeValid(params),
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<LibraryQuickCounts> =>
      LibraryQuickCountsSchema.parse(await booksControllerQuickCounts(params, { signal })),
    queryKey: bookKeys.quickCounts(params),
  });
}
