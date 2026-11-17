import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { bookKeys, matchesAnyBookChapters } from "@/features/books/api/book-keys";
import { matchesTagAggregateKey } from "@/features/tags/api/tags-keys";
import { assertNever } from "@/lib/assert-never";
import { matchesAnyKeyPrefix } from "@/lib/query-keys";

import { invalidateCharacterIdentityViews } from "./character-identity-sync";

type CharacterKeyFamily = "bookChapters" | "tagAggregates";

const CHARACTER_CHANGE_EFFECTS = {
  createdInBook: ["tagAggregates"],
  restored: ["bookChapters", "tagAggregates"],
  softDeleted: ["bookChapters", "tagAggregates"],
  unlinkedFromBook: ["bookChapters"],
  updatedInBook: ["bookChapters", "tagAggregates"],
} as const satisfies Record<string, readonly CharacterKeyFamily[]>;

type BookScopedCharacterChange = "unlinkedFromBook" | "updatedInBook";

type CharacterChange = keyof typeof CHARACTER_CHANGE_EFFECTS;

type CharacterChangeInput =
  | { bookId: string; change: BookScopedCharacterChange }
  | { change: Exclude<CharacterChange, BookScopedCharacterChange> };

function characterKeyFamilies(input: CharacterChangeInput) {
  return {
    bookChapters: matchesChangedChapters(input),
    tagAggregates: matchesTagAggregateKey,
  } as const satisfies Record<CharacterKeyFamily, QueryKeyMatcher>;
}

function charactersChanged(queryClient: QueryClient, input: CharacterChangeInput): Promise<void> {
  invalidateCharacterIdentityViews(queryClient);

  const families: readonly CharacterKeyFamily[] = CHARACTER_CHANGE_EFFECTS[input.change];
  const familyMatchers = characterKeyFamilies(input);
  const matchers: QueryKeyMatcher[] = families.map((family) => familyMatchers[family]);

  return queryClient.invalidateQueries({
    predicate: (query) => matchers.some((matches) => matches(query)),
  });
}

function matchesChangedChapters(input: CharacterChangeInput): QueryKeyMatcher {
  switch (input.change) {
    case "createdInBook":
    case "restored":
    case "softDeleted":
      return matchesAnyBookChapters;
    case "unlinkedFromBook":
    case "updatedInBook":
      return matchesAnyKeyPrefix(bookKeys.chapters(input.bookId));
    default:
      return assertNever(input);
  }
}

export const characterChangeEffects = { charactersChanged };
