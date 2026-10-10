"use client";

import type { CatalogLocale } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { useLocale } from "next-intl";

export function useSpeciesLocale(): CatalogLocale {
  return CatalogLocaleSchema.catch("uk").parse(useLocale());
}
