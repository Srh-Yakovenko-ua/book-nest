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

const BOOK_ROSTER = {
  finite: "page",
  infinite: "infinite",
  root: "book-roster",
} as const;

export const characterKeys = {
  all: [CHARACTERS_ROOT] as const,
  bookRoster: (bookId: string, params: BookCharactersControllerListParams) =>
    [CHARACTERS_ROOT, BOOK_ROSTER.root, bookId, BOOK_ROSTER.finite, params] as const,
  bookRosterFiniteScope: (bookId: string) =>
    [CHARACTERS_ROOT, BOOK_ROSTER.root, bookId, BOOK_ROSTER.finite] as const,
  bookRosterInfinite: (bookId: string, params: BookCharactersControllerListParams) =>
    [CHARACTERS_ROOT, BOOK_ROSTER.root, bookId, BOOK_ROSTER.infinite, params] as const,
  bookRosterInfiniteScope: (bookId: string) =>
    [CHARACTERS_ROOT, BOOK_ROSTER.root, bookId, BOOK_ROSTER.infinite] as const,
  bookRosterScope: (bookId: string) => [CHARACTERS_ROOT, BOOK_ROSTER.root, bookId] as const,
  bookSummary: (bookId: string, readingContext: BookCharacterSummaryQuery) =>
    [CHARACTERS_ROOT, "book-summary", bookId, readingContext] as const,
  customLabels: () => [CHARACTERS_ROOT, "custom-labels"] as const,
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
