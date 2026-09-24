import type { BookCharacterSummaryQuery } from "@app/shared";

import type {
  BookCharactersControllerListParams,
  BookCharacterSuggestionsControllerListParams,
  CharacterGroupsControllerListParams,
  CharactersControllerDuplicateCandidatesParams,
  CharactersControllerGetByIdParams,
  CharactersControllerListParams,
} from "@/shared/api/generated/model";

const CHARACTERS_ROOT = "characters";
const CHARACTER_GROUPS_ROOT = "character-groups";

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
  groupOptions: (params: CharacterGroupsControllerListParams) =>
    [CHARACTER_GROUPS_ROOT, "options", params] as const,
  overview: () => [CHARACTERS_ROOT, "overview"] as const,
  search: (params: CharactersControllerListParams) => [CHARACTERS_ROOT, "search", params] as const,
  suggestions: (bookId: string, params: BookCharacterSuggestionsControllerListParams) =>
    [CHARACTERS_ROOT, "suggestions", bookId, params] as const,
};
