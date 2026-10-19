import { type CharacterGraphView, CharacterGraphViewSchema } from "@app/shared";
import { type DefaultError, useQuery } from "@tanstack/react-query";

import type { BookCharacterGraphControllerGetParams } from "@/shared/api/generated/model";

import { assertNever } from "@/lib/assert-never";
import {
  bookCharacterGraphControllerGet,
  seriesCharacterGraphControllerGet,
} from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import type { RelationshipGraphCriteria } from "../model/relationship-graph-criteria";
import type { RelationshipGraphScope } from "../model/relationship-graph-scope";
import type { RelationshipScopeKey } from "../model/relationship-scope";

import { toRelationshipGraphParams } from "../model/relationship-graph-criteria";
import { toRelationshipScopeKey } from "../model/relationship-scope";
import { relationshipKeys } from "./relationship-keys";

export function useRelationshipGraph({
  criteria,
  scope,
}: {
  criteria: RelationshipGraphCriteria;
  scope: RelationshipGraphScope;
}) {
  const params = toRelationshipGraphParams(criteria);
  const scopeKey = toRelationshipScopeKey(scope);
  const queryKey = relationshipKeys.graph({ criteria, scopeKey });

  return useQuery<CharacterGraphView, DefaultError, CharacterGraphView, typeof queryKey>({
    placeholderData: (previousGraph, previousQuery) =>
      previousQuery !== undefined && isSameScopeKey(previousQuery.queryKey[2], scopeKey)
        ? previousGraph
        : undefined,
    queryFn: async ({ signal }) =>
      CharacterGraphViewSchema.parse(await fetchRelationshipGraph({ params, scope, signal })),
    queryKey,
  });
}

function fetchRelationshipGraph({
  params,
  scope,
  signal,
}: {
  params: BookCharacterGraphControllerGetParams;
  scope: RelationshipGraphScope;
  signal: AbortSignal;
}): Promise<unknown> {
  switch (scope.kind) {
    case "book":
      return bookCharacterGraphControllerGet(scope.bookId, params, { signal });
    case "series":
      return seriesCharacterGraphControllerGet(
        scope.seriesId,
        {
          ...params,
          ...(scope.contextBookId === null ? {} : { contextBookId: scope.contextBookId }),
        },
        { signal },
      );
    default:
      return assertNever(scope);
  }
}

function isSameScopeKey(left: RelationshipScopeKey, right: RelationshipScopeKey): boolean {
  return (
    left.kind === right.kind &&
    left.scopeId === right.scopeId &&
    left.contextBookId === right.contextBookId
  );
}
