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
  bookSummary: (bookId: string) => [CHARACTERS_ROOT, "book-summary", bookId] as const,
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
