"use client";

import type { GenreGroupFacet, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { GenresAdvancedFilters as GenresAdvancedFiltersValue } from "../model/genres-query";

import { GENRES_QUERY, hasInvertedBooksRange } from "../model/genres-query";

const RATING_FORMAT = {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
} as const satisfies Intl.NumberFormatOptions;

type GenresAdvancedFiltersProps = {
  activeCount: number;
  groups: GenreGroupFacet[] | undefined;
  onApply: (filters: GenresAdvancedFiltersValue) => void;
  value: GenresAdvancedFiltersValue;
};

export function GenresAdvancedFilters({
  activeCount,
  groups,
  onApply,
  value,
}: GenresAdvancedFiltersProps) {
  const t = useTranslations("genres.advancedFilters");
  const locale = useLocale();
  const booksFieldId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GenresAdvancedFiltersValue>(value);

  const { rating } = GENRES_QUERY;
  const ratingLow = draft.ratingMin ?? rating.min;
  const ratingHigh = draft.ratingMax ?? rating.max;
  const ratingIsAny = ratingLow <= rating.min && ratingHigh >= rating.max;
  const booksInverted = hasInvertedBooksRange(draft);
  const booksField = {
    error: `${booksFieldId}-error`,
    max: `${booksFieldId}-max`,
    min: `${booksFieldId}-min`,
  };
  const booksErrorRef = booksInverted ? booksField.error : undefined;

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(value);
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
            <>
              <Badge aria-hidden className="ml-0.5" variant="secondary">
                {activeCount}
              </Badge>
              <span className="sr-only">{t("activeCount", { count: activeCount })}</span>
            </>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("sections.groups")}>
            <ChipGroup
              label={t("sections.groups")}
              mode="multi"
              onValueChange={(group) => setDraft((prev) => ({ ...prev, group }))}
              options={(groups ?? []).map((group) => ({ label: group.label, value: group.key }))}
              size="sm"
              value={draft.group}
            />
          </FilterSection>

          <fieldset className="flex min-w-0 flex-col gap-2" data-slot="filter-section">
            <legend className="mb-2 text-[0.8125rem] font-semibold text-ink">
              {t("sections.books")}
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={booksField.min}>
                  {t("books.min")}
                </Label>
                <Input
                  aria-describedby={booksErrorRef}
                  aria-invalid={booksInverted}
                  id={booksField.min}
                  inputMode="numeric"
                  min={0}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, booksMin: parseBooksBound(event.target.value) }))
                  }
                  onKeyDown={blockNegativeNumberKeys}
                  type="number"
                  value={draft.booksMin ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={booksField.max}>
                  {t("books.max")}
                </Label>
                <Input
                  aria-describedby={booksErrorRef}
                  aria-invalid={booksInverted}
                  id={booksField.max}
                  inputMode="numeric"
                  min={0}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, booksMax: parseBooksBound(event.target.value) }))
                  }
                  onKeyDown={blockNegativeNumberKeys}
                  type="number"
                  value={draft.booksMax ?? ""}
                />
              </div>
            </div>
            {booksInverted ? (
              <p className="text-xs text-destructive" id={booksField.error} role="alert">
                {t("invalidRange")}
              </p>
            ) : null}
          </fieldset>

          <FilterSection title={t("sections.rating")}>
            <p className="text-sm text-muted-foreground tabular-nums">
              {ratingIsAny
                ? t("rating.any")
                : `${formatNumber(ratingLow, locale, RATING_FORMAT)} – ${formatNumber(ratingHigh, locale, RATING_FORMAT)}`}
            </p>
            <Slider
              max={rating.max}
              min={rating.min}
              onValueChange={([low, high]) =>
                setDraft((prev) => ({
                  ...prev,
                  ratingMax: high === undefined || high >= rating.max ? null : high,
                  ratingMin: low === undefined || low <= rating.min ? null : low,
                }))
              }
              step={rating.step}
              thumbLabels={[t("rating.minLabel"), t("rating.maxLabel")]}
              value={[ratingLow, ratingHigh]}
            />
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => setDraft(GENRES_QUERY.emptyAdvanced)}
            type="button"
            variant="ghost"
          >
            {t("reset")}
          </Button>
          <Button
            disabled={booksInverted}
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

function parseBooksBound(raw: string): Nullable<number> {
  const parsed = GENRES_QUERY.booksBoundSchema.safeParse(raw === "" ? undefined : raw);
  return parsed.success ? parsed.data : null;
}
