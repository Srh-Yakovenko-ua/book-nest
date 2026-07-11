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

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

type LibraryAdvancedFiltersProps = {
  activeCount: number;
  onClearFilters: () => void;
  onRememberEntity: (id: string, name: string) => void;
  resolveEntityName: (id: string) => string | undefined;
  scope: LibraryScope;
  setState: UseLibraryQueryResult["setState"];
  state: LibraryQueryState;
};

export function LibraryAdvancedFilters({
  activeCount,
  onClearFilters,
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
  const ratingMinValue = state.ratingMin === null ? "any" : String(state.ratingMin);
  const ratingMaxValue = state.ratingMax === null ? "any" : String(state.ratingMax);
  const coverValue = state.hasCover === null ? "all" : state.hasCover ? "with" : "without";
  const rangeFlags = libraryRangeFlags(state);
  const maxYear = new Date().getUTCFullYear() + 1;
  const minYear = 1000;

  return (
    <Sheet onOpenChange={setOpen} open={open}>
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
                void setState({ status: LIBRARY_STATUS_VALUES.filter((v) => next.includes(v)) })
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
              value={state.status}
            />
          </FilterSection>

          <FilterSection title={t("sections.ownershipStatus")}>
            <ChipGroup
              label={t("sections.ownershipStatus")}
              mode="multi"
              onValueChange={(next) =>
                void setState({ owner: ownerValues.filter((v) => next.includes(v)) })
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
              value={state.owner}
            />
          </FilterSection>

          <FilterSection title={t("sections.format")}>
            <ChipGroup
              label={t("sections.format")}
              mode="multi"
              onValueChange={(next) =>
                void setState({ format: LIBRARY_FORMAT_VALUES.filter((v) => next.includes(v)) })
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
              value={state.format}
            />
          </FilterSection>

          <FilterSection title={t("sections.genre")}>
            <Multiselect
              emptyText={t("genreEmpty")}
              onValueChange={(next) => void setState({ genre: next })}
              options={genreOptions}
              placeholder={t("genrePlaceholder")}
              searchPlaceholder={t("genreSearch")}
              value={state.genre}
            />
          </FilterSection>

          <FilterSection title={t("sections.tag")}>
            <LibraryTagFilter
              emptyLabel={t("tagEmpty")}
              id="library-filter-tag"
              label={t("sections.tag")}
              onAdd={(tag) => {
                onRememberEntity(tag.id, tag.name);
                void setState({ tag: [...state.tag, tag.id] });
              }}
              onRemove={(id) => void setState({ tag: state.tag.filter((value) => value !== id) })}
              placeholder={t("tagPlaceholder")}
              removeLabel={(name) => t("removeTag", { name })}
              resolveName={resolveEntityName}
              searchingLabel={t("tagSearching")}
              suggestionsHeading={tClassification("tagsSuggestions")}
              value={state.tag}
            />
          </FilterSection>

          <FilterSection title={t("sections.ageCategory")}>
            <Multiselect
              emptyText={t("ageCategoryEmpty")}
              onValueChange={(next) =>
                void setState({
                  ageCategory: LIBRARY_AGE_CATEGORY_VALUES.filter((v) => next.includes(v)),
                })
              }
              options={LIBRARY_AGE_CATEGORY_VALUES.map((value) => ({
                label: tAge(value),
                value,
              }))}
              placeholder={t("ageCategoryPlaceholder")}
              searchPlaceholder={t("ageCategorySearch")}
              value={state.ageCategory}
            />
          </FilterSection>

          <FilterSection title={t("sections.language")}>
            <Multiselect
              emptyText={t("languageEmpty")}
              onValueChange={(next) =>
                void setState({
                  language: LIBRARY_LANGUAGE_VALUES.filter((v) => next.includes(v)),
                })
              }
              options={LIBRARY_LANGUAGE_VALUES.map((value) => ({
                label: tLanguage(value),
                value,
              }))}
              placeholder={t("languagePlaceholder")}
              searchPlaceholder={t("languageSearch")}
              value={state.language}
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
                void setState({ author: [...state.author, item.id] });
              }}
              onRemove={(id) => void setState({ author: state.author.filter((v) => v !== id) })}
              placeholder={t("authorPlaceholder")}
              recentHeading={tAuthor("recentHeading")}
              removeLabel={(name) => t("removeAuthor", { name })}
              resolveName={resolveEntityName}
              searching={t("authorSearching")}
              useRecent={useRecentAuthors}
              useSearch={useAuthorOptions}
              value={state.author}
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
                void setState({ publisher: [...state.publisher, item.id] });
              }}
              onRemove={(id) =>
                void setState({ publisher: state.publisher.filter((v) => v !== id) })
              }
              placeholder={t("publisherPlaceholder")}
              recentHeading={tPublisher("recentHeading")}
              removeLabel={(name) => t("removePublisher", { name })}
              resolveName={resolveEntityName}
              searching={t("publisherSearching")}
              useRecent={useRecentPublishers}
              useSearch={usePublishersSearch}
              value={state.publisher}
            />
          </FilterSection>

          <FilterSection title={t("sections.bookType")}>
            <Select
              onValueChange={(next) =>
                void setState({
                  bookType: LIBRARY_BOOK_TYPE_VALUES.find((v) => v === next) ?? null,
                })
              }
              value={state.bookType ?? "all"}
            >
              <SelectTrigger
                aria-label={t("sections.bookType")}
                className="h-10 w-full"
                isClearable={state.bookType !== null}
                onClear={() => void setState({ bookType: null })}
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
            <div className="grid grid-cols-2 gap-2.5">
              <Select
                onValueChange={(next) =>
                  void setState({ ratingMin: next === "any" ? null : Number(next) })
                }
                value={ratingMinValue}
              >
                <SelectTrigger
                  aria-label={t("rating.min")}
                  className="h-10 w-full"
                  isClearable={state.ratingMin !== null}
                  onClear={() => void setState({ ratingMin: null })}
                >
                  <SelectValue placeholder={t("rating.min")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("rating.any")}</SelectItem>
                  {RATING_VALUES.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {t("rating.from", { value })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(next) =>
                  void setState({ ratingMax: next === "any" ? null : Number(next) })
                }
                value={ratingMaxValue}
              >
                <SelectTrigger
                  aria-label={t("rating.max")}
                  className="h-10 w-full"
                  isClearable={state.ratingMax !== null}
                  onClear={() => void setState({ ratingMax: null })}
                >
                  <SelectValue placeholder={t("rating.max")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("rating.any")}</SelectItem>
                  {RATING_VALUES.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {t("rating.to", { value })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                max={state.yearMax ?? maxYear}
                min={minYear}
                nextLabel={t("yearPicker.next")}
                onChange={(y) => void setState({ yearMin: y })}
                placeholder={t("range.min")}
                prevLabel={t("yearPicker.prev")}
                value={state.yearMin}
              />
              <YearPicker
                ariaLabel={t("range.yearMax")}
                clearLabel={t("yearPicker.clear")}
                id="library-filter-year-max"
                max={maxYear}
                min={state.yearMin ?? minYear}
                nextLabel={t("yearPicker.next")}
                onChange={(y) => void setState({ yearMax: y })}
                placeholder={t("range.max")}
                prevLabel={t("yearPicker.prev")}
                value={state.yearMax}
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
                  void setState({ pagesMin: parseRangeValue(event.target.value) })
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={state.pagesMin ?? ""}
              />
              <Input
                aria-label={t("range.pagesMax")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  void setState({ pagesMax: parseRangeValue(event.target.value) })
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={state.pagesMax ?? ""}
              />
            </div>
            {rangeFlags.pages ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.cover")}>
            <Select
              onValueChange={(next) =>
                void setState({ hasCover: next === "all" ? null : next === "with" })
              }
              value={coverValue}
            >
              <SelectTrigger
                aria-label={t("sections.cover")}
                className="h-10 w-full"
                isClearable={state.hasCover !== null}
                onClear={() => void setState({ hasCover: null })}
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
            disabled={activeCount === 0}
            onClick={onClearFilters}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button onClick={() => setOpen(false)} type="button">
            {t("done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function parseRangeValue(raw: string): null | number {
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
