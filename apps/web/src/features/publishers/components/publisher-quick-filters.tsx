"use client";

import type { LibraryPublishersQuickCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import type { PublishersQuickFilter } from "../model/publisher-query";

import { PUBLISHERS_QUICK_FILTERS } from "../model/publisher-query";

type PublisherQuickFiltersProps = {
  counts?: LibraryPublishersQuickCounts;
  countsPending?: boolean;
  onChange: (value: PublishersQuickFilter) => void;
  value: PublishersQuickFilter;
};

export function PublisherQuickFilters({
  counts,
  countsPending,
  onChange,
  value,
}: PublisherQuickFiltersProps) {
  const t = useTranslations("publishers.quickFilters");

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        countsPending={countsPending}
        label={t("label")}
        mode="single"
        onValueChange={(next) => {
          const match = PUBLISHERS_QUICK_FILTERS.find((filter) => filter === next);
          if (match !== undefined) onChange(match);
        }}
        options={PUBLISHERS_QUICK_FILTERS.map((filter) => ({
          count: counts?.[filter],
          label: t(filter),
          value: filter,
        }))}
        size="sm"
        value={value}
      />
    </div>
  );
}
