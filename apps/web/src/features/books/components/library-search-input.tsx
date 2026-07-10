"use client";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";

const SEARCH_MIN_LENGTH = 2;
const ISBN_PATTERN = /^[\d\s-]+$/;

type LibrarySearchInputProps = {
  onClear: () => void;
  onSearch: (value: string) => void;
  value: string;
};

export function LibrarySearchInput({ onClear, onSearch, value }: LibrarySearchInputProps) {
  const t = useTranslations("books.library.search");

  return (
    <DebouncedSearchInput
      clearLabel={t("clear")}
      isCommittable={isCommittable}
      label={t("label")}
      onClear={onClear}
      onSearch={onSearch}
      placeholder={t("placeholder")}
      value={value}
    />
  );
}

function isCommittable(value: string): boolean {
  if (value.length === 0) return true;
  if (value.length >= SEARCH_MIN_LENGTH) return true;
  return ISBN_PATTERN.test(value);
}
