import type { DedicationsQuickCounts } from "@app/shared";

import { DedicationsQuickCountsSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BooksControllerDedicationsQuickCountsParams } from "@/shared/api/generated/model";

import { booksControllerDedicationsQuickCounts } from "@/shared/api/generated/endpoints/books/books";

import { dedicationKeys } from "./dedication-keys";

export function useDedicationsQuickCounts(params: BooksControllerDedicationsQuickCountsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<DedicationsQuickCounts> =>
      DedicationsQuickCountsSchema.parse(
        await booksControllerDedicationsQuickCounts(params, { signal }),
      ),
    queryKey: dedicationKeys.quickCounts(params),
  });
}
