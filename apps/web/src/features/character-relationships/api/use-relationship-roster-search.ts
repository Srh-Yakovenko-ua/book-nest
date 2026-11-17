import type { BookCharacterRosterItem, Nullable } from "@app/shared";
import type { z } from "zod";

import { PaginatedBookCharacterRosterSchema } from "@app/shared";
import { keepPreviousData, skipToken, useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { bookCharactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";
import { BookCharactersControllerListSort } from "@/shared/api/generated/model";

import type { RelationshipParticipant } from "../model/relationship-form-schema";

import { resolveInfiniteSuggestions } from "./infinite-suggestions";
import { relationshipKeys } from "./relationship-keys";

const RELATIONSHIP_ROSTER_SEARCH = {
  debounceMs: 300,
  minTermLength: 2,
  pageSize: 20,
  sort: BookCharactersControllerListSort.name,
} as const;

export type RelationshipRosterSearch = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  retry: () => void;
  state: RelationshipRosterSearchState;
};

export type RelationshipRosterSearchState =
  | { isStale: boolean; kind: "results"; participants: readonly RelationshipParticipant[] }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "hint" }
  | { kind: "loading" }
  | { kind: "no-book" };

type RosterIdleKind = "hint" | "no-book";

type RosterPage = z.infer<typeof PaginatedBookCharacterRosterSchema>;

type UseRelationshipRosterSearchArgs = {
  bookId: Nullable<string>;
  excludedIds: readonly string[];
  search: string;
};

export function useRelationshipRosterSearch({
  bookId,
  excludedIds,
  search,
}: UseRelationshipRosterSearchArgs): RelationshipRosterSearch {
  const term = search.trim();
  const debouncedTerm = useDebouncedValue(term, RELATIONSHIP_ROSTER_SEARCH.debounceMs);

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: RosterPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn:
      bookId === null || isHintTerm(term) || isHintTerm(debouncedTerm)
        ? skipToken
        : async ({ pageParam, signal }): Promise<RosterPage> =>
            PaginatedBookCharacterRosterSchema.parse(
              await bookCharactersControllerList(
                bookId,
                {
                  pageNumber: pageParam,
                  pageSize: RELATIONSHIP_ROSTER_SEARCH.pageSize,
                  sort: RELATIONSHIP_ROSTER_SEARCH.sort,
                  ...(debouncedTerm === "" ? {} : { search: debouncedTerm }),
                },
                { signal },
              ),
            ),
    queryKey: relationshipKeys.roster({
      bookId,
      sort: RELATIONSHIP_ROSTER_SEARCH.sort,
      term: debouncedTerm,
    }),
  });

  const participants = toRosterParticipants({
    excludedIds,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
  });
  const { isStale, status, ...pagination } = resolveInfiniteSuggestions({
    debouncedTerm,
    idle: toIdleKind({ bookId, term }),
    itemCount: participants.length,
    query,
    term,
  });

  function toState(): RelationshipRosterSearchState {
    return status === "results" ? { isStale, kind: "results", participants } : { kind: status };
  }

  return { ...pagination, state: toState() };
}

function isHintTerm(term: string): boolean {
  return term.length > 0 && term.length < RELATIONSHIP_ROSTER_SEARCH.minTermLength;
}

function toIdleKind({
  bookId,
  term,
}: {
  bookId: Nullable<string>;
  term: string;
}): Nullable<RosterIdleKind> {
  if (bookId === null) return "no-book";
  return isHintTerm(term) ? "hint" : null;
}

function toRosterParticipants({
  excludedIds,
  items,
}: {
  excludedIds: readonly string[];
  items: readonly BookCharacterRosterItem[];
}): RelationshipParticipant[] {
  const excluded = new Set(excludedIds);
  const uniqueItems = new Map(items.map((item) => [item.characterId, item]));
  return [...uniqueItems.values()]
    .filter((item) => !excluded.has(item.characterId))
    .map((item) => ({
      avatarUrl: (item.portrait ?? item.avatar)?.urls.thumb ?? null,
      id: item.characterId,
      name: item.displayName ?? item.name,
    }));
}
