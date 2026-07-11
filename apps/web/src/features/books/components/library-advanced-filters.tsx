"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { Multiselect } from "@/components/ui/multiselect";
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
import { Slider } from "@/components/ui/slider";
import { YearPicker } from "@/components/ui/year-picker";
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { bookFormats, ownershipStatuses, readingStatuses } from "@/lib/book-status";

import type { LibraryQueryState, LibraryScope } from "../model/library-query";
import type { UseLibraryQueryResult } from "../model/use-library-query";

import { useAuthorOptions } from "../api/use-author-options";
import { useGenres } from "../api/use-genres";
import { usePublishersSearch } from "../api/use-publishers-search";
import { useRecentAuthors } from "../api/use-recent-authors";
import { useRecentGenres } from "../api/use-recent-genres";
import { useRecentPublishers } from "../api/use-recent-publishers";
import {
  hasActiveLibraryFilters,
  LIBRARY_AGE_CATEGORY_VALUES,
  LIBRARY_BOOK_TYPE_VALUES,
  LIBRARY_FORMAT_VALUES,
  LIBRARY_LANGUAGE_VALUES,
  LIBRARY_STATUS_VALUES,
  libraryRangeFlags,
  scopedOwnerValues,
} from "../model/library-query";
import { LibraryEntityMultiselect } from "./library-entity-multiselect";
import { LibraryTagFilter } from "./library-tag-filter";

type LibraryFiltersDraft = Pick<
  LibraryQueryState,
  | "ageCategory"
  | "author"
  | "bookType"
  | "format"
  | "genre"
  | "hasCover"
  | "language"
  | "owner"
  | "pagesMax"
  | "pagesMin"
  | "publisher"
  | "ratingMax"
  | "ratingMin"
  | "status"
  | "tag"
  | "yearMax"
  | "yearMin"
>;

const EMPTY_FILTERS: LibraryFiltersDraft = {
  ageCategory: [],
  author: [],
  bookType: null,
  format: [],
  genre: [],
  hasCover: null,
  language: [],
  owner: [],
  pagesMax: null,
  pagesMin: null,
  publisher: [],
  ratingMax: null,
  ratingMin: null,
  status: [],
  tag: [],
  yearMax: null,
  yearMin: null,
};

type LibraryAdvancedFiltersProps = {
  activeCount: number;
  onRememberEntity: (id: string, name: string) => void;
  resolveEntityName: (id: string) => string | undefined;
  scope: LibraryScope;
  setState: UseLibraryQueryResult["setState"];
  state: LibraryQueryState;
};

