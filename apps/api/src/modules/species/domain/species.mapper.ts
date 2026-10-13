import type {
  CatalogLocale,
  Nullable,
  SpeciesCategoryView,
  SpeciesLabels,
  SpeciesOptionView,
} from "@app/shared";

import type { SpeciesLabelSource } from "./species-labels.js";

import { resolveSpeciesLabels } from "./species-labels.js";

export type SpeciesCategoryLabels = ReadonlyMap<string, SpeciesLabels>;

export type SpeciesViewContext = {
  categoryLabels: SpeciesCategoryLabels;
  locale: CatalogLocale;
  userId: string;
};

export type SpeciesViewSource = SpeciesLabelSource & {
  categoryKey: Nullable<string>;
  id: string;
  key: Nullable<string>;
  userId: Nullable<string>;
};

export function speciesDisplayName({
  locale,
  species,
}: {
  locale: CatalogLocale;
  species: SpeciesLabelSource;
}): string {
  return resolveSpeciesLabels(species)[locale];
}

export function toSpeciesOptionView({
  context,
  species,
}: {
  context: SpeciesViewContext;
  species: SpeciesViewSource;
}): SpeciesOptionView {
  return {
    category: toSpeciesCategoryView({ categoryKey: species.categoryKey, context }),
    id: species.id,
    isOwn: species.userId === context.userId,
    key: species.key,
    name: speciesDisplayName({ locale: context.locale, species }),
  };
}

function toSpeciesCategoryView({
  categoryKey,
  context,
}: {
  categoryKey: Nullable<string>;
  context: SpeciesViewContext;
}): Nullable<SpeciesCategoryView> {
  if (categoryKey === null) {
    return null;
  }
  const labels = context.categoryLabels.get(categoryKey);
  return { key: categoryKey, name: labels?.[context.locale] ?? categoryKey };
}
