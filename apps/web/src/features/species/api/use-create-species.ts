"use client";

import type { SpeciesNameInput, SpeciesOptionView } from "@app/shared";

import { SpeciesOptionViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { speciesControllerCreate } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { speciesKeys } from "./species-keys";

export function useCreateSpecies() {
  const queryClient = useQueryClient();
  const locale = useSpeciesLocale();

  return useMutation({
    mutationFn: async (input: SpeciesNameInput): Promise<SpeciesOptionView> =>
      SpeciesOptionViewSchema.parse(await speciesControllerCreate(input, { locale })),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: speciesKeys.all });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: speciesKeys.all, refetchType: "none" });
    },
  });
}
