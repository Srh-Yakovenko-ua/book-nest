import {
  CHARACTER_RELATIONSHIP_LIST_LIMITS,
  type PaginatedCharacterRelationshipListView,
  PaginatedCharacterRelationshipListViewSchema,
} from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { characterRelationshipsControllerList } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import type { RelationshipListCriteria } from "../model/relationship-list-query";
import type { RelationshipScope } from "../model/relationship-scope";

import { toRelationshipListResult } from "../model/relationship-list-items";
import { toRelationshipScopeKey, toRelationshipScopeParams } from "../model/relationship-scope";
import { relationshipKeys } from "./relationship-keys";

export function useRelationshipList({
  criteria,
  scope,
}: {
  criteria: RelationshipListCriteria;
  scope: RelationshipScope;
}) {
  const scopeParams = toRelationshipScopeParams(scope);

  return useInfiniteQuery({
    getNextPageParam: (lastPage: PaginatedCharacterRelationshipListView) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<PaginatedCharacterRelationshipListView> =>
      PaginatedCharacterRelationshipListViewSchema.parse(
        await characterRelationshipsControllerList(
          {
            ...scopeParams,
            ...criteria,
            pageNumber: pageParam,
            pageSize: CHARACTER_RELATIONSHIP_LIST_LIMITS.pageSizeDefault,
          },
          { signal },
        ),
      ),
    queryKey: relationshipKeys.list({ criteria, scopeKey: toRelationshipScopeKey(scope) }),
    select: toRelationshipListResult,
  });
}
