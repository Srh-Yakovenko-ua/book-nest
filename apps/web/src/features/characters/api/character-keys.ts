import type { BookCharacterSummaryQuery } from "@app/shared";

import type {
  BookCharactersControllerListParams,
  BookCharacterSuggestionsControllerListParams,
  CharactersControllerDuplicateCandidatesParams,
  CharactersControllerGetByIdParams,
  CharactersControllerListParams,
} from "@/shared/api/generated/model";

const CHARACTERS_ROOT = "characters";

export const characterKeys = {
  all: [CHARACTERS_ROOT] as const,
  bookRoster: (bookId: string, params: BookCharactersControllerListParams) =>
    [CHARACTERS_ROOT, "book-roster", bookId, params] as const,
  bookRosterScope: (bookId: string) => [CHARACTERS_ROOT, "book-roster", bookId] as const,
  bookSummary: (bookId: string, readingContext: BookCharacterSummaryQuery) =>
    [CHARACTERS_ROOT, "book-summary", bookId, readingContext] as const,
  deletionPreview: (characterId: string) =>
    [CHARACTERS_ROOT, "deletion-preview", characterId] as const,
  details: (characterId: string, params: CharactersControllerGetByIdParams) =>
    [CHARACTERS_ROOT, "details", characterId, params] as const,
  duplicates: (params: CharactersControllerDuplicateCandidatesParams) =>
    [CHARACTERS_ROOT, "duplicates", params] as const,
  search: (params: CharactersControllerListParams) => [CHARACTERS_ROOT, "search", params] as const,
  suggestions: (bookId: string, params: BookCharacterSuggestionsControllerListParams) =>
    [CHARACTERS_ROOT, "suggestions", bookId, params] as const,
};
