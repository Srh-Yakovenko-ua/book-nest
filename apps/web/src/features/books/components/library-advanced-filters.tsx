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
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";

import type { LibraryQueryState } from "../model/library-query";
import type { UseLibraryQueryResult } from "../model/use-library-query";

import { useAuthorSearch } from "../api/use-author-search";
import { useGenres } from "../api/use-genres";
import { usePublishersSearch } from "../api/use-publishers-search";
import {
  LIBRARY_AGE_CATEGORY_VALUES,
  LIBRARY_BOOK_TYPE_VALUES,
  LIBRARY_FORMAT_VALUES,
  LIBRARY_LANGUAGE_VALUES,
  LIBRARY_OWNER_VALUES,
  LIBRARY_STATUS_VALUES,
  libraryRangeFlags,
} from "../model/library-query";
import { LibraryFilterCombobox } from "./library-filter-combobox";
import { LibraryTagFilter } from "./library-tag-filter";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

type LibraryAdvancedFiltersProps = {
  activeCount: number;
  onClearFilters: () => void;
  onRememberEntity: (id: string, name: string) => void;
  resolveEntityName: (id: string) => string | undefined;
  setState: UseLibraryQueryResult["setState"];
  state: LibraryQueryState;
};

export function LibraryAdvancedFilters({
  activeCount,
  onClearFilters,
  onRememberEntity,
  resolveEntityName,
  setState,
  state,
}: LibraryAdvancedFiltersProps) {
  const t = useTranslations("books.library.filters");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwner = useTranslations("books.ownershipStatus.options");
  const tFormat = useTranslations("books.format.options");
  const tAge = useTranslations("books.classification.ageCategoryLabels");
  const tLanguage = useTranslations("books.classification.languageLabels");
  const [open, setOpen] = useState(false);
  const genres = useGenres();

  const genreOptions = (genres.data ?? []).map((genre) => ({
    group: genre.groupName,
    label: genre.name,
    value: genre.key,
  }));

  const selectedAuthorName =
    state.author[0] === undefined ? undefined : resolveEntityName(state.author[0]);
  const selectedPublisherName =
    state.publisher[0] === undefined ? undefined : resolveEntityName(state.publisher[0]);

  const ratingMinValue = state.ratingMin === null ? "any" : String(state.ratingMin);
  const ratingMaxValue = state.ratingMax === null ? "any" : String(state.ratingMax);
  const coverValue = state.hasCover === null ? "all" : state.hasCover ? "with" : "without";
  const rangeFlags = libraryRangeFlags(state);

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
              options={LIBRARY_STATUS_VALUES.map((value) => ({ label: tStatus(value), value }))}
              size="sm"
              value={state.status}
            />
          </FilterSection>

          <FilterSection title={t("sections.ownershipStatus")}>
            <ChipGroup
              label={t("sections.ownershipStatus")}
              mode="multi"
              onValueChange={(next) =>
                void setState({ owner: LIBRARY_OWNER_VALUES.filter((v) => next.includes(v)) })
              }
              options={LIBRARY_OWNER_VALUES.map((value) => ({ label: tOwner(value), value }))}
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
              options={LIBRARY_FORMAT_VALUES.map((value) => ({ label: tFormat(value), value }))}
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
              value={state.tag}
            />
          </FilterSection>

          <FilterSection title={t("sections.ageCategory")}>
            <ChipGroup
              label={t("sections.ageCategory")}
              mode="multi"
              onValueChange={(next) =>
                void setState({
                  ageCategory: LIBRARY_AGE_CATEGORY_VALUES.filter((v) => next.includes(v)),
                })
              }
              options={LIBRARY_AGE_CATEGORY_VALUES.map((value) => ({ label: tAge(value), value }))}
              size="sm"
              value={state.ageCategory}
            />
          </FilterSection>

          <FilterSection title={t("sections.language")}>
            <ChipGroup
              label={t("sections.language")}
              mode="multi"
              onValueChange={(next) =>
                void setState({
                  language: LIBRARY_LANGUAGE_VALUES.filter((v) => next.includes(v)),
                })
              }
              options={LIBRARY_LANGUAGE_VALUES.map((value) => ({
                label: tLanguage(value),
                value,
              }))}
              size="sm"
              value={state.language}
            />
          </FilterSection>

          <FilterSection title={t("sections.author")}>
            <LibraryFilterCombobox
              clearLabel={t("clearField")}
              customBadge={t("customBadge")}
              emptyLabel={t("authorEmpty")}
              icon="user"
              id="library-filter-author"
              label={t("sections.author")}
              onClear={() => void setState({ author: null })}
              onSelect={(item) => {
                onRememberEntity(item.id, item.name);
                void setState({ author: [item.id] });
              }}
              placeholder={t("authorPlaceholder")}
              searchingLabel={t("authorSearching")}
              selectedName={selectedAuthorName}
              useSearch={useAuthorSearch}
            />
          </FilterSection>

          <FilterSection title={t("sections.publisher")}>
            <LibraryFilterCombobox
              clearLabel={t("clearField")}
              customBadge={t("customBadge")}
              emptyLabel={t("publisherEmpty")}
              icon="building"
              id="library-filter-publisher"
              label={t("sections.publisher")}
              onClear={() => void setState({ publisher: null })}
              onSelect={(item) => {
                onRememberEntity(item.id, item.name);
                void setState({ publisher: [item.id] });
              }}
              placeholder={t("publisherPlaceholder")}
              searchingLabel={t("publisherSearching")}
              selectedName={selectedPublisherName}
              useSearch={usePublishersSearch}
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
              <Input
                aria-label={t("range.yearMin")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  void setState({ yearMin: parseRangeValue(event.target.value) })
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={state.yearMin ?? ""}
              />
              <Input
                aria-label={t("range.yearMax")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  void setState({ yearMax: parseRangeValue(event.target.value) })
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={state.yearMax ?? ""}
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
