"use client";

import { useTranslations } from "next-intl";

import type { LoansControllerListFilter } from "@/shared/api/generated/model";

import { ChipGroup } from "@/components/ui/chip-group";

import type { LoanDirection } from "../model/loan-pages";
import type { LoansQuickFilterCounts, LoansQuickFilterKey } from "../model/loans-quick-filters";

import { LOANS_QUICK_FILTER_KEYS } from "../model/loans-quick-filters";

type LoansQuickFiltersProps = {
  counts?: LoansQuickFilterCounts;
  direction: LoanDirection;
  onSelect: (key: LoansQuickFilterKey) => void;
  value: LoansControllerListFilter;
};

export function LoansQuickFilters({ counts, direction, onSelect, value }: LoansQuickFiltersProps) {
  const t = useTranslations("loans.quickFilters");
  const keys = LOANS_QUICK_FILTER_KEYS[direction];
  const options = keys.map((key) => ({ count: counts?.[key], label: t(key), value: key }));

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        label={t("label")}
        mode="single"
        onValueChange={(next) => {
          const match = keys.find((key) => key === next);
          if (match !== undefined) onSelect(match);
        }}
        options={options}
        size="sm"
        value={value}
      />
    </div>
  );
}
