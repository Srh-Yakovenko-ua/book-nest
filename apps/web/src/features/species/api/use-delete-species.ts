"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { speciesControllerDeleteOwn } from "@/shared/api/generated/endpoints/species/species";

import { invalidateSpeciesDependents, speciesKeys } from "./species-keys";

export function useDeleteSpecies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (speciesId: string): Promise<void> => {
      await speciesControllerDeleteOwn(speciesId);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: speciesKeys.all });
    },
    onSuccess: (_result, speciesId) => {
      queryClient.removeQueries({ queryKey: speciesKeys.deletionPreview(speciesId) });
      void invalidateSpeciesDependents(queryClient);
    },
  });
}
