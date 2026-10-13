"use client";

import type { MergeSpeciesInput, SpeciesMergeResult } from "@app/shared";

import { SpeciesMergeResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { speciesControllerMerge } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { invalidateSpeciesDependents, speciesKeys } from "./species-keys";

type MergeSpeciesVariables = {
  input: MergeSpeciesInput;
  sourceId: string;
};

export function useMergeSpecies() {
  const queryClient = useQueryClient();
  const locale = useSpeciesLocale();

  return useMutation({
    mutationFn: async ({ input, sourceId }: MergeSpeciesVariables): Promise<SpeciesMergeResult> =>
      SpeciesMergeResultSchema.parse(await speciesControllerMerge(sourceId, input, { locale })),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: speciesKeys.all });
    },
    onSuccess: () => {
      void invalidateSpeciesDependents(queryClient);
    },
  });
}
