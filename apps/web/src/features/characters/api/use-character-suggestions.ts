import type { BookCharacterSummaryQuery, CharacterSuggestionsView } from "@app/shared";

import { CharacterSuggestionsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { BookCharacterSuggestionsControllerListParams } from "@/shared/api/generated/model";

import { bookCharacterSuggestionsControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

const SUGGESTIONS_MIN_LENGTH = 2;

type CharacterSuggestionsArgs = {
  bookContext: BookCharacterSummaryQuery;
  bookId: string;
  query: string;
};

export function useCharacterSuggestions({ bookContext, bookId, query }: CharacterSuggestionsArgs) {
  const params: BookCharacterSuggestionsControllerListParams = { q: query, ...bookContext };

  return useQuery({
    enabled: query.length >= SUGGESTIONS_MIN_LENGTH,
    queryFn: async ({ signal }): Promise<CharacterSuggestionsView> =>
      CharacterSuggestionsViewSchema.parse(
        await bookCharacterSuggestionsControllerList(bookId, params, { signal }),
      ),
    queryKey: characterKeys.suggestions(bookId, params),
  });
}
