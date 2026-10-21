"use client";

import type {
  CatalogRelationshipType,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";
import type { Ref } from "react";

import {
  isCatalogRelationshipType,
  RELATIONSHIP_CATEGORY_TYPES,
  RelationshipCategorySchema,
} from "@app/shared";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

import { useRelationshipLabels } from "../model/use-relationship-labels";
import { pressButtonOnEnter } from "./relationship-command-keys";

type CategoryFilter = StandardCategory | typeof TYPE_SEARCH.allCategories;

type RelationshipTypeSearchPickerProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  onBlur: () => void;
  onCustomTypeStart: () => void;
  onTypeChange: (type: CatalogRelationshipType) => void;
  ref?: Ref<HTMLButtonElement>;
  value: Nullable<RelationshipType>;
};

type StandardCategory = Exclude<RelationshipCategory, "custom">;

type TypeEntry = {
  category: StandardCategory;
  type: CatalogRelationshipType;
};

type TypeGroup = {
  category: StandardCategory;
  types: CatalogRelationshipType[];
};

const STANDARD_CATEGORIES = RelationshipCategorySchema.options.filter(isStandardCategory);

const TYPE_SEARCH = {
  allCategories: "all",
  entries: STANDARD_CATEGORIES.flatMap((category) =>
    RELATIONSHIP_CATEGORY_TYPES[category]
      .filter(isCatalogRelationshipType)
      .map((type): TypeEntry => ({ category, type })),
  ),
  portionSize: 12,
} as const;

export function RelationshipTypeSearchPicker({
  describedBy,
  id,
  invalid,
  onBlur,
  onCustomTypeStart,
  onTypeChange,
  ref,
  value,
}: RelationshipTypeSearchPickerProps) {
  const t = useTranslations("relationships.editor.type");
  const labels = useRelationshipLabels();
  const [open, setOpen] = useState(false);
  const isLeavingForCustomType = useRef(false);

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) onBlur();
  }

  function pick(type: CatalogRelationshipType) {
    onTypeChange(type);
    toggle(false);
  }

  function startCustomType() {
    isLeavingForCustomType.current = true;
    onCustomTypeStart();
    toggle(false);
  }

  return (
    <Popover onOpenChange={toggle} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-invalid={invalid}
          className="h-11 w-full justify-between gap-2 px-3 font-normal sm:h-10"
          data-relationship-autofocus=""
          id={id}
          ref={ref}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className={value === null ? "truncate text-muted-foreground" : "truncate"}>
            {value === null ? t("placeholder") : labels.type(value)}
          </span>
          <ChevronsUpDown aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
        onCloseAutoFocus={(event) => {
          if (!isLeavingForCustomType.current) return;
          isLeavingForCustomType.current = false;
          event.preventDefault();
        }}
      >
        <TypeSearchPanel onCustomTypeStart={startCustomType} onPick={pick} value={value} />
      </PopoverContent>
    </Popover>
  );
}

function filterTypeEntries({
  category,
  label,
  query,
}: {
  category: CategoryFilter;
  label: (type: CatalogRelationshipType) => string;
  query: string;
}): TypeEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  return TYPE_SEARCH.entries.filter(
    (entry) =>
      (category === TYPE_SEARCH.allCategories || entry.category === category) &&
      (needle === "" || label(entry.type).toLocaleLowerCase().includes(needle)),
  );
}

function groupByCategory(entries: readonly TypeEntry[]): TypeGroup[] {
  return STANDARD_CATEGORIES.map((category) => ({
    category,
    types: entries.filter((entry) => entry.category === category).map((entry) => entry.type),
  })).filter((group) => group.types.length > 0);
}

function isStandardCategory(category: RelationshipCategory): category is StandardCategory {
  return category !== "custom";
}

function toCategoryFilter(value: string): Nullable<CategoryFilter> {
  if (value === TYPE_SEARCH.allCategories) return TYPE_SEARCH.allCategories;
  return STANDARD_CATEGORIES.find((category) => category === value) ?? null;
}

function TypeResults({
  category,
  entries,
  onPick,
  value,
}: {
  category: CategoryFilter;
  entries: readonly TypeEntry[];
  onPick: (type: CatalogRelationshipType) => void;
  value: Nullable<RelationshipType>;
}) {
  const t = useTranslations("relationships.editor.type");
  const labels = useRelationshipLabels();
  const [visibleCount, setVisibleCount] = useState<number>(TYPE_SEARCH.portionSize);
  const visibleEntries = entries.slice(0, visibleCount);
  const showsCategoryHeadings = category === TYPE_SEARCH.allCategories;
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: visibleCount < entries.length,
    isFetchingNextPage: false,
    itemCount: visibleEntries.length,
    onLoadMore: () => setVisibleCount((count) => count + TYPE_SEARCH.portionSize),
  });

  return (
    <CommandList label={t("results")} onScroll={onScroll} ref={scrollRef}>
      <CommandEmpty>{t("empty")}</CommandEmpty>
      {groupByCategory(visibleEntries).map((group) => (
        <CommandGroup
          heading={showsCategoryHeadings ? labels.category(group.category) : undefined}
          key={group.category}
        >
          {group.types.map((type) => (
            <CommandItem
              className="min-h-11 cursor-pointer sm:min-h-0"
              data-checked={type === value}
              key={type}
              onSelect={() => onPick(type)}
              value={type}
            >
              <span className="min-w-0 flex-1 truncate">{labels.type(type)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </CommandList>
  );
}

function TypeSearchPanel({
  onCustomTypeStart,
  onPick,
  value,
}: {
  onCustomTypeStart: () => void;
  onPick: (type: CatalogRelationshipType) => void;
  value: Nullable<RelationshipType>;
}) {
  const t = useTranslations("relationships.editor.type");
  const labels = useRelationshipLabels();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>(TYPE_SEARCH.allCategories);
  const entries = filterTypeEntries({ category, label: labels.type, query });

  return (
    <Command label={t("search")} onKeyDown={pressButtonOnEnter} shouldFilter={false}>
      <CommandInput
        onValueChange={(next) => {
          setQuery(next);
          setCategory(TYPE_SEARCH.allCategories);
        }}
        placeholder={t("search")}
        value={query}
      />
      <ChipGroup
        className="px-1 pt-2 pb-1 max-sm:flex-nowrap max-sm:overflow-x-auto"
        label={t("category")}
        mode="single"
        onValueChange={(next) => {
          const parsed = toCategoryFilter(next);
          if (parsed !== null) setCategory(parsed);
        }}
        options={[
          { label: t("allCategories"), value: TYPE_SEARCH.allCategories },
          ...STANDARD_CATEGORIES.map((option) => ({
            label: labels.category(option),
            value: option,
          })),
        ]}
        size="sm"
        value={category}
      />
      <TypeResults
        category={category}
        entries={entries}
        key={`${category}:${query.trim()}`}
        onPick={onPick}
        value={value}
      />
      <div className="border-t border-border p-1">
        <Button
          className="w-full justify-start max-sm:min-h-11"
          onClick={onCustomTypeStart}
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden />
          {t("ownType")}
        </Button>
      </div>
    </Command>
  );
}
