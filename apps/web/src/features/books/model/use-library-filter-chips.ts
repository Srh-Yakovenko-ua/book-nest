"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "../components/library-active-filters";
import type { LibraryQueryState } from "./library-query";
import type { UseLibraryQueryResult } from "./use-library-query";

import { rangeLabel } from "./filter-chips";

type UseLibraryFilterChipsOptions = {
  genreName: (key: string) => string;
  resolveEntityName: (id: string) => string | undefined;
  setState: UseLibraryQueryResult["setState"];
  state: LibraryQueryState;
};

export function useLibraryFilterChips({
  genreName,
  resolveEntityName,
  setState,
  state,
}: UseLibraryFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("books.library.activeFilters");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwner = useTranslations("books.ownershipStatus.options");
  const tFormat = useTranslations("books.format.options");
  const tAge = useTranslations("books.classification.ageCategoryLabels");
  const tLanguage = useTranslations("books.classification.languageLabels");
  const tBookType = useTranslations("books.library.filters.bookType");

  const chips: ActiveFilterChip[] = [];

  const search = state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: search }),
      onRemove: () => void setState({ q: null }),
    });
  }

  for (const value of state.status) {
    chips.push({
      key: `status:${value}`,
      label: tStatus(value),
      onRemove: () => void setState({ status: state.status.filter((item) => item !== value) }),
    });
  }

  for (const value of state.owner) {
    chips.push({
      key: `owner:${value}`,
      label: tOwner(value),
      onRemove: () => void setState({ owner: state.owner.filter((item) => item !== value) }),
    });
  }

  for (const value of state.format) {
    chips.push({
      key: `format:${value}`,
      label: tFormat(value),
      onRemove: () => void setState({ format: state.format.filter((item) => item !== value) }),
    });
  }

  for (const value of state.genre) {
    chips.push({
      key: `genre:${value}`,
      label: genreName(value),
      onRemove: () => void setState({ genre: state.genre.filter((item) => item !== value) }),
    });
  }

  for (const value of state.tag) {
    chips.push({
      key: `tag:${value}`,
      label: resolveEntityName(value) ?? t("unknown"),
      onRemove: () => void setState({ tag: state.tag.filter((item) => item !== value) }),
    });
  }

  for (const value of state.ageCategory) {
    chips.push({
      key: `age:${value}`,
      label: tAge(value),
      onRemove: () =>
        void setState({ ageCategory: state.ageCategory.filter((item) => item !== value) }),
    });
  }

  for (const value of state.language) {
    chips.push({
      key: `language:${value}`,
      label: tLanguage(value),
      onRemove: () => void setState({ language: state.language.filter((item) => item !== value) }),
    });
  }

  for (const value of state.author) {
    chips.push({
      key: `author:${value}`,
      label: t("author", { name: resolveEntityName(value) ?? t("unknown") }),
      onRemove: () => void setState({ author: state.author.filter((item) => item !== value) }),
    });
  }

  for (const value of state.publisher) {
    chips.push({
      key: `publisher:${value}`,
      label: t("publisher", { name: resolveEntityName(value) ?? t("unknown") }),
      onRemove: () =>
        void setState({ publisher: state.publisher.filter((item) => item !== value) }),
    });
  }

  if (state.bookType !== null) {
    chips.push({
      key: "bookType",
      label: tBookType(state.bookType),
      onRemove: () => void setState({ bookType: null }),
    });
  }

  if (state.isFavorite === true) {
    chips.push({
      key: "isFavorite",
      label: t("favorite"),
      onRemove: () => void setState({ isFavorite: null }),
    });
  }

  if (state.hasCover !== null) {
    chips.push({
      key: "hasCover",
      label: state.hasCover ? t("coverWith") : t("coverWithout"),
      onRemove: () => void setState({ hasCover: null }),
    });
  }

  if (state.hasRating !== null) {
    chips.push({
      key: "hasRating",
      label: state.hasRating ? t("ratedWith") : t("ratedWithout"),
      onRemove: () => void setState({ hasRating: null }),
    });
  }

  const ratingChip = rangeLabel({
    from: (value) => t("ratingFrom", { value }),
    max: state.ratingMax,
    min: state.ratingMin,
    range: (min, max) => t("ratingRange", { max, min }),
    to: (value) => t("ratingTo", { value }),
  });
  if (ratingChip !== null) {
    chips.push({
      key: "rating",
      label: ratingChip,
      onRemove: () => void setState({ ratingMax: null, ratingMin: null }),
    });
  }

  const yearChip = rangeLabel({
    from: (value) => t("yearFrom", { value }),
    max: state.yearMax,
    min: state.yearMin,
    range: (min, max) => t("yearRange", { max, min }),
    to: (value) => t("yearTo", { value }),
  });
  if (yearChip !== null) {
    chips.push({
      key: "year",
      label: yearChip,
      onRemove: () => void setState({ yearMax: null, yearMin: null }),
    });
  }

  const pagesChip = rangeLabel({
    from: (value) => t("pagesFrom", { value }),
    max: state.pagesMax,
    min: state.pagesMin,
    range: (min, max) => t("pagesRange", { max, min }),
    to: (value) => t("pagesTo", { value }),
  });
  if (pagesChip !== null) {
    chips.push({
      key: "pages",
      label: pagesChip,
      onRemove: () => void setState({ pagesMax: null, pagesMin: null }),
    });
  }

  return chips;
}
