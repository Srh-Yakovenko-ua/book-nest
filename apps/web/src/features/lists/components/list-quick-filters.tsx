"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import type { ListQuickFilterCounts, ListQuickFilterKey } from "../model/list-quick-filters";

import { LIST_QUICK_FILTER_KEYS } from "../model/list-quick-filters";

type ListQuickFiltersProps = {
  counts: ListQuickFilterCounts;
  onSelect: (key: ListQuickFilterKey) => void;
  value: Nullable<ListQuickFilterKey>;
};

export function ListQuickFilters({ counts, onSelect, value }: ListQuickFiltersProps) {
  const t = useTranslations("lists.details.quickFilters");
  const options = LIST_QUICK_FILTER_KEYS.map((key) => ({
    count: counts[key],
    disabled: counts[key] === 0 && key !== "all" && key !== value,
    label: t(key),
    value: key,
  }));

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        label={t("label")}
        mode="single"
        onValueChange={(next) => {
          const match = LIST_QUICK_FILTER_KEYS.find((key) => key === next);
          if (match !== undefined) onSelect(match);
        }}
        options={options}
        size="sm"
        value={value ?? ""}
      />
    </div>
  );
}
