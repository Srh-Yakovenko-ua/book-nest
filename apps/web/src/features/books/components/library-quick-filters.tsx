"use client";

import type { LibraryQuickCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import type { LibraryScope } from "../model/library-query";

import {
  type LibraryQuickFilterKey,
  quickFilterKeysForScope,
} from "../model/library-quick-filters";

type LibraryQuickFiltersProps = {
  counts?: LibraryQuickCounts;
  countsPending?: boolean;
  onSelect: (key: LibraryQuickFilterKey) => void;
  scope: LibraryScope;
  value: LibraryQuickFilterKey | null;
};

export function LibraryQuickFilters({
  counts,
  countsPending,
  onSelect,
  scope,
  value,
}: LibraryQuickFiltersProps) {
  const t = useTranslations("books.library.quickFilters");
  const keys = quickFilterKeysForScope(scope);
  const options = keys.map((key) => ({ count: counts?.[key], label: t(key), value: key }));

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        countsPending={countsPending}
        label={t("label")}
        mode="single"
        onValueChange={(next) => {
          const match = keys.find((key) => key === next);
          if (match !== undefined) onSelect(match);
        }}
        options={options}
        size="sm"
        value={value ?? ""}
      />
    </div>
  );
}
