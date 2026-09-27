"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
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
import { cn } from "@/lib/utils";

import type { PublishersAdvancedFilters as PublishersAdvancedFiltersValue } from "../model/publisher-query";

import {
  countActivePublisherAdvancedFilters,
  EMPTY_PUBLISHERS_ADVANCED_FILTERS,
  PUBLISHERS_BOOLEAN_FILTERS,
  PUBLISHERS_GEOGRAPHY_OPTIONS,
  PUBLISHERS_SOURCE_OPTIONS,
} from "../model/publisher-query";

type PublisherAdvancedFiltersProps = {
  filters: PublishersAdvancedFiltersValue;
  onApply: (next: PublishersAdvancedFiltersValue) => void;
};

export function PublisherAdvancedFilters({ filters, onApply }: PublisherAdvancedFiltersProps) {
  const t = useTranslations("publishers.advancedFilters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PublishersAdvancedFiltersValue>(filters);
  const activeCount = countActivePublisherAdvancedFilters(filters);

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
          className={cn(
            "h-10 max-sm:h-11",
            activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-11 max-sm:px-0",
          )}
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
          <FilterSection title={t("geography")}>
            <ChipGroup
              label={t("geography")}
              mode="single"
              onValueChange={(next) => {
                const geography = PUBLISHERS_GEOGRAPHY_OPTIONS.find((value) => value === next);
                if (geography !== undefined) setDraft((prev) => ({ ...prev, geography }));
              }}
              options={PUBLISHERS_GEOGRAPHY_OPTIONS.map((value) => ({
                label: t(`geographyOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft.geography}
            />
          </FilterSection>

          <FilterSection title={t("source")}>
            <ChipGroup
              label={t("source")}
              mode="single"
              onValueChange={(next) => {
                const source = PUBLISHERS_SOURCE_OPTIONS.find((value) => value === next);
                if (source !== undefined) setDraft((prev) => ({ ...prev, source }));
              }}
              options={PUBLISHERS_SOURCE_OPTIONS.map((value) => ({
                label: t(`sourceOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft.source}
            />
          </FilterSection>

          <FilterSection title={t("books")}>
            <ChipGroup
              label={t("books")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  hasQueue: next.includes("hasQueue"),
                  hasRatedBooks: next.includes("hasRatedBooks"),
                  hasWantToRead: next.includes("hasWantToRead"),
                }))
              }
              options={PUBLISHERS_BOOLEAN_FILTERS.map((key) => ({
                label: t(`booleans.${key}`),
                value: key,
              }))}
              size="sm"
              value={PUBLISHERS_BOOLEAN_FILTERS.filter((key) => draft[key])}
            />
          </FilterSection>
        </div>

        <SheetFooter>
          <Button
            disabled={countActivePublisherAdvancedFilters(draft) === 0}
            onClick={() => setDraft(EMPTY_PUBLISHERS_ADVANCED_FILTERS)}
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
