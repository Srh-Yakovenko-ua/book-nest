"use client";

import type { CharacterFacetsView } from "@app/shared";

import { ChipGroup } from "@/components/ui/chip-group";

import { characterFacetCount } from "../model/character-facet-count";

type CharactersEnumFacetFilterProps<Option extends string> = {
  counts: CharacterFacetsView["attitude" | "gender" | "importance" | "role"] | undefined;
  countsPending: boolean;
  label: string;
  labelOf: (option: Option) => string;
  onChange: (value: Option[]) => void;
  options: readonly Option[];
  value: Option[];
};

export function CharactersEnumFacetFilter<Option extends string>({
  counts,
  countsPending,
  label,
  labelOf,
  onChange,
  options,
  value,
}: CharactersEnumFacetFilterProps<Option>) {
  return (
    <ChipGroup
      countsPending={countsPending}
      label={label}
      mode="multi"
      onValueChange={(next) => onChange(options.filter((option) => next.includes(option)))}
      options={options.map((option) => ({
        count: characterFacetCount(counts, option),
        label: labelOf(option),
        value: option,
      }))}
      size="sm"
      value={value}
    />
  );
}
