import type { CharacterSuggestionsView } from "@app/shared";

import { CharacterSuggestionsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BookCharacterSuggestionsControllerListParams } from "@/shared/api/generated/model";

import { bookCharacterSuggestionsControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

const SUGGESTIONS_MIN_LENGTH = 2;

export function useCharacterSuggestions(bookId: string, query: string) {
  const trimmed = query.trim();
  const params: BookCharacterSuggestionsControllerListParams = { q: trimmed };

  return useQuery({
    enabled: trimmed.length >= SUGGESTIONS_MIN_LENGTH,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CharacterSuggestionsView> =>
      CharacterSuggestionsViewSchema.parse(
        await bookCharacterSuggestionsControllerList(bookId, params),
      ),
    queryKey: characterKeys.suggestions(bookId, params),
  });
}
