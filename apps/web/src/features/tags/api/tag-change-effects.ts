import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { matchesBookKey } from "@/features/books/api/book-keys";
import { characterKeys } from "@/features/characters/api/character-keys";
import { matchesSeriesKey } from "@/features/series/api/series-keys";
import { matchesAnyKeyPrefix } from "@/lib/query-keys";

import { matchesTagAggregateKey, matchesTagPickerKey } from "./tags-keys";

const TAG_KEY_FAMILIES = {
  aggregates: matchesTagAggregateKey,
  books: matchesBookKey,
  characters: matchesAnyKeyPrefix(characterKeys.all),
  pickers: matchesTagPickerKey,
  series: matchesSeriesKey,
} as const satisfies Record<string, QueryKeyMatcher>;

type TagKeyFamily = keyof typeof TAG_KEY_FAMILIES;

const TAG_CHANGE_EFFECTS = {
  created: ["aggregates", "pickers"],
  deleted: ["aggregates", "pickers", "books", "characters", "series"],
  updated: ["aggregates", "pickers", "books", "characters", "series"],
} as const satisfies Record<string, readonly TagKeyFamily[]>;

type TagChange = keyof typeof TAG_CHANGE_EFFECTS;

function tagsChanged(queryClient: QueryClient, { change }: { change: TagChange }): Promise<void> {
  const families: readonly TagKeyFamily[] = TAG_CHANGE_EFFECTS[change];
  const matchers: QueryKeyMatcher[] = families.map((family) => TAG_KEY_FAMILIES[family]);

  return queryClient.invalidateQueries({
    predicate: (query) => matchers.some((matches) => matches(query)),
  });
}

export const tagChangeEffects = { tagsChanged };
