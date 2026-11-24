import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { notesKeys } from "@/features/notes/api/notes-keys";
import { quoteKeys } from "@/features/quotes/api/quote-keys";
import { matchesAnyKeyPrefix, matchesApiRoot } from "@/lib/query-keys";

import { homeKeys } from "./home-keys";

const DATED_HOME_QUERIES: readonly QueryKeyMatcher[] = [
  matchesApiRoot(homeKeys.rootPath),
  matchesAnyKeyPrefix(quoteKeys.overview, notesKeys.bookOverview()),
];

function localDayChanged(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => DATED_HOME_QUERIES.some((matches) => matches(query)),
  });
}

export const homeDayChangeEffects = { localDayChanged };
