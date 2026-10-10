"use client";

import type { SpeciesDeletionPreview } from "@app/shared";

import { SpeciesDeletionPreviewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { speciesControllerDeletionPreview } from "@/shared/api/generated/endpoints/species/species";

import { speciesKeys } from "./species-keys";

export function useSpeciesDeletionPreview(speciesId: string) {
  return useQuery({
    queryFn: async (): Promise<SpeciesDeletionPreview> =>
      SpeciesDeletionPreviewSchema.parse(await speciesControllerDeletionPreview(speciesId)),
    queryKey: speciesKeys.deletionPreview(speciesId),
    staleTime: 0,
  });
}
