import type { Nullable, SpeciesRefView } from "@app/shared";

import type { SpeciesLabelSource } from "./species-labels.js";

import { resolveSpeciesLabels } from "./species-labels.js";

export type SpeciesRefSource = SpeciesLabelSource & {
  id: string;
  key: Nullable<string>;
};

export function toSpeciesRefView(species: Nullable<SpeciesRefSource>): Nullable<SpeciesRefView> {
  if (species === null) {
    return null;
  }
  return { id: species.id, key: species.key, labels: resolveSpeciesLabels(species) };
}
