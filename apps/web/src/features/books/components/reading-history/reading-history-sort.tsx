"use client";

import type { ReadingHistorySort } from "@app/shared";

import { useTranslations } from "next-intl";

import { Segmented } from "@/components/ui/segmented";

type ReadingHistorySortControlProps = {
  onValueChange: (value: ReadingHistorySort) => void;
  value: ReadingHistorySort;
};

export function ReadingHistorySortControl({
  onValueChange,
  value,
}: ReadingHistorySortControlProps) {
  const t = useTranslations("books.details.readingHistory");

  const options = [
    { label: t("newestFirst"), value: "desc" },
    { label: t("oldestFirst"), value: "asc" },
  ];

  return (
    <Segmented
      label={t("sortLabel")}
      onValueChange={(next) => {
        if (isSort(next)) onValueChange(next);
      }}
      options={options}
      value={value}
    />
  );
}

function isSort(value: string): value is ReadingHistorySort {
  return value === "asc" || value === "desc";
}
