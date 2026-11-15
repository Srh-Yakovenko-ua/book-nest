import type { z } from "zod";

import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { booksControllerDedications } from "@/shared/api/generated/endpoints/books/books";

import type { DedicationsListParams } from "../model/dedications-query";

import { dedicationKeys } from "./dedication-keys";

export type DedicationsPage = z.infer<typeof PaginatedBooksSchema>;

export function useDedications(params: DedicationsListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: DedicationsPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<DedicationsPage> =>
      PaginatedBooksSchema.parse(
        await booksControllerDedications({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: dedicationKeys.list(params),
  });
}
