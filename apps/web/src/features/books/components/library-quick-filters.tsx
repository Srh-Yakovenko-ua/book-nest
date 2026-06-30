"use client";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import {
  LIBRARY_QUICK_FILTER_KEYS,
  type LibraryQuickFilterKey,
} from "../model/library-quick-filters";

type LibraryQuickFiltersProps = {
  onSelect: (key: LibraryQuickFilterKey) => void;
  value: LibraryQuickFilterKey | null;
};

export function LibraryQuickFilters({ onSelect, value }: LibraryQuickFiltersProps) {
  const t = useTranslations("books.library.quickFilters");
  const options = LIBRARY_QUICK_FILTER_KEYS.map((key) => ({ label: t(key), value: key }));

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        label={t("label")}
        mode="single"
        onValueChange={(next) => {
          const match = LIBRARY_QUICK_FILTER_KEYS.find((key) => key === next);
          if (match !== undefined) onSelect(match);
        }}
        options={options}
        size="sm"
        value={value ?? ""}
      />
    </div>
  );
}
