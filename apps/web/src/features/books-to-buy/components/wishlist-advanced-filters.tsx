"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FacetMultiselect, type FacetOption } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  BookFormatFilter,
  LibraryEntityMultiselect,
  LibraryTagFilter,
  useBookFacets,
  usePublishersSearch,
  useRecentPublishers,
} from "@/features/books";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import type { WishlistFilterOption } from "../model/books-to-buy-derive";
import type { UseWishlistQueryResult } from "../model/use-wishlist-query";
import type { WishlistQueryState } from "../model/wishlist-query";

import {
  countActiveWishlistFilters,
  WISHLIST_AGE_VALUES,
  WISHLIST_BOOK_TYPE_VALUES,
  WISHLIST_CURRENCY_VALUES,
  WISHLIST_FORMAT_VALUES,
  WISHLIST_LANGUAGE_VALUES,
  WISHLIST_LINK_VALUES,
  WISHLIST_SERIES_PLACEMENT_VALUES,
  wishlistRangeFlags,
} from "../model/wishlist-query";

const ANY_VALUE = "__any__";
const YEAR_FLOOR = 1000;

type WishlistFiltersDraft = Omit<WishlistQueryState, "q" | "sort" | "view">;

const EMPTY_FILTERS: WishlistFiltersDraft = {
  age: [],
  author: [],
  bookType: null,
  currency: [],
  format: [],
  genre: [],
  hasCover: null,
  isFavorite: null,
  language: [],
  link: null,
  pagesMax: null,
  pagesMin: null,
  priceMax: null,
  priceMin: null,
  publisher: [],
  seriesPlacement: [],
  store: [],
  tag: [],
  yearMax: null,
  yearMin: null,
};

type WishlistAdvancedFiltersProps = {
  activeCount: number;
  onRememberEntity: (id: string, name: string) => void;
  resolveEntityName: (id: string) => string | undefined;
  setState: UseWishlistQueryResult["setState"];
  state: WishlistQueryState;
  storeOptions: WishlistFilterOption[];
};

const FACET_SEARCH_DEBOUNCE_MS = 250;

