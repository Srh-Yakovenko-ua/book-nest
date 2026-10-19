import {
  type CharacterRelationshipPathView,
  CharacterRelationshipPathViewSchema,
} from "@app/shared";
import { skipToken, useQuery } from "@tanstack/react-query";

import { characterRelationshipsControllerFindPath } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import type { RelationshipGraphPathQuery } from "../model/relationship-graph-path";

import { toRelationshipGraphFilterParams } from "../model/relationship-graph-criteria";
import { toRelationshipGraphPathRequest } from "../model/relationship-graph-path";
import { relationshipKeys } from "./relationship-keys";

export function useRelationshipPath(pathQuery: RelationshipGraphPathQuery) {
  const request = toRelationshipGraphPathRequest(pathQuery);

  return useQuery({
    queryFn:
      request === null
        ? skipToken
        : async ({ signal }): Promise<CharacterRelationshipPathView> =>
            CharacterRelationshipPathViewSchema.parse(
              await characterRelationshipsControllerFindPath(
                {
                  ...toRelationshipGraphFilterParams(request.filters),
                  contextBookId: request.contextBookId,
                  fromId: request.fromId,
                  toId: request.toId,
                },
                { signal },
              ),
            ),
    queryKey: relationshipKeys.path(pathQuery),
    retry: false,
  });
}
