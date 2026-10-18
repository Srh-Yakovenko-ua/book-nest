import {
  type CharacterRelationshipDetailsView,
  CharacterRelationshipDetailsViewSchema,
} from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { characterRelationshipsControllerGetForEdit } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import { relationshipKeys } from "./relationship-keys";

const EDITABLE_RELATIONSHIP = {
  gcTime: 0,
} as const;

type UseRelationshipEditableArgs = {
  enabled?: boolean;
  relationshipId: string;
};

export function useRelationshipEditable({
  enabled = true,
  relationshipId,
}: UseRelationshipEditableArgs) {
  return useQuery({
    enabled,
    gcTime: EDITABLE_RELATIONSHIP.gcTime,
    queryFn: async ({ signal }): Promise<CharacterRelationshipDetailsView> =>
      CharacterRelationshipDetailsViewSchema.parse(
        await characterRelationshipsControllerGetForEdit(relationshipId, { signal }),
      ),
    queryKey: relationshipKeys.editable(relationshipId),
    retry: false,
  });
}
