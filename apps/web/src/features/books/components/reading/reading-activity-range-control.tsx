"use client";

import type { ReadingActivityRange } from "@app/shared";

import { useTranslations } from "next-intl";

import { Segmented } from "@/components/ui/segmented";

type ReadingActivityRangeControlProps = {
  onValueChange: (value: ReadingActivityRange) => void;
  value: ReadingActivityRange;
};

export function ReadingActivityRangeControl({
  onValueChange,
  value,
}: ReadingActivityRangeControlProps) {
  const t = useTranslations("books.details.reading");

  const options = [
    { label: t("range7d"), value: "7d" },
    { label: t("range14d"), value: "14d" },
    { label: t("rangeAll"), value: "all" },
  ];

  return (
    <Segmented
      label={t("rangeLabel")}
      onValueChange={(next) => {
        if (isRange(next)) onValueChange(next);
      }}
      options={options}
      value={value}
    />
  );
}

function isRange(value: string): value is ReadingActivityRange {
  return value === "7d" || value === "14d" || value === "all";
}
