import {
  type CharacterRelationshipDetailsView,
  CharacterRelationshipDetailsViewSchema,
  type UpdateCharacterRelationship,
} from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterRelationshipsControllerUpdate } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import {
  refreshRelationshipsAndDictionaries,
  refreshRelationshipsWhenGone,
} from "./relationship-mutation-effects";

type UpdateRelationshipVariables = {
  input: UpdateCharacterRelationship;
  relationshipId: string;
};

export function useUpdateRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
      relationshipId,
    }: UpdateRelationshipVariables): Promise<CharacterRelationshipDetailsView> =>
      CharacterRelationshipDetailsViewSchema.parse(
        await characterRelationshipsControllerUpdate(relationshipId, input),
      ),
    onError: (error) => refreshRelationshipsWhenGone({ error, queryClient }),
    onSuccess: () => refreshRelationshipsAndDictionaries(queryClient),
  });
}
