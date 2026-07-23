"use client";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";

type TimelineSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

export function TimelineSearch({ onChange, value }: TimelineSearchProps) {
  const t = useTranslations("timeline.filters");

  return (
    <DebouncedSearchInput
      clearLabel={t("reset")}
      label={t("searchLabel")}
      onClear={() => onChange("")}
      onSearch={onChange}
      placeholder={t("searchPlaceholder")}
      value={value}
    />
  );
}
