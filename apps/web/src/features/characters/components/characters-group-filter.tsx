"use client";

import type { CharacterFacetsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import { useCharacterGroupOptions } from "../api/use-character-group-options";
import { characterFacetCount } from "../model/character-facet-count";

type CharactersGroupFilterProps = {
  counts: CharacterFacetsView["group"] | undefined;
  countsPending: boolean;
  onChange: (value: string[]) => void;
  value: string[];
};

export function CharactersGroupFilter({
  counts,
  countsPending,
  onChange,
  value,
}: CharactersGroupFilterProps) {
  const t = useTranslations("characters.catalog.filters");
  const groups = useCharacterGroupOptions(true);
  const options = (groups.data?.items ?? []).filter((group) => group.name !== null);

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noGroups")}</p>;
  }

  return (
    <ChipGroup
      countsPending={countsPending}
      label={t("groups")}
      mode="multi"
      onValueChange={onChange}
      options={options.map((group) => ({
        count: characterFacetCount(counts, group.id),
        label: group.name ?? "",
        value: group.id,
      }))}
      size="sm"
      value={value}
    />
  );
}
