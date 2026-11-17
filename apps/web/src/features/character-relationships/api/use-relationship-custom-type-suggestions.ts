import type {
  CharacterRelationshipCustomTypeView,
  Nullable,
  PaginatedCharacterRelationshipCustomTypesView,
  RelationshipDirectionality,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS,
  collapseSpaces,
  normalizeName,
  PaginatedCharacterRelationshipCustomTypesViewSchema,
} from "@app/shared";
import { keepPreviousData, skipToken, useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { characterRelationshipCustomTypesControllerList } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import { resolveInfiniteSuggestions } from "./infinite-suggestions";
import { relationshipKeys } from "./relationship-keys";

const RELATIONSHIP_CUSTOM_TYPE_SUGGESTIONS = {
  debounceMs: 300,
  minTermLength: 2,
  pageSize: CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS.pageSizeDefault,
} as const;

export type RelationshipCustomTypeSuggestions = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  retry: () => void;
  state: RelationshipCustomTypeSuggestionsState;
};

export type RelationshipCustomTypeSuggestionsState =
  | { isStale: boolean; items: readonly CharacterRelationshipCustomTypeView[]; kind: "results" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "hint" }
  | { kind: "loading" };

type UseRelationshipCustomTypeSuggestionsArgs = {
  directionality: Nullable<RelationshipDirectionality>;
  enabled: boolean;
  search: string;
};

export function useRelationshipCustomTypeSuggestions({
  directionality,
  enabled,
  search,
}: UseRelationshipCustomTypeSuggestionsArgs): RelationshipCustomTypeSuggestions {
  const term = collapseSpaces(search);
  const debouncedTerm = useDebouncedValue(term, RELATIONSHIP_CUSTOM_TYPE_SUGGESTIONS.debounceMs);

  const query = useInfiniteQuery({
    enabled: enabled && !isHintTerm(term),
    getNextPageParam: (lastPage: PaginatedCharacterRelationshipCustomTypesView) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: isHintTerm(debouncedTerm)
      ? skipToken
      : async ({ pageParam, signal }): Promise<PaginatedCharacterRelationshipCustomTypesView> =>
          PaginatedCharacterRelationshipCustomTypesViewSchema.parse(
            await characterRelationshipCustomTypesControllerList(
              {
                pageNumber: pageParam,
                pageSize: RELATIONSHIP_CUSTOM_TYPE_SUGGESTIONS.pageSize,
                ...(directionality === null ? {} : { directionality }),
                ...(debouncedTerm === "" ? {} : { q: debouncedTerm }),
              },
              { signal },
            ),
          ),
    queryKey: relationshipKeys.customTypes({ directionality, term: debouncedTerm }),
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

  function toState(): RelationshipCustomTypeSuggestionsState {
    return status === "results" ? { isStale, items, kind: "results" } : { kind: status };
  }

  return { ...pagination, state: toState() };
}

function isHintTerm(term: string): boolean {
  return term.length > 0 && term.length < RELATIONSHIP_CUSTOM_TYPE_SUGGESTIONS.minTermLength;
}

function toSuggestionItems({
  items,
  term,
}: {
  items: readonly CharacterRelationshipCustomTypeView[];
  term: string;
}): CharacterRelationshipCustomTypeView[] {
  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
  const normalizedTerm = normalizeName(term);
  const exactMatches = uniqueItems.filter((item) => normalizeName(item.name) === normalizedTerm);
  const otherItems = uniqueItems.filter((item) => normalizeName(item.name) !== normalizedTerm);
  return [...exactMatches, ...otherItems];
}
