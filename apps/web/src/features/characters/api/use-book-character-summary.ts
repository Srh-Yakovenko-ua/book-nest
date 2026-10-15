import type { BookCharacterSummaryQuery, BookCharacterSummaryView } from "@app/shared";

import { BookCharacterSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { bookCharacterSummaryControllerGet } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export function useBookCharacterSummary(bookId: string, bookContext: BookCharacterSummaryQuery) {
  return useQuery({
    queryFn: async (): Promise<BookCharacterSummaryView> =>
      BookCharacterSummaryViewSchema.parse(
        await bookCharacterSummaryControllerGet(bookId, bookContext),
      ),
    queryKey: characterKeys.bookSummary(bookId, bookContext),
    retry: false,
  });
}
