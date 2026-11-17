import type { CharacterFacetsView } from "@app/shared";

import {
  BookCharacterImportanceSchema,
  BookCharacterRoleTypeSchema,
  CharacterAttitudeSchema,
  CharacterGenderSchema,
} from "@app/shared";

import type { CharacterFacetCountRow } from "../infrastructure/character-facets.repository.js";
import type { CharacterFacetDimension } from "./character-facet-filters.js";

type CharacterFacetEntry<Value> = {
  count: number;
  value: Value;
};

export function toCharacterFacetsView(
  rows: Record<CharacterFacetDimension, readonly CharacterFacetCountRow[]>,
): CharacterFacetsView {
  return {
    attitude: toFacetEntries({
      parseValue: (value) => CharacterAttitudeSchema.parse(value),
      rows: rows.attitude,
    }),
    gender: toFacetEntries({
      parseValue: (value) => CharacterGenderSchema.parse(value),
      rows: rows.gender,
    }),
    group: toFacetEntries({ parseValue: keepValue, rows: rows.group }),
    importance: toFacetEntries({
      parseValue: (value) => BookCharacterImportanceSchema.parse(value),
      rows: rows.importance,
    }),
    role: toFacetEntries({
      parseValue: (value) => BookCharacterRoleTypeSchema.parse(value),
      rows: rows.role,
    }),
    species: toFacetEntries({ parseValue: keepValue, rows: rows.species }),
    tag: toFacetEntries({ parseValue: keepValue, rows: rows.tag }),
  };
}

function byCountThenValue<Value extends string>(
  left: CharacterFacetEntry<Value>,
  right: CharacterFacetEntry<Value>,
): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  if (left.value === right.value) {
    return 0;
  }
  return left.value < right.value ? -1 : 1;
}

function keepValue(value: string): string {
  return value;
}

function toFacetEntries<Value extends string>({
  parseValue,
  rows,
}: {
  parseValue: (value: string) => Value;
  rows: readonly CharacterFacetCountRow[];
}): CharacterFacetEntry<Value>[] {
  return rows
    .map((row) => ({ count: row.count, value: parseValue(row.value) }))
    .sort(byCountThenValue);
}
