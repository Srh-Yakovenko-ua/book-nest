"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterSection } from "@/components/ui/filter-panel";
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
  CharactersCatalogState,
} from "../model/characters-catalog-query";
import type { CatalogSpeciesNames } from "../model/use-catalog-species-names";
import type { CharactersCatalogAdvancedPatch } from "../model/use-characters-catalog-query";

import { useCharacterFacets } from "../api/use-character-facets";
import {
  ATTITUDE_OPTIONS,
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_ROLE,
  GENDER_OPTIONS,
} from "../model/character-options";
import {
  CHARACTERS_CATALOG_ADVANCED_EMPTY,
  countActiveAdvancedFilters,
  pickAdvancedFilters,
  toCharactersCatalogFilterParams,
} from "../model/characters-catalog-query";
import { CharactersBookFilter } from "./characters-book-filter";
import { CharactersEnumFacetFilter } from "./characters-enum-facet-filter";
import { CharactersGroupFilter } from "./characters-group-filter";
import { CharactersSeriesFilter } from "./characters-series-filter";
import { CharactersSpeciesFilter } from "./characters-species-filter";
import { CharactersSpoilerFilter } from "./characters-spoiler-filter";

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
  const facets = useCharacterFacets(toCharactersCatalogFilterParams({ ...state, ...draft }), {
    enabled: open,
  });

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
            <CharactersEnumFacetFilter
              counts={facets.data?.importance}
              countsPending={facets.isPending}
              label={t("importance")}
              labelOf={(option) => tImportance(option)}
              onChange={(importance) => patchDraft({ importance })}
              options={BOOK_CHARACTER_IMPORTANCE.options}
              value={draft.importance}
            />
          </FilterSection>

          <FilterSection title={t("role")}>
            <CharactersEnumFacetFilter
              counts={facets.data?.role}
              countsPending={facets.isPending}
              label={t("role")}
              labelOf={(option) => tRole(option)}
              onChange={(role) => patchDraft({ role })}
              options={BOOK_CHARACTER_ROLE.options}
              value={draft.role}
            />
          </FilterSection>

          <FilterSection title={t("gender")}>
            <CharactersEnumFacetFilter
              counts={facets.data?.gender}
              countsPending={facets.isPending}
              label={t("gender")}
              labelOf={(option) => tGender(option)}
              onChange={(gender) => patchDraft({ gender })}
              options={GENDER_OPTIONS}
              value={draft.gender}
            />
          </FilterSection>

          <FilterSection title={t("species")}>
            <CharactersSpeciesFilter
              counts={facets.data?.species}
              names={speciesNames}
              onChange={(speciesId) => patchDraft({ speciesId })}
              value={draft.speciesId}
            />
          </FilterSection>

          <FilterSection title={t("attitude")}>
            <CharactersEnumFacetFilter
              counts={facets.data?.attitude}
              countsPending={facets.isPending}
              label={t("attitude")}
              labelOf={(option) => tAttitude(option)}
              onChange={(attitude) => patchDraft({ attitude })}
              options={ATTITUDE_OPTIONS}
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
            <CharactersGroupFilter
              counts={facets.data?.group}
              countsPending={facets.isPending}
              onChange={(groupId) => patchDraft({ groupId })}
              value={draft.groupId}
            />
          </FilterSection>

          <FilterSection title={t("spoilers")}>
            <CharactersSpoilerFilter
              onChange={(spoilers) => patchDraft({ spoilers })}
              value={draft.spoilers}
            />
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
