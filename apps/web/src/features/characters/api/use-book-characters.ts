import type { BookCharacterSummaryQuery } from "@app/shared";

import { PaginatedBookCharacterRosterSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import { bookCharactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export const BOOK_CHARACTER_LOOKUP = {
  minQueryLength: 2,
  sort: "name",
} as const;

export type BookCharactersPage = z.infer<typeof PaginatedBookCharacterRosterSchema>;

type BookCharacterLookupArgs = {
  bookContext: BookCharacterSummaryQuery;
  bookId: string;
  pageSize: number;
  query: string;
};

export function useBookCharacterLookup({
  bookContext,
  bookId,
  pageSize,
  query,
}: BookCharacterLookupArgs) {
  const params: BookCharactersControllerListParams = {
    pageNumber: 1,
    pageSize,
    search: query,
    sort: BOOK_CHARACTER_LOOKUP.sort,
    ...bookContext,
  };

  return useQuery({
    enabled: query.length >= BOOK_CHARACTER_LOOKUP.minQueryLength,
    queryFn: async ({ signal }): Promise<BookCharactersPage> =>
      PaginatedBookCharacterRosterSchema.parse(
        await bookCharactersControllerList(bookId, params, { signal }),
      ),
    queryKey: characterKeys.bookRoster(bookId, params),
  });
}
