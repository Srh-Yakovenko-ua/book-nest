"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LibraryTagFilter } from "@/features/books";
import { cn } from "@/lib/utils";

import type {
  CharactersCatalogAdvancedFilters,
  CharactersCatalogSpoilerFilter,
  CharactersCatalogState,
} from "../model/characters-catalog-query";
import type { CatalogSpeciesNames } from "../model/use-catalog-species-names";
import type { CharactersCatalogAdvancedPatch } from "../model/use-characters-catalog-query";

import { useCharacterGroupOptions } from "../api/use-character-group-options";
import {
  ATTITUDE_OPTIONS,
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_ROLE,
  GENDER_OPTIONS,
} from "../model/character-options";
import {
  CHARACTERS_CATALOG_ADVANCED_EMPTY,
  CHARACTERS_CATALOG_SPOILER_FILTERS,
  countActiveAdvancedFilters,
  pickAdvancedFilters,
} from "../model/characters-catalog-query";
import { CharactersBookFilter } from "./characters-book-filter";
import { CharactersSeriesFilter } from "./characters-series-filter";
import { CharactersSpeciesFilter } from "./characters-species-filter";

type CharactersCatalogFiltersProps = {
  activeCount: number;
  onApply: (patch: CharactersCatalogAdvancedPatch) => void;
  speciesNames: CatalogSpeciesNames;
  state: CharactersCatalogState;
};

export function CharactersCatalogFilters({
  activeCount,
  onApply,
  speciesNames,
  state,
}: CharactersCatalogFiltersProps) {
  const t = useTranslations("characters.catalog.filters");
  const tAttitude = useTranslations("characters.attitude");
  const tGender = useTranslations("characters.gender");
  const tImportance = useTranslations("characters.importance");
  const tRole = useTranslations("characters.roleType");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CharactersCatalogAdvancedFilters>(() =>
    pickAdvancedFilters(state),
  );

  function patchDraft(patch: CharactersCatalogAdvancedPatch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(pickAdvancedFilters(state));
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          className={cn("h-10", activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-10 max-sm:px-0")}
          type="button"
          variant="secondary"
        >
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          {activeCount > 0 ? (
            <Badge className="ml-0.5" variant="secondary">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("series")}>
            <CharactersSeriesFilter
              onChange={(seriesId) => patchDraft({ seriesId })}
              value={draft.seriesId}
            />
          </FilterSection>

          <FilterSection title={t("book")}>
            <CharactersBookFilter
              onChange={(bookId) => patchDraft({ bookId })}
              value={draft.bookId}
            />
          </FilterSection>

          <FilterSection title={t("importance")}>
            <ChipGroup
              label={t("importance")}
              mode="multi"
              onValueChange={(importance) => patchDraft({ importance })}
              options={BOOK_CHARACTER_IMPORTANCE.options.map((option) => ({
                label: tImportance(option),
                value: option,
              }))}
              size="sm"
              value={draft.importance}
            />
          </FilterSection>

          <FilterSection title={t("role")}>
            <ChipGroup
              label={t("role")}
              mode="multi"
              onValueChange={(role) => patchDraft({ role })}
              options={BOOK_CHARACTER_ROLE.options.map((option) => ({
                label: tRole(option),
                value: option,
              }))}
              size="sm"
              value={draft.role}
            />
          </FilterSection>

          <FilterSection title={t("gender")}>
            <ChipGroup
              label={t("gender")}
              mode="multi"
              onValueChange={(gender) => patchDraft({ gender })}
              options={GENDER_OPTIONS.map((option) => ({ label: tGender(option), value: option }))}
              size="sm"
              value={draft.gender}
            />
          </FilterSection>

          <FilterSection title={t("species")}>
            <CharactersSpeciesFilter
              names={speciesNames}
              onChange={(speciesId) => patchDraft({ speciesId })}
              value={draft.speciesId}
            />
          </FilterSection>

          <FilterSection title={t("attitude")}>
            <ChipGroup
              label={t("attitude")}
              mode="multi"
              onValueChange={(attitude) => patchDraft({ attitude })}
              options={ATTITUDE_OPTIONS.map((option) => ({
                label: tAttitude(option),
                value: option,
              }))}
              size="sm"
              value={draft.attitude}
            />
          </FilterSection>

          <FilterSection title={t("tags")}>
            <LibraryTagFilter
              emptyLabel={t("tagEmpty")}
              id="characters-filter-tag"
              label={t("tags")}
              onAdd={(tag) =>
                setDraft((current) => ({ ...current, tagId: [...current.tagId, tag.id] }))
              }
              onRemove={(id) =>
                setDraft((current) => ({
                  ...current,
                  tagId: current.tagId.filter((value) => value !== id),
                }))
              }
              placeholder={t("tagPlaceholder")}
              removeLabel={(name) => t("removeTag", { name })}
              resolveName={() => undefined}
              searchingLabel={t("tagSearching")}
              suggestionsHeading={t("tagSuggestions")}
              value={draft.tagId}
            />
          </FilterSection>

          <FilterSection title={t("groups")}>
            <GroupFilter onChange={(groupId) => patchDraft({ groupId })} value={draft.groupId} />
          </FilterSection>

          <FilterSection title={t("spoilers")}>
            <Select
              onValueChange={(next) => patchDraft({ spoilers: toSpoilerFilter(next) })}
              value={draft.spoilers}
            >
              <SelectTrigger
                aria-label={t("spoilers")}
                className="h-10 w-full data-[size=default]:h-10"
                clearLabel={t("clearSpoilers")}
                isClearable={draft.spoilers !== "all"}
                onClear={() => patchDraft({ spoilers: "all" })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHARACTERS_CATALOG_SPOILER_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`spoilerOptions.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>
        </div>

        <SheetFooter>
          <Button
            disabled={countActiveAdvancedFilters(draft) === 0}
            onClick={() => setDraft(CHARACTERS_CATALOG_ADVANCED_EMPTY)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            type="button"
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function GroupFilter({
  onChange,
  value,
}: {
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const t = useTranslations("characters.catalog.filters");
  const groups = useCharacterGroupOptions(true);
  const options = (groups.data?.items ?? []).filter((group) => group.name !== null);

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noGroups")}</p>;
  }

  return (
    <ChipGroup
      label={t("groups")}
      mode="multi"
      onValueChange={onChange}
      options={options.map((group) => ({ label: group.name ?? "", value: group.id }))}
      size="sm"
      value={value}
    />
  );
}

function toSpoilerFilter(value: string): CharactersCatalogSpoilerFilter {
  return CHARACTERS_CATALOG_SPOILER_FILTERS.find((option) => option === value) ?? "all";
}
