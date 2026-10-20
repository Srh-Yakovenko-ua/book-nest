import type { BookCharacterSummaryQuery } from "@app/shared";

import type {
  BookCharactersControllerListParams,
  BookCharacterSuggestionsControllerListParams,
  CharacterGroupsControllerListParams,
  CharactersControllerDuplicateCandidatesParams,
  CharactersControllerGetByIdParams,
  CharactersControllerListParams,
} from "@/shared/api/generated/model";

export type CharacterFactsScope = {
  bookId: string;
  characterId: string;
};

const CHARACTERS_ROOT = "characters";
const CHARACTER_GROUPS_ROOT = "character-groups";

const BOOK_ROSTER = {
  finite: "page",
  infinite: "infinite",
  root: "book-roster",
} as const;

const FACTS = {
  infinite: "infinite",
  root: "facts",
  total: "facts-total",
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
  books: (characterId: string) => [CHARACTERS_ROOT, "books", characterId] as const,
  bookSummary: (bookId: string, bookContext: BookCharacterSummaryQuery) =>
    [CHARACTERS_ROOT, "book-summary", bookId, bookContext] as const,
  customLabels: () => [CHARACTERS_ROOT, "custom-labels"] as const,
  deletionPreview: (characterId: string) =>
    [CHARACTERS_ROOT, "deletion-preview", characterId] as const,
  details: (characterId: string, params: CharactersControllerGetByIdParams) =>
    [CHARACTERS_ROOT, "details", characterId, params] as const,
  detailsScope: (characterId: string) => [CHARACTERS_ROOT, "details", characterId] as const,
  duplicates: (params: CharactersControllerDuplicateCandidatesParams) =>
    [CHARACTERS_ROOT, "duplicates", params] as const,
  factsInfinite: ({ bookId, characterId, q }: CharacterFactsScope & { q: string }) =>
    [CHARACTERS_ROOT, FACTS.root, characterId, bookId, FACTS.infinite, q] as const,
  factsScope: ({ bookId, characterId }: CharacterFactsScope) =>
    [CHARACTERS_ROOT, FACTS.root, characterId, bookId] as const,
  factsTotal: ({ bookId, characterId }: CharacterFactsScope) =>
    [CHARACTERS_ROOT, FACTS.total, characterId, bookId] as const,
  groupOptions: (params: CharacterGroupsControllerListParams) =>
    [CHARACTER_GROUPS_ROOT, "options", params] as const,
  overview: () => [CHARACTERS_ROOT, "overview"] as const,
  search: (params: CharactersControllerListParams) => [CHARACTERS_ROOT, "search", params] as const,
  searchScope: () => [CHARACTERS_ROOT, "search"] as const,
  suggestions: (bookId: string, params: BookCharacterSuggestionsControllerListParams) =>
    [CHARACTERS_ROOT, "suggestions", bookId, params] as const,
};
