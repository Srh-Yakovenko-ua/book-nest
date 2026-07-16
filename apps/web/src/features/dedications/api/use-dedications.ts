import type { z } from "zod";

import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BooksControllerDedicationsParams } from "@/shared/api/generated/model";

import { booksControllerDedications } from "@/shared/api/generated/endpoints/books/books";

import { dedicationKeys } from "./dedication-keys";

export type DedicationsPage = z.infer<typeof PaginatedBooksSchema>;

export function useDedications(params: BooksControllerDedicationsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<DedicationsPage> =>
      PaginatedBooksSchema.parse(await booksControllerDedications(params, { signal })),
    queryKey: dedicationKeys.list(params),
  });
}
