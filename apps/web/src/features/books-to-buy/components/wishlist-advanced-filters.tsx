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

import type {
  WishlistFilterOption,
  WishlistFilterOptions,
  WishlistFilters,
} from "../model/books-to-buy-derive";

import { WISHLIST_FILTERS_DEFAULT, WISHLIST_LINK_FILTERS } from "../model/books-to-buy-derive";

const ANY_VALUE = "__any__";

export function WishlistAdvancedFilters({
  filters,
  onApply,
  options,
}: {
  filters: WishlistFilters;
  onApply: (filters: WishlistFilters) => void;
  options: WishlistFilterOptions;
}) {
  const t = useTranslations("booksToBuy");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const activeCount = [
    filters.link !== "all",
    filters.storeName,
    filters.publisherId,
    filters.genreKey,
    filters.tagId,
  ].filter(Boolean).length;

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(filters);
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button className="h-10 max-sm:w-10 max-sm:px-0" type="button" variant="secondary">
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("filters.trigger")}</span>
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("filters.title")}</SheetTitle>
          <SheetDescription>{t("filters.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("toolbar.linkFilterLabel")}>
            <ChipGroup
              label={t("toolbar.linkFilterLabel")}
              mode="single"
              onValueChange={(value) => {
                const link = WISHLIST_LINK_FILTERS.find((item) => item === value);
                if (link) setDraft((current) => ({ ...current, link }));
              }}
              options={WISHLIST_LINK_FILTERS.map((value) => ({
                label: t(`linkFilter.${value}`),
                value,
              }))}
              size="sm"
              value={draft.link}
            />
          </FilterSection>
          <ValueSelect
            anyLabel={t("toolbar.storeAny")}
            label={t("toolbar.storeLabel")}
            onChange={(storeName) => setDraft((current) => ({ ...current, storeName }))}
            options={options.stores}
            value={draft.storeName}
          />
          <ValueSelect
            anyLabel={t("toolbar.publisherAny")}
            label={t("toolbar.publisherLabel")}
            onChange={(publisherId) => setDraft((current) => ({ ...current, publisherId }))}
            options={options.publishers}
            value={draft.publisherId}
          />
          <ValueSelect
            anyLabel={t("toolbar.genreAny")}
            label={t("toolbar.genreLabel")}
            onChange={(genreKey) => setDraft((current) => ({ ...current, genreKey }))}
            options={options.genres}
            value={draft.genreKey}
          />
          <ValueSelect
            anyLabel={t("toolbar.tagAny")}
            label={t("toolbar.tagLabel")}
            onChange={(tagId) => setDraft((current) => ({ ...current, tagId }))}
            options={options.tags}
            value={draft.tagId}
          />
        </div>
        <SheetFooter className="border-t">
          <Button
            onClick={() => setDraft({ ...WISHLIST_FILTERS_DEFAULT, search: filters.search })}
            type="button"
            variant="ghost"
          >
            {t("filters.clear")}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            type="button"
          >
            {t("filters.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ValueSelect({
  anyLabel,
  label,
  onChange,
  options,
  value,
}: {
  anyLabel: string;
  label: string;
  onChange: (value: null | string) => void;
  options: WishlistFilterOption[];
  value: null | string;
}) {
  return (
    <FilterSection title={label}>
      <Select
        onValueChange={(next) => onChange(next === ANY_VALUE ? null : next)}
        value={value ?? ANY_VALUE}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={anyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_VALUE}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterSection>
  );
}
