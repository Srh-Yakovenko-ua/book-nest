"use client";

import type { Nullable, SpeciesRefView } from "@app/shared";

import { useSpeciesLocale } from "./use-species-locale";

export function useSpeciesLabel(): (ref: Nullable<SpeciesRefView>) => Nullable<string> {
  const locale = useSpeciesLocale();
  return (ref) => (ref === null ? null : ref.labels[locale]);
}