export function LibraryAdvancedFilters({
  activeCount,
  onRememberEntity,
  resolveEntityName,
  scope,
  setState,
  state,
}: LibraryAdvancedFiltersProps) {
  const t = useTranslations("books.library.filters");
  const tAuthor = useTranslations("books.author");
  const tPublisher = useTranslations("books.publisher");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwner = useTranslations("books.ownershipStatus.options");
  const tFormat = useTranslations("books.format.options");
  const tAge = useTranslations("books.classification.ageCategoryLabels");
  const tLanguage = useTranslations("books.classification.languageLabels");
  const tClassification = useTranslations("books.classification");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LibraryFiltersDraft>(() => draftFromState(state));
  const genres = useGenres();
  const recentGenres = useRecentGenres();

  const genreList = genres.data ?? [];
  const genreNameByKey = new Map(genreList.map((genre) => [genre.key, genre.name]));
  const recentHeading = tClassification("genresRecentHeading");
  const recentKeys = (recentGenres.data ?? [])
    .map((genre) => genre.key)
    .filter((key) => genreNameByKey.has(key));
  const recentKeySet = new Set(recentKeys);
  const recentOptions = recentKeys.map((key) => ({
    group: recentHeading,
    label: genreNameByKey.get(key) ?? key,
    value: key,
  }));
  const catalogOptions = genreList
    .filter((genre) => !recentKeySet.has(genre.key))
    .map((genre) => ({ group: genre.groupName, label: genre.name, value: genre.key }));
  const genreOptions = [...recentOptions, ...catalogOptions];

  const ownerValues = scopedOwnerValues(scope);
  const coverValue = draft.hasCover === null ? "all" : draft.hasCover ? "with" : "without";
  const rangeFlags = libraryRangeFlags(draft);
  const maxYear = new Date().getUTCFullYear() + 1;
  const minYear = 1000;
  const ratingFloor = 0.5;
  const ratingCeil = 10;
  const ratingStep = 0.5;
  const ratingLow = draft.ratingMin ?? ratingFloor;
  const ratingHigh = draft.ratingMax ?? ratingCeil;
  const ratingIsAny = ratingLow <= ratingFloor && ratingHigh >= ratingCeil;

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(draftFromState(state));
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="secondary">
          <UiIcon name="sliders" size={16} />
          {t("trigger")}
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
          <FilterSection title={t("sections.readingStatus")}>
            <ChipGroup
              label={t("sections.readingStatus")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  status: LIBRARY_STATUS_VALUES.filter((v) => next.includes(v)),
                }))
              }
              options={LIBRARY_STATUS_VALUES.map((value) => {
                const entry = readingStatuses.find((item) => item.value === value);
                return {
                  icon: entry ? <UiIcon name={entry.icon} /> : undefined,
                  label: tStatus(value),
                  value,
                };
              })}
              size="sm"
              value={draft.status}
            />
          </FilterSection>

          <FilterSection title={t("sections.ownershipStatus")}>
            <ChipGroup
              label={t("sections.ownershipStatus")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  owner: ownerValues.filter((v) => next.includes(v)),
                }))
              }
              options={ownerValues.map((value) => {
                const entry = ownershipStatuses.find((item) => item.value === value);
                return {
                  icon: entry ? <UiIcon name={entry.icon} /> : undefined,
                  label: tOwner(value),
                  value,
                };
              })}
              size="sm"
              value={draft.owner}
            />
          </FilterSection>

          <FilterSection title={t("sections.format")}>
            <ChipGroup
              label={t("sections.format")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  format: LIBRARY_FORMAT_VALUES.filter((v) => next.includes(v)),
                }))
              }
              options={LIBRARY_FORMAT_VALUES.map((value) => {
                const entry = bookFormats.find((item) => item.value === value);
                return {
                  icon: entry ? <UiIcon name={entry.icon} /> : undefined,
                  label: tFormat(value),
                  value,
                };
              })}
              size="sm"
              value={draft.format}
            />
          </FilterSection>

          <FilterSection title={t("sections.genre")}>
            <Multiselect
              emptyText={t("genreEmpty")}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, genre: next }))}
              options={genreOptions}
              placeholder={t("genrePlaceholder")}
              searchPlaceholder={t("genreSearch")}
              value={draft.genre}
            />
          </FilterSection>

          <FilterSection title={t("sections.tag")}>
            <LibraryTagFilter
              emptyLabel={t("tagEmpty")}
              id="library-filter-tag"
              label={t("sections.tag")}
              onAdd={(tag) => {
                onRememberEntity(tag.id, tag.name);
                setDraft((prev) => ({ ...prev, tag: [...prev.tag, tag.id] }));
              }}
              onRemove={(id) =>
                setDraft((prev) => ({ ...prev, tag: prev.tag.filter((value) => value !== id) }))
              }
              placeholder={t("tagPlaceholder")}
              removeLabel={(name) => t("removeTag", { name })}
              resolveName={resolveEntityName}
              searchingLabel={t("tagSearching")}
              suggestionsHeading={tClassification("tagsSuggestions")}
              value={draft.tag}
            />
          </FilterSection>

          <FilterSection title={t("sections.ageCategory")}>
            <Multiselect
              emptyText={t("ageCategoryEmpty")}
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  ageCategory: LIBRARY_AGE_CATEGORY_VALUES.filter((v) => next.includes(v)),
                }))
              }
              options={LIBRARY_AGE_CATEGORY_VALUES.map((value) => ({
                label: tAge(value),
                value,
              }))}
              placeholder={t("ageCategoryPlaceholder")}
              searchPlaceholder={t("ageCategorySearch")}
              value={draft.ageCategory}
            />
          </FilterSection>

          <FilterSection title={t("sections.language")}>
            <Multiselect
              emptyText={t("languageEmpty")}
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  language: LIBRARY_LANGUAGE_VALUES.filter((v) => next.includes(v)),
                }))
              }
              options={LIBRARY_LANGUAGE_VALUES.map((value) => ({
                label: tLanguage(value),
                value,
              }))}
              placeholder={t("languagePlaceholder")}
              searchPlaceholder={t("languageSearch")}
              value={draft.language}
            />
          </FilterSection>

          <FilterSection title={t("sections.author")}>
            <LibraryEntityMultiselect
              allHeading={tAuthor("allHeading")}
              empty={t("authorEmpty")}
              icon="user"
              id="library-filter-author"
              onAdd={(item) => {
                onRememberEntity(item.id, item.name);
                setDraft((prev) => ({ ...prev, author: [...prev.author, item.id] }));
              }}
              onRemove={(id) =>
                setDraft((prev) => ({ ...prev, author: prev.author.filter((v) => v !== id) }))
              }
              placeholder={t("authorPlaceholder")}
              recentHeading={tAuthor("recentHeading")}
              removeLabel={(name) => t("removeAuthor", { name })}
              resolveName={resolveEntityName}
              searching={t("authorSearching")}
              useRecent={useRecentAuthors}
              useSearch={useAuthorOptions}
              value={draft.author}
            />
          </FilterSection>

          <FilterSection title={t("sections.publisher")}>
            <LibraryEntityMultiselect
              allHeading={tPublisher("allHeading")}
              empty={t("publisherEmpty")}
              icon="building"
              id="library-filter-publisher"
              onAdd={(item) => {
                onRememberEntity(item.id, item.name);
                setDraft((prev) => ({ ...prev, publisher: [...prev.publisher, item.id] }));
              }}
              onRemove={(id) =>
                setDraft((prev) => ({ ...prev, publisher: prev.publisher.filter((v) => v !== id) }))
              }
              placeholder={t("publisherPlaceholder")}
              recentHeading={tPublisher("recentHeading")}
              removeLabel={(name) => t("removePublisher", { name })}
              resolveName={resolveEntityName}
              searching={t("publisherSearching")}
              useRecent={useRecentPublishers}
              useSearch={usePublishersSearch}
              value={draft.publisher}
            />
          </FilterSection>

          <FilterSection title={t("sections.bookType")}>
            <Select
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  bookType: LIBRARY_BOOK_TYPE_VALUES.find((v) => v === next) ?? null,
                }))
              }
              value={draft.bookType ?? "all"}
            >
              <SelectTrigger
                aria-label={t("sections.bookType")}
                className="h-10 w-full"
                isClearable={draft.bookType !== null}
                onClear={() => setDraft((prev) => ({ ...prev, bookType: null }))}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("bookType.all")}</SelectItem>
                <SelectItem value="solo">{t("bookType.solo")}</SelectItem>
                <SelectItem value="series_part">{t("bookType.series_part")}</SelectItem>
              </SelectContent>
            </Select>
          </FilterSection>

          <FilterSection title={t("sections.rating")}>
            <p className="text-sm text-muted-foreground tabular-nums">
              {ratingIsAny ? t("rating.any") : `${ratingLow} – ${ratingHigh}`}
            </p>
            <Slider
              max={ratingCeil}
              min={ratingFloor}
              onValueChange={(next) => {
                const [low, high] = next as [number, number];
                setDraft((prev) => ({
                  ...prev,
                  ratingMax: high >= ratingCeil ? null : high,
                  ratingMin: low <= ratingFloor ? null : low,
                }));
              }}
              step={ratingStep}
              thumbLabels={[t("rating.minLabel"), t("rating.maxLabel")]}
              value={[ratingLow, ratingHigh]}
            />
            {rangeFlags.rating ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.year")}>
            <div className="grid grid-cols-2 gap-2.5">
              <YearPicker
                ariaLabel={t("range.yearMin")}
                clearLabel={t("yearPicker.clear")}
                id="library-filter-year-min"
                max={draft.yearMax ?? maxYear}
                min={minYear}
                nextLabel={t("yearPicker.next")}
                onChange={(y) => setDraft((prev) => ({ ...prev, yearMin: y }))}
                placeholder={t("range.min")}
                prevLabel={t("yearPicker.prev")}
                value={draft.yearMin}
              />
              <YearPicker
                ariaLabel={t("range.yearMax")}
                clearLabel={t("yearPicker.clear")}
                id="library-filter-year-max"
                max={maxYear}
                min={draft.yearMin ?? minYear}
                nextLabel={t("yearPicker.next")}
                onChange={(y) => setDraft((prev) => ({ ...prev, yearMax: y }))}
                placeholder={t("range.max")}
                prevLabel={t("yearPicker.prev")}
                value={draft.yearMax}
              />
            </div>
            {rangeFlags.year ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.pages")}>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("range.pagesMin")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, pagesMin: parseRangeValue(event.target.value) }))
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.pagesMin ?? ""}
              />
              <Input
                aria-label={t("range.pagesMax")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, pagesMax: parseRangeValue(event.target.value) }))
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.pagesMax ?? ""}
              />
            </div>
            {rangeFlags.pages ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.cover")}>
            <Select
              onValueChange={(next) =>
                setDraft((prev) => ({ ...prev, hasCover: next === "all" ? null : next === "with" }))
              }
              value={coverValue}
            >
              <SelectTrigger
                aria-label={t("sections.cover")}
                className="h-10 w-full"
                isClearable={draft.hasCover !== null}
                onClear={() => setDraft((prev) => ({ ...prev, hasCover: null }))}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cover.all")}</SelectItem>
                <SelectItem value="with">{t("cover.with")}</SelectItem>
                <SelectItem value="without">{t("cover.without")}</SelectItem>
              </SelectContent>
            </Select>
          </FilterSection>
        </div>

        <SheetFooter>
          <Button
            disabled={!hasActiveLibraryFilters({ ...state, ...draft })}
            onClick={() => setDraft(EMPTY_FILTERS)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            onClick={() => {
              void setState(toCommitPatch(draft));
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

function draftFromState(state: LibraryQueryState): LibraryFiltersDraft {
  return {
    ageCategory: state.ageCategory,
    author: state.author,
    bookType: state.bookType,
    format: state.format,
    genre: state.genre,
    hasCover: state.hasCover,
    language: state.language,
    owner: state.owner,
    pagesMax: state.pagesMax,
    pagesMin: state.pagesMin,
    publisher: state.publisher,
    ratingMax: state.ratingMax,
    ratingMin: state.ratingMin,
    status: state.status,
    tag: state.tag,
    yearMax: state.yearMax,
    yearMin: state.yearMin,
  };
}

function parseRangeValue(raw: string): null | number {
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toCommitPatch(draft: LibraryFiltersDraft) {
  return {
    ageCategory: draft.ageCategory.length === 0 ? null : draft.ageCategory,
    author: draft.author.length === 0 ? null : draft.author,
    bookType: draft.bookType,
    format: draft.format.length === 0 ? null : draft.format,
    genre: draft.genre.length === 0 ? null : draft.genre,
    hasCover: draft.hasCover,
    language: draft.language.length === 0 ? null : draft.language,
    owner: draft.owner.length === 0 ? null : draft.owner,
    pagesMax: draft.pagesMax,
    pagesMin: draft.pagesMin,
    publisher: draft.publisher.length === 0 ? null : draft.publisher,
    ratingMax: draft.ratingMax,
    ratingMin: draft.ratingMin,
    status: draft.status.length === 0 ? null : draft.status,
    tag: draft.tag.length === 0 ? null : draft.tag,
    yearMax: draft.yearMax,
    yearMin: draft.yearMin,
  };
}
