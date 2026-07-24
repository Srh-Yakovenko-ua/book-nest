"use client";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CharactersRosterSort } from "../model/characters-roster-query";

import { CHARACTERS_ROSTER_SORTS } from "../model/characters-roster-query";

type CharactersToolbarProps = {
  onAdd: () => void;
  onOpenPalette: () => void;
  onSearch: (value: string) => void;
  onSortChange: (value: CharactersRosterSort) => void;
  search: string;
  sort: CharactersRosterSort;
};

export function CharactersToolbar({
  onAdd,
  onOpenPalette,
  onSearch,
  onSortChange,
  search,
  sort,
}: CharactersToolbarProps) {
  const t = useTranslations("characters.toolbar");
  const tSort = useTranslations("characters.sort");

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={() => onSearch("")}
            onSearch={onSearch}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </div>
        <Button
          aria-label={t("palette")}
          className="h-10 shrink-0"
          onClick={onOpenPalette}
          variant="secondary"
        >
          <UiIcon name="search" size={16} />
          <span className="hidden sm:inline">{t("palette")}</span>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-56">
          <Select onValueChange={(next) => onSortChange(toSort(next))} value={sort}>
            <SelectTrigger aria-label={t("sortLabel")} className="w-full data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHARACTERS_ROSTER_SORTS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tSort(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="h-10" onClick={onAdd}>
          <UiIcon name="plus" size={16} />
          {t("add")}
        </Button>
      </div>
    </div>
  );
}

function toSort(value: string): CharactersRosterSort {
  return CHARACTERS_ROSTER_SORTS.find((option) => option === value) ?? "recommended";
}
