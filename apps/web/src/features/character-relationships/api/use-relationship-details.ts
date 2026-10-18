import {
  type CharacterRelationshipSafeDetailsView,
  CharacterRelationshipSafeDetailsViewSchema,
} from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { characterRelationshipsControllerGetById } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import type { RelationshipReveal } from "../model/relationship-reveal";
import type { RelationshipScope } from "../model/relationship-scope";

import { hasRelationshipReveal, toRelationshipRevealParams } from "../model/relationship-reveal";
import { toRelationshipScopeKey, toRelationshipScopeParams } from "../model/relationship-scope";
import { relationshipKeys } from "./relationship-keys";

const REVEALED_DETAILS = {
  gcTime: 0,
} as const;

type UseRelationshipDetailsArgs = {
  enabled?: boolean;
  relationshipId: string;
  reveal: RelationshipReveal;
  scope: RelationshipScope;
};

export function useRelationshipDetails({
  enabled = true,
  relationshipId,
  reveal,
  scope,
}: UseRelationshipDetailsArgs) {
  const isRevealed = hasRelationshipReveal(reveal);
  const params = { ...toRelationshipScopeParams(scope), ...toRelationshipRevealParams(reveal) };

  return useQuery({
    enabled,
    gcTime: isRevealed ? REVEALED_DETAILS.gcTime : undefined,
    placeholderData: isRevealed ? keepPreviousData : undefined,
    queryFn: async ({ signal }): Promise<CharacterRelationshipSafeDetailsView> =>
      CharacterRelationshipSafeDetailsViewSchema.parse(
        await characterRelationshipsControllerGetById(relationshipId, params, { signal }),
      ),
    queryKey: relationshipKeys.details({
      relationshipId,
      reveal,
      scopeKey: toRelationshipScopeKey(scope),
    }),
    retry: false,
  });
}
