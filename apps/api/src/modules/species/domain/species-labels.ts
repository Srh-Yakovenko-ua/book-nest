import type { CatalogLocale, SpeciesLabels } from "@app/shared";

import type { SpeciesNameKind } from "../../../generated/prisma/client.js";

export type SpeciesLabelSource = {
  name: string;
  names: readonly { kind: SpeciesNameKind; locale: string; name: string }[];
};

export function resolveSpeciesLabels(species: SpeciesLabelSource): SpeciesLabels {
  const uk = canonicalLabel({ locale: "uk", species });
  const en = canonicalLabel({ locale: "en", species });
  return {
    en: en ?? uk ?? species.name,
    uk: uk ?? en ?? species.name,
  };
}

function canonicalLabel({
  locale,
  species,
}: {
  locale: CatalogLocale;
  species: SpeciesLabelSource;
}): string | undefined {
  return species.names.find((entry) => entry.kind === "label" && entry.locale === locale)?.name;
}
