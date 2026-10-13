"use client";

import type { OwnSpeciesView } from "@app/shared";

import { OwnSpeciesListSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { SpeciesControllerListOwnParams } from "@/shared/api/generated/model";

import { speciesControllerListOwn } from "@/shared/api/generated/endpoints/species/species";

import { useSpeciesLocale } from "../model/use-species-locale";
import { speciesKeys } from "./species-keys";

export function useOwnSpecies() {
  const locale = useSpeciesLocale();
  const params: SpeciesControllerListOwnParams = { locale };

  return useQuery({
    queryFn: async (): Promise<OwnSpeciesView[]> =>
      OwnSpeciesListSchema.parse(await speciesControllerListOwn(params)).items,
    queryKey: speciesKeys.own(params),
  });
}
