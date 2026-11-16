import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { bookKeys, matchesBookDetail } from "@/features/books/api/book-keys";
import { matchesAnyKeyPrefix } from "@/lib/query-keys";

import { quoteKeys } from "./quote-keys";

type QuoteKeyFamily = keyof ReturnType<typeof quoteKeyFamilies>;

const QUOTE_CHANGE_EFFECTS = {
  created: ["quotes", "bookChapters", "bookDetail"],
  deleted: ["quotes", "bookChapters", "bookDetail"],
  updated: ["quotes", "bookChapters"],
} as const satisfies Record<string, readonly QuoteKeyFamily[]>;

type QuoteChange = keyof typeof QUOTE_CHANGE_EFFECTS;

function quoteKeyFamilies(bookId: string) {
  return {
    bookChapters: matchesAnyKeyPrefix(bookKeys.chapters(bookId)),
    bookDetail: matchesBookDetail(bookId),
    quotes: matchesAnyKeyPrefix(quoteKeys.root),
  } as const satisfies Record<string, QueryKeyMatcher>;
}

function quotesChanged(
  queryClient: QueryClient,
  { bookId, change }: { bookId: string; change: QuoteChange },
): Promise<void> {
  const families: readonly QuoteKeyFamily[] = QUOTE_CHANGE_EFFECTS[change];
  const familyMatchers = quoteKeyFamilies(bookId);
  const matchers: QueryKeyMatcher[] = families.map((family) => familyMatchers[family]);

  return queryClient.invalidateQueries({
    predicate: (query) => matchers.some((matches) => matches(query)),
  });
}

export const quoteChangeEffects = { quotesChanged };
