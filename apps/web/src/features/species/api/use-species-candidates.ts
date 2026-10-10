"use client";

import type { SpeciesCandidates } from "@app/shared";

import { SpeciesCandidatesSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { SpeciesControllerCandidatesParams } from "@/shared/api/generated/model";

import { speciesControllerCandidates } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { speciesKeys } from "./species-keys";

type SpeciesCandidatesArgs = {
  enabled: boolean;
  name: string;
};

export function useSpeciesCandidates({ enabled, name }: SpeciesCandidatesArgs) {
  const locale = useSpeciesLocale();
  const params: SpeciesControllerCandidatesParams = { locale, name };

  return useQuery({
    enabled: enabled && name !== "",
    queryFn: async ({ signal }): Promise<SpeciesCandidates> =>
      SpeciesCandidatesSchema.parse(await speciesControllerCandidates(params, { signal })),
    queryKey: speciesKeys.candidates(params),
  });
}
