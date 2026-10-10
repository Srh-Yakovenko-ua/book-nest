import type { CatalogLocale, Nullable, SpeciesOptionView, SpeciesRefView } from "@app/shared";

import { z } from "zod";

export const SpeciesSelectionSchema = z.object({
  id: z.uuid(),
  label: z.string(),
});

export type SpeciesSelection = z.infer<typeof SpeciesSelectionSchema>;

export function selectionFromOption(option: SpeciesOptionView): SpeciesSelection {
  return { id: option.id, label: option.name };
}

export function selectionFromRef(
  ref: Nullable<SpeciesRefView>,
  locale: CatalogLocale,
): Nullable<SpeciesSelection> {
  return ref === null ? null : { id: ref.id, label: ref.labels[locale] };
}
