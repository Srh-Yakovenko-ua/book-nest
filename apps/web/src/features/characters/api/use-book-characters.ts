import type { BookCharacterSummaryQuery } from "@app/shared";

import { PaginatedCharacterSummarySchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import { bookCharactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export const BOOK_CHARACTER_LOOKUP = {
  minQueryLength: 2,
  sort: "name",
} as const;

export type BookCharactersPage = z.infer<typeof PaginatedCharacterSummarySchema>;

type BookCharacterLookupArgs = {
  bookId: string;
  pageSize: number;
  query: string;
  readingContext: BookCharacterSummaryQuery;
};

export function useBookCharacterLookup({
  bookId,
  pageSize,
  query,
  readingContext,
}: BookCharacterLookupArgs) {
  const params: BookCharactersControllerListParams = {
    pageNumber: 1,
    pageSize,
    search: query,
    sort: BOOK_CHARACTER_LOOKUP.sort,
    ...readingContext,
  };

  return useQuery({
    enabled: query.length >= BOOK_CHARACTER_LOOKUP.minQueryLength,
    queryFn: async ({ signal }): Promise<BookCharactersPage> =>
      PaginatedCharacterSummarySchema.parse(
        await bookCharactersControllerList(bookId, params, { signal }),
      ),
    queryKey: characterKeys.bookRoster(bookId, params),
  });
}