export function WishlistAdvancedFilters({
  activeCount,
  onRememberEntity,
  resolveEntityName,
  setState,
  state,
  storeOptions,
}: WishlistAdvancedFiltersProps) {
  const t = useTranslations("booksToBuy.filters");
  const tLink = useTranslations("booksToBuy.linkFilter");
  const tPublisher = useTranslations("books.publisher");
  const tLanguage = useTranslations("books.classification.languageLabels");
  const tClassification = useTranslations("books.classification");
  const [authorTerm, setAuthorTerm] = useState("");
  const debouncedAuthorTerm = useDebouncedValue(authorTerm, FACET_SEARCH_DEBOUNCE_MS);
  const facets = useBookFacets("wishlist", debouncedAuthorTerm);
  const authorFacetOptions = (facets.data?.authors ?? []).map((author) => ({
    count: author.count,
    label: author.name,
    value: author.id,
  }));
  const genreFacetOptions = (facets.data?.genres ?? []).map((genre) => ({
    count: genre.count,
    label: genre.name,
    value: genre.key,
  }));
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState<WishlistFiltersDraft>(() => draftFromState(state));

  const rangeFlags = wishlistRangeFlags(draft);
  const hasInvalidRange = rangeFlags.pages || rangeFlags.price || rangeFlags.year;
  const priceIsDisabled = draft.currency.length !== 1;
  const priceHint = resolvePriceHint(draft.currency);
  const maxYear = new Date().getUTCFullYear() + 1;
  const coverValue = draft.hasCover === null ? ANY_VALUE : draft.hasCover ? "with" : "without";
  const favoriteValue = draft.isFavorite === null ? ANY_VALUE : draft.isFavorite ? "yes" : "no";
  const moreCount = countActiveWishlistFilters({
    ...EMPTY_FILTERS,
    ...pickRareFilters(draft),
    q: "",
    sort: state.sort,
    view: state.view,
  });

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(draftFromState(state));
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
          <FilterSection title={t("sections.link")}>
            <ChipGroup
              label={t("sections.link")}
              mode="single"
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  link: WISHLIST_LINK_VALUES.find((item) => item === value) ?? null,
                }))
              }
              options={[
                { label: t("linkAny"), value: ANY_VALUE },
                ...WISHLIST_LINK_VALUES.map((value) => ({ label: tLink(value), value })),
              ]}
              size="sm"
              value={draft.link ?? ANY_VALUE}
            />
          </FilterSection>

          <FilterSection title={t("sections.price")}>
            <ChipGroup
              label={t("currencyLabel")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  currency: WISHLIST_CURRENCY_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={WISHLIST_CURRENCY_VALUES.map((value) => ({ label: value, value }))}
              size="sm"
              value={draft.currency}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("range.priceMin")}
                disabled={priceIsDisabled}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, priceMin: parseRangeValue(event.target.value) }))
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.priceMin ?? ""}
              />
              <Input
                aria-label={t("range.priceMax")}
                disabled={priceIsDisabled}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, priceMax: parseRangeValue(event.target.value) }))
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.priceMax ?? ""}
              />
            </div>
            {priceHint === null ? null : (
              <p className="text-xs text-muted-foreground">{t(priceHint)}</p>
            )}
            {rangeFlags.price ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.store")}>
            <Multiselect
              emptyText={t("storeEmpty")}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, store: next }))}
              options={storeOptions}
              placeholder={t("storePlaceholder")}
              searchPlaceholder={t("storeSearch")}
              value={draft.store}
            />
          </FilterSection>

          <FilterSection title={t("sections.age")}>
            <ChipGroup
              label={t("sections.age")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  age: WISHLIST_AGE_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={WISHLIST_AGE_VALUES.map((value) => ({ label: t(`age.${value}`), value }))}
              size="sm"
              value={draft.age}
            />
          </FilterSection>

          <FilterSection title={t("sections.seriesPlacement")}>
            <ChipGroup
              label={t("sections.seriesPlacement")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  seriesPlacement: WISHLIST_SERIES_PLACEMENT_VALUES.filter((value) =>
                    next.includes(value),
                  ),
                }))
              }
              options={WISHLIST_SERIES_PLACEMENT_VALUES.map((value) => ({
                label: t(`seriesPlacement.${value}`),
                value,
              }))}
              size="sm"
              value={draft.seriesPlacement}
            />
          </FilterSection>

          <FilterSection title={t("sections.genre")}>
            <FacetMultiselect
              emptyText={t("genreEmpty")}
              label={t("sections.genre")}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, genre: next }))}
              options={genreFacetOptions}
              placeholder={t("genrePlaceholder")}
              searchPlaceholder={t("genreSearch")}
              selectedText={(count) => t("genreSelected", { count })}
              value={draft.genre}
            />
          </FilterSection>

          <FilterSection title={t("sections.tag")}>
            <LibraryTagFilter
              emptyLabel={t("tagEmpty")}
              id="wishlist-filter-tag"
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

          <FilterSection title={t("sections.author")}>
            <FacetMultiselect
              emptyText={t("authorEmpty")}
              isSearching={facets.isFetching}
              label={t("sections.author")}
              onSearchChange={setAuthorTerm}
              onValueChange={(next) => {
                rememberFacetNames({
                  ids: next,
                  onRemember: onRememberEntity,
                  options: authorFacetOptions,
                });
                setDraft((prev) => ({ ...prev, author: next }));
              }}
              options={authorFacetOptions}
              placeholder={t("authorPlaceholder")}
              searchingText={t("authorSearching")}
              searchPlaceholder={t("authorPlaceholder")}
              selectedText={(count) => t("authorSelected", { count })}
              value={draft.author}
            />
          </FilterSection>

          <FilterSection title={t("sections.publisher")}>
            <LibraryEntityMultiselect
              allHeading={tPublisher("allHeading")}
              empty={t("publisherEmpty")}
              icon="building"
              id="wishlist-filter-publisher"
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

          <BookFormatFilter
            onValueChange={(format) => setDraft((prev) => ({ ...prev, format }))}
            options={WISHLIST_FORMAT_VALUES}
            value={draft.format}
          />

          <FilterSection title={t("sections.language")}>
            <Multiselect
              emptyText={t("languageEmpty")}
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  language: WISHLIST_LANGUAGE_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={WISHLIST_LANGUAGE_VALUES.map((value) => ({
                label: tLanguage(value),
                value,
              }))}
              placeholder={t("languagePlaceholder")}
              searchPlaceholder={t("languageSearch")}
              value={draft.language}
            />
          </FilterSection>

          <Collapsible onOpenChange={setMoreOpen} open={moreOpen}>
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-3 py-2.5 text-[0.8125rem] font-semibold text-ink transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex items-center gap-2">
                {t("more")}
                {moreCount > 0 ? <Badge variant="secondary">{moreCount}</Badge> : null}
              </span>
              <UiIcon
                className={cn("transition-transform", moreOpen && "rotate-180")}
                name="chevron-down"
                size={16}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-5 pt-5">
              <FilterSection title={t("sections.bookType")}>
                <Select
                  onValueChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      bookType: WISHLIST_BOOK_TYPE_VALUES.find((value) => value === next) ?? null,
                    }))
                  }
                  value={draft.bookType ?? ANY_VALUE}
                >
                  <SelectTrigger
                    aria-label={t("sections.bookType")}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>{t("bookType.all")}</SelectItem>
                    {WISHLIST_BOOK_TYPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`bookType.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title={t("sections.year")}>
                <div className="grid grid-cols-2 gap-2.5">
                  <YearPicker
                    ariaLabel={t("range.yearMin")}
                    clearLabel={t("yearPicker.clear")}
                    id="wishlist-filter-year-min"
                    max={draft.yearMax ?? maxYear}
                    min={YEAR_FLOOR}
                    nextLabel={t("yearPicker.next")}
                    onChange={(year) => setDraft((prev) => ({ ...prev, yearMin: year }))}
                    placeholder={t("range.min")}
                    prevLabel={t("yearPicker.prev")}
                    value={draft.yearMin}
                  />
                  <YearPicker
                    ariaLabel={t("range.yearMax")}
                    clearLabel={t("yearPicker.clear")}
                    id="wishlist-filter-year-max"
                    max={maxYear}
                    min={draft.yearMin ?? YEAR_FLOOR}
                    nextLabel={t("yearPicker.next")}
                    onChange={(year) => setDraft((prev) => ({ ...prev, yearMax: year }))}
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
                      setDraft((prev) => ({
                        ...prev,
                        pagesMin: parseRangeValue(event.target.value),
                      }))
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
                      setDraft((prev) => ({
                        ...prev,
                        pagesMax: parseRangeValue(event.target.value),
                      }))
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
                    setDraft((prev) => ({
                      ...prev,
                      hasCover: next === ANY_VALUE ? null : next === "with",
                    }))
                  }
                  value={coverValue}
                >
                  <SelectTrigger
                    aria-label={t("sections.cover")}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>{t("cover.all")}</SelectItem>
                    <SelectItem value="with">{t("cover.with")}</SelectItem>
                    <SelectItem value="without">{t("cover.without")}</SelectItem>
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title={t("sections.favorite")}>
                <Select
                  onValueChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      isFavorite: next === ANY_VALUE ? null : next === "yes",
                    }))
                  }
                  value={favoriteValue}
                >
                  <SelectTrigger
                    aria-label={t("sections.favorite")}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>{t("favorite.all")}</SelectItem>
                    <SelectItem value="yes">{t("favorite.only")}</SelectItem>
                    <SelectItem value="no">{t("favorite.without")}</SelectItem>
                  </SelectContent>
                </Select>
              </FilterSection>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <SheetFooter className="border-t">
          <Button onClick={() => setDraft(EMPTY_FILTERS)} type="button" variant="ghost">
            {t("clear")}
          </Button>
          <Button
            disabled={hasInvalidRange}
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

function draftFromState(state: WishlistQueryState): WishlistFiltersDraft {
  return {
    age: state.age,
    author: state.author,
    bookType: state.bookType,
    currency: state.currency,
    format: state.format,
    genre: state.genre,
    hasCover: state.hasCover,
    isFavorite: state.isFavorite,
    language: state.language,
    link: state.link,
    pagesMax: state.pagesMax,
    pagesMin: state.pagesMin,
    priceMax: state.priceMax,
    priceMin: state.priceMin,
    publisher: state.publisher,
    seriesPlacement: state.seriesPlacement,
    store: state.store,
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

function pickRareFilters(draft: WishlistFiltersDraft): Partial<WishlistFiltersDraft> {
  return {
    bookType: draft.bookType,
    hasCover: draft.hasCover,
    isFavorite: draft.isFavorite,
    pagesMax: draft.pagesMax,
    pagesMin: draft.pagesMin,
    yearMax: draft.yearMax,
    yearMin: draft.yearMin,
  };
}

function rememberFacetNames({
  ids,
  onRemember,
  options,
}: {
  ids: string[];
  onRemember: (id: string, name: string) => void;
  options: FacetOption[];
}): void {
  for (const id of ids) {
    const option = options.find((entry) => entry.value === id);
    if (option !== undefined) onRemember(id, option.label);
  }
}

function resolvePriceHint(currency: string[]): Nullable<"priceOneCurrency" | "pricePickCurrency"> {
  if (currency.length === 0) return "pricePickCurrency";
  if (currency.length > 1) return "priceOneCurrency";
  return null;
}

function toCommitPatch(draft: WishlistFiltersDraft) {
  return {
    age: draft.age.length === 0 ? null : draft.age,
    author: draft.author.length === 0 ? null : draft.author,
    bookType: draft.bookType,
    currency: draft.currency.length === 0 ? null : draft.currency,
    format: draft.format.length === 0 ? null : draft.format,
    genre: draft.genre.length === 0 ? null : draft.genre,
    hasCover: draft.hasCover,
    isFavorite: draft.isFavorite,
    language: draft.language.length === 0 ? null : draft.language,
    link: draft.link,
    pagesMax: draft.pagesMax,
    pagesMin: draft.pagesMin,
    priceMax: draft.priceMax,
    priceMin: draft.priceMin,
    publisher: draft.publisher.length === 0 ? null : draft.publisher,
    seriesPlacement: draft.seriesPlacement.length === 0 ? null : draft.seriesPlacement,
    store: draft.store.length === 0 ? null : draft.store,
    tag: draft.tag.length === 0 ? null : draft.tag,
    yearMax: draft.yearMax,
    yearMin: draft.yearMin,
  };
}
