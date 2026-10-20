"use client";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CharactersCatalogSpoilerFilter } from "../model/characters-catalog-query";

import { CHARACTERS_CATALOG_SPOILER_FILTERS } from "../model/characters-catalog-query";

type CharactersSpoilerFilterProps = {
  onChange: (value: CharactersCatalogSpoilerFilter) => void;
  value: CharactersCatalogSpoilerFilter;
};

export function CharactersSpoilerFilter({ onChange, value }: CharactersSpoilerFilterProps) {
  const t = useTranslations("characters.catalog.filters");

  return (
    <Select onValueChange={(next) => onChange(toSpoilerFilter(next))} value={value}>
      <SelectTrigger
        aria-label={t("spoilers")}
        className="h-10 w-full data-[size=default]:h-10"
        clearLabel={t("clearSpoilers")}
        isClearable={value !== "all"}
        onClear={() => onChange("all")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHARACTERS_CATALOG_SPOILER_FILTERS.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`spoilerOptions.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function toSpoilerFilter(value: string): CharactersCatalogSpoilerFilter {
  return CHARACTERS_CATALOG_SPOILER_FILTERS.find((option) => option === value) ?? "all";
}
