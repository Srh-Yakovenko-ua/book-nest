import type {
  CharacterRelationshipRoleSuggestionView,
  Nullable,
  PaginatedCharacterRelationshipRoleSuggestionsView,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS,
  collapseSpaces,
  normalizeName,
  PaginatedCharacterRelationshipRoleSuggestionsViewSchema,
} from "@app/shared";
import { keepPreviousData, skipToken, useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { characterRelationshipRoleSuggestionsControllerList } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import { resolveInfiniteSuggestions } from "./infinite-suggestions";
import { relationshipKeys } from "./relationship-keys";

const RELATIONSHIP_ROLE_SUGGESTIONS = {
  debounceMs: 300,
  minTermLength: 2,
  pageSize: CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS.pageSizeDefault,
} as const;

export type RelationshipRoleSuggestions = {
  fetchNextPage: () => void;
  freeValue: Nullable<string>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  retry: () => void;
  state: RelationshipRoleSuggestionsState;
};

export type RelationshipRoleSuggestionsState =
  | { isStale: boolean; items: readonly CharacterRelationshipRoleSuggestionView[]; kind: "results" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "hint" }
  | { kind: "loading" };

type UseRelationshipRoleSuggestionsArgs = {
  enabled: boolean;
  search: string;
};

export function useRelationshipRoleSuggestions({
  enabled,
  search,
}: UseRelationshipRoleSuggestionsArgs): RelationshipRoleSuggestions {
  const term = collapseSpaces(search);
  const debouncedTerm = useDebouncedValue(term, RELATIONSHIP_ROLE_SUGGESTIONS.debounceMs);

  const query = useInfiniteQuery({
    enabled: enabled && !isHintTerm(term),
    getNextPageParam: (lastPage: PaginatedCharacterRelationshipRoleSuggestionsView) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: isHintTerm(debouncedTerm)
      ? skipToken
      : async ({ pageParam, signal }): Promise<PaginatedCharacterRelationshipRoleSuggestionsView> =>
          PaginatedCharacterRelationshipRoleSuggestionsViewSchema.parse(
            await characterRelationshipRoleSuggestionsControllerList(
              {
                pageNumber: pageParam,
                pageSize: RELATIONSHIP_ROLE_SUGGESTIONS.pageSize,
                ...(debouncedTerm === "" ? {} : { q: debouncedTerm }),
              },
              { signal },
            ),
          ),
    queryKey: relationshipKeys.roleSuggestions(debouncedTerm),
  });

  const items = toSuggestionItems({
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    term,
  });
  const { isStale, status, ...pagination } = resolveInfiniteSuggestions({
    debouncedTerm,
    idle: isHintTerm(term) ? "hint" : null,
    itemCount: items.length,
    query,
    term,
  });
  const hasExactMatch =
    !isStale && items.some((item) => normalizeName(item.label) === normalizeName(term));
  const isFreeValueOffered =
    term.length >= RELATIONSHIP_ROLE_SUGGESTIONS.minTermLength && !hasExactMatch;

  function toState(): RelationshipRoleSuggestionsState {
    return status === "results" ? { isStale, items, kind: "results" } : { kind: status };
  }

  return {
    ...pagination,
    freeValue: isFreeValueOffered ? term : null,
    state: toState(),
  };
}

function isHintTerm(term: string): boolean {
  return term.length > 0 && term.length < RELATIONSHIP_ROLE_SUGGESTIONS.minTermLength;
}

function toSuggestionItems({
  items,
  term,
}: {
  items: readonly CharacterRelationshipRoleSuggestionView[];
  term: string;
}): CharacterRelationshipRoleSuggestionView[] {
  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
  const normalizedTerm = normalizeName(term);
  const exactMatches = uniqueItems.filter((item) => normalizeName(item.label) === normalizedTerm);
  const otherItems = uniqueItems.filter((item) => normalizeName(item.label) !== normalizedTerm);
  return [...exactMatches, ...otherItems];
}
