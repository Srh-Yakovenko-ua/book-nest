import type { CharacterDeletionPreview } from "@app/shared";

import { CharacterDeletionPreviewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { charactersControllerDeletionPreview } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export function useDeletionPreview(characterId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<CharacterDeletionPreview> =>
      CharacterDeletionPreviewSchema.parse(await charactersControllerDeletionPreview(characterId)),
    queryKey: characterKeys.deletionPreview(characterId),
    retry: false,
  });
}
