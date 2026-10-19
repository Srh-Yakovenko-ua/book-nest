import {
  type CharacterRelationshipDetailsView,
  CharacterRelationshipDetailsViewSchema,
  type UpsertRelationshipBookState,
} from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterRelationshipsControllerUpsertBookState } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import {
  refreshRelationships,
  refreshRelationshipsWhenGone,
} from "./relationship-mutation-effects";

type UpsertRelationshipBookStateVariables = {
  bookId: string;
  input: UpsertRelationshipBookState;
  relationshipId: string;
};

export function useUpsertRelationshipBookState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      input,
      relationshipId,
    }: UpsertRelationshipBookStateVariables): Promise<CharacterRelationshipDetailsView> =>
      CharacterRelationshipDetailsViewSchema.parse(
        await characterRelationshipsControllerUpsertBookState(relationshipId, bookId, input),
      ),
    onError: (error) => refreshRelationshipsWhenGone({ error, queryClient }),
    onSuccess: () => refreshRelationships(queryClient),
  });
}
