import type { CharacterOverviewView } from "@app/shared";

import { CharacterOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { charactersControllerOverview } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export function useCharactersOverview() {
  return useQuery({
    queryFn: async (): Promise<CharacterOverviewView> =>
      CharacterOverviewViewSchema.parse(await charactersControllerOverview()),
    queryKey: characterKeys.overview(),
  });
}
