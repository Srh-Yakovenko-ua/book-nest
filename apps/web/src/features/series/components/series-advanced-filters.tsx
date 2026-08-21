"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FacetMultiselect, type FacetOption } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
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
import { useBookFacets } from "@/features/books";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import type { SeriesAdvancedFilters as SeriesAdvancedFiltersValue } from "../model/series-derive";

import {
  countActiveSeriesFilters,
  EMPTY_SERIES_ADVANCED_FILTERS,
  SERIES_COMPLETENESS_VALUES,
} from "../model/series-derive";

type SeriesAdvancedFiltersProps = {
  filters: SeriesAdvancedFiltersValue;
  onApply: (next: SeriesAdvancedFiltersValue) => void;
  onRememberAuthor: (id: string, name: string) => void;
  resolveAuthorName: (id: string) => string | undefined;
};

const PROGRESS_RANGE = { ceil: 100, floor: 0, step: 5 } as const;

const FACET_SEARCH_DEBOUNCE_MS = 250;

export function SeriesAdvancedFilters({
  filters,
  onApply,
  onRememberAuthor,
  resolveAuthorName: _resolveAuthorName,
}: SeriesAdvancedFiltersProps) {
  const t = useTranslations("series.filters");
  const tCompleteness = useTranslations("series.filters.completeness");
  const [authorTerm, setAuthorTerm] = useState("");
  const debouncedAuthorTerm = useDebouncedValue(authorTerm, FACET_SEARCH_DEBOUNCE_MS);
  const facets = useBookFacets("series", debouncedAuthorTerm);
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
  const [draft, setDraft] = useState<SeriesAdvancedFiltersValue>(filters);

  const progressLow = draft.progressMin ?? PROGRESS_RANGE.floor;
  const progressHigh = draft.progressMax ?? PROGRESS_RANGE.ceil;
  const progressIsAny = progressLow <= PROGRESS_RANGE.floor && progressHigh >= PROGRESS_RANGE.ceil;
  const booksRangeInvalid =
    draft.booksMin !== null && draft.booksMax !== null && draft.booksMin > draft.booksMax;
  const activeCount = countActiveSeriesFilters(filters);

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(filters);
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
          <FilterSection title={t("sections.progress")}>
            <p className="text-sm text-muted-foreground tabular-nums">
              {progressIsAny
                ? t("progressAny")
                : t("progressRange", { max: progressHigh, min: progressLow })}
            </p>
            <Slider
              max={PROGRESS_RANGE.ceil}
              min={PROGRESS_RANGE.floor}
              onValueChange={(next) => {
                const [low, high] = next as [number, number];
                setDraft((prev) => ({
                  ...prev,
                  progressMax: high >= PROGRESS_RANGE.ceil ? null : high,
                  progressMin: low <= PROGRESS_RANGE.floor ? null : low,
                }));
              }}
              step={PROGRESS_RANGE.step}
              value={[progressLow, progressHigh]}
            />
          </FilterSection>

          <FilterSection title={t("sections.booksCount")}>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("range.booksMin")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, booksMin: parseCountValue(event.target.value) }))
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.booksMin ?? ""}
              />
              <Input
                aria-label={t("range.booksMax")}
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, booksMax: parseCountValue(event.target.value) }))
                }
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.booksMax ?? ""}
              />
            </div>
            {booksRangeInvalid ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.completeness")}>
            <p className="text-sm text-muted-foreground">{t("completenessHint")}</p>
            <ChipGroup
              label={t("sections.completeness")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  completeness: SERIES_COMPLETENESS_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={SERIES_COMPLETENESS_VALUES.map((value) => ({
                label: tCompleteness(value),
                value,
              }))}
              size="sm"
              value={draft.completeness}
            />
          </FilterSection>

          <FilterSection title={t("sections.genre")}>
            <FacetMultiselect
              emptyText={t("genreEmpty")}
              label={t("sections.genre")}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, genres: next }))}
              options={genreFacetOptions}
              placeholder={t("genrePlaceholder")}
              searchPlaceholder={t("genreSearch")}
              selectedText={(count) => t("genreSelected", { count })}
              value={draft.genres}
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
                  onRemember: onRememberAuthor,
                  options: authorFacetOptions,
                });
                setDraft((prev) => ({ ...prev, authorIds: next }));
              }}
              options={authorFacetOptions}
              placeholder={t("authorPlaceholder")}
              searchPlaceholder={t("authorPlaceholder")}
              selectedText={(count) => t("authorSelected", { count })}
              value={draft.authorIds}
            />
          </FilterSection>
        </div>

        <SheetFooter>
          <Button
            disabled={countActiveSeriesFilters(draft) === 0}
            onClick={() => setDraft(EMPTY_SERIES_ADVANCED_FILTERS)}
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

function parseCountValue(raw: string): null | number {
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
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
