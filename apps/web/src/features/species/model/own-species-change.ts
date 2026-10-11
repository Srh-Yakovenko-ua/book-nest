import type { Nullable, SpeciesOptionView } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { SpeciesSelection } from "./species-selection";

import { selectionFromOption } from "./species-selection";

export type OwnSpeciesChange =
  | { kind: "deleted"; speciesId: string }
  | { kind: "merged"; sourceId: string; target: SpeciesOptionView }
  | { kind: "renamed"; species: SpeciesOptionView };

export function applyOwnSpeciesChange(
  selection: Nullable<SpeciesSelection>,
  change: OwnSpeciesChange,
): Nullable<SpeciesSelection> {
  if (selection === null) return null;

  switch (change.kind) {
    case "deleted":
      return change.speciesId === selection.id ? null : selection;
    case "merged":
      return change.sourceId === selection.id ? selectionFromOption(change.target) : selection;
    case "renamed":
      return change.species.id === selection.id ? selectionFromOption(change.species) : selection;
    default:
      return assertNever(change);
  }
}
