import {
  type CharacterRelationshipDetailsView,
  CharacterRelationshipDetailsViewSchema,
  type CreateCharacterRelationship,
} from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterRelationshipsControllerCreate } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import { refreshRelationships } from "./relationship-mutation-effects";

export function useCreateRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateCharacterRelationship,
    ): Promise<CharacterRelationshipDetailsView> =>
      CharacterRelationshipDetailsViewSchema.parse(
        await characterRelationshipsControllerCreate(input),
      ),
    onSuccess: () => refreshRelationships(queryClient),
  });
}
