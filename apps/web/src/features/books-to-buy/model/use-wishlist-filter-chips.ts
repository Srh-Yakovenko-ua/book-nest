"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { rangeLabel } from "@/features/books/model/filter-chips";

import type { UseWishlistQueryResult } from "./use-wishlist-query";
import type { WishlistQueryState } from "./wishlist-query";

import { resolvePriceCurrency } from "./wishlist-query";

type UseWishlistFilterChipsOptions = {
  genreName: (key: string) => string;
  resolveEntityName: (id: string) => string | undefined;
  setState: UseWishlistQueryResult["setState"];
  state: WishlistQueryState;
};

export function useWishlistFilterChips({
  genreName,
  resolveEntityName,
  setState,
  state,
}: UseWishlistFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("books.library.activeFilters");
  const tWishlist = useTranslations("booksToBuy.filters");
  const tLink = useTranslations("booksToBuy.linkFilter");
  const tFormat = useTranslations("books.format.options");
  const tLanguage = useTranslations("books.classification.languageLabels");

  const chips: ActiveFilterChip[] = [];

  const search = state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: search }),
      onRemove: () => void setState({ q: null }),
    });
  }

  if (state.link !== null) {
    chips.push({
      key: "link",
      label: tLink(state.link),
      onRemove: () => void setState({ link: null }),
    });
  }

  const priceCurrency = resolvePriceCurrency(state);
  const priceChip =
    priceCurrency === null
      ? null
      : rangeLabel({
          from: (value) => tWishlist("chips.priceFrom", { currency: priceCurrency, value }),
          max: state.priceMax,
          min: state.priceMin,
          range: (min, max) => tWishlist("chips.priceRange", { currency: priceCurrency, max, min }),
          to: (value) => tWishlist("chips.priceTo", { currency: priceCurrency, value }),
        });
  if (priceChip !== null) {
    chips.push({
      key: "price",
      label: priceChip,
      onRemove: () => void setState({ priceMax: null, priceMin: null }),
    });
  }

  for (const value of state.store) {
    chips.push({
      key: `store:${value}`,
      label: value,
      onRemove: () => void setState({ store: state.store.filter((item) => item !== value) }),
    });
  }

  for (const value of state.currency) {
    chips.push({
      key: `currency:${value}`,
      label: value,
      onRemove: () => void setState({ currency: state.currency.filter((item) => item !== value) }),
    });
  }

  for (const value of state.age) {
    chips.push({
      key: `age:${value}`,
      label: tWishlist(`age.${value}`),
      onRemove: () => void setState({ age: state.age.filter((item) => item !== value) }),
    });
  }

  for (const value of state.seriesPlacement) {
    chips.push({
      key: `seriesPlacement:${value}`,
      label: tWishlist(`seriesPlacement.${value}`),
      onRemove: () =>
        void setState({
          seriesPlacement: state.seriesPlacement.filter((item) => item !== value),
        }),
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

  for (const value of state.format) {
    chips.push({
      key: `format:${value}`,
      label: tFormat(value),
      onRemove: () => void setState({ format: state.format.filter((item) => item !== value) }),
    });
  }

  for (const value of state.language) {
    chips.push({
      key: `language:${value}`,
      label: tLanguage(value),
      onRemove: () => void setState({ language: state.language.filter((item) => item !== value) }),
    });
  }

  if (state.bookType !== null) {
    chips.push({
      key: "bookType",
      label: tWishlist(`bookType.${state.bookType}`),
      onRemove: () => void setState({ bookType: null }),
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

  if (state.hasCover !== null) {
    chips.push({
      key: "hasCover",
      label: state.hasCover ? t("coverWith") : t("coverWithout"),
      onRemove: () => void setState({ hasCover: null }),
    });
  }

  if (state.isFavorite !== null) {
    chips.push({
      key: "isFavorite",
      label: state.isFavorite ? t("favorite") : tWishlist("favorite.without"),
      onRemove: () => void setState({ isFavorite: null }),
    });
  }

  return chips;
}
