"use client";

import type { SpeciesNameInput, SpeciesOptionView } from "@app/shared";

import { SpeciesOptionViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { speciesControllerRename } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { invalidateSpeciesDependents, speciesKeys } from "./species-keys";

type RenameSpeciesVariables = {
  input: SpeciesNameInput;
  speciesId: string;
};

export function useRenameSpecies() {
  const queryClient = useQueryClient();
  const locale = useSpeciesLocale();

  return useMutation({
    mutationFn: async ({ input, speciesId }: RenameSpeciesVariables): Promise<SpeciesOptionView> =>
      SpeciesOptionViewSchema.parse(await speciesControllerRename(speciesId, input, { locale })),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: speciesKeys.all });
    },
    onSuccess: () => {
      void invalidateSpeciesDependents(queryClient);
    },
  });
}
