import type { CharacterCustomLabelsView } from "@app/shared";

import { CharacterCustomLabelsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { characterCustomLabelsControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export function useCharacterCustomLabels() {
  return useQuery({
    queryFn: async ({ signal }): Promise<CharacterCustomLabelsView> =>
      CharacterCustomLabelsViewSchema.parse(await characterCustomLabelsControllerList({ signal })),
    queryKey: characterKeys.customLabels(),
  });
}
