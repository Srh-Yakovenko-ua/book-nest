"use client";

import type { BookCharacterImportance, Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CharactersRosterSort } from "../model/characters-roster-query";
import type { UseCharactersRosterQueryResult } from "../model/use-characters-roster-query";

import { BOOK_CHARACTER_IMPORTANCE } from "../model/character-options";
import {
  CHARACTERS_ROSTER_SORT_DEFAULT,
  CHARACTERS_ROSTER_SORTS,
} from "../model/characters-roster-query";

type CharactersToolbarProps = {
  addButtonRef: RefObject<Nullable<HTMLButtonElement>>;
  onAdd: () => void;
  roster: UseCharactersRosterQueryResult;
};

export function CharactersToolbar({ addButtonRef, onAdd, roster }: CharactersToolbarProps) {
  const t = useTranslations("characters.toolbar");
  const tSort = useTranslations("characters.sort");
  const { characterFavoritesOnly, characterPovOnly } = roster.state;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={() => roster.setSearch("")}
            onSearch={roster.setSearch}
            placeholder={t("searchPlaceholder")}
            value={roster.state.characterSearch}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <Select
              onValueChange={(next) => roster.setSort(toSort(next))}
              value={roster.state.characterSort}
            >
              <SelectTrigger
                aria-label={t("sortLabel")}
                className="w-full data-[size=default]:h-10"
              >
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

          <Button className="h-10" onClick={onAdd} ref={addButtonRef}>
            <UiIcon name="plus" size={16} />
            {t("add")}
          </Button>
        </div>
      </div>

      <div
        aria-label={t("filtersLabel")}
        className="flex flex-wrap items-center gap-2"
        role="group"
      >
        <ImportanceFilter
          onChange={roster.setImportance}
          value={roster.state.characterImportance}
        />

        <Button
          aria-pressed={characterFavoritesOnly}
          className="h-9"
          onClick={() => roster.setFavoritesOnly(!characterFavoritesOnly)}
          variant={characterFavoritesOnly ? "tonal" : "outline"}
        >
          <UiIcon name={characterFavoritesOnly ? "heart-fill" : "heart"} size={16} />
          {t("favoritesOnly")}
        </Button>

        <Button
          aria-pressed={characterPovOnly}
          className="h-9"
          onClick={() => roster.setPovOnly(!characterPovOnly)}
          variant={characterPovOnly ? "tonal" : "outline"}
        >
          <UiIcon name="user" size={16} />
          {t("povOnly")}
        </Button>

        {roster.hasActiveFilters ? (
          <Button className="h-9" onClick={roster.clearFilters} variant="ghost">
            <UiIcon name="x" size={16} />
            {t("clearFilters")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ImportanceFilter({
  onChange,
  value,
}: {
  onChange: (value: BookCharacterImportance[]) => void;
  value: readonly BookCharacterImportance[];
}) {
  const t = useTranslations("characters.toolbar");
  const tImportance = useTranslations("characters.importance");

  function toggle(option: BookCharacterImportance, isChecked: boolean) {
    onChange(isChecked ? [...value, option] : value.filter((selected) => selected !== option));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-9" variant={value.length > 0 ? "tonal" : "outline"}>
          <UiIcon name="filter" size={16} />
          {t("importance")}
          {value.length > 0 ? (
            <Badge variant="secondary">
              <span aria-hidden>{value.length}</span>
              <span className="sr-only">{t("selectedCount", { count: value.length })}</span>
            </Badge>
          ) : null}
          <UiIcon name="chevron-down" size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {BOOK_CHARACTER_IMPORTANCE.options.map((option) => (
          <DropdownMenuCheckboxItem
            checked={value.includes(option)}
            key={option}
            onCheckedChange={(isChecked) => toggle(option, isChecked)}
            onSelect={(event) => event.preventDefault()}
          >
            {tImportance(option)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toSort(value: string): CharactersRosterSort {
  return (
    CHARACTERS_ROSTER_SORTS.find((option) => option === value) ?? CHARACTERS_ROSTER_SORT_DEFAULT
  );
}
