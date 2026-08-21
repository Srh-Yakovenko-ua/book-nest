"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books/components/library-active-filters";

import { ListDetailsControllerDetailOwnerItem } from "@/shared/api/generated/model";

import type { ListDetailQueryState } from "./list-detail-query";
import type { UseListDetailQueryResult } from "./use-list-detail-query";

type UseListDetailChipsOptions = {
  authorName: (id: string) => string;
  genreName: (key: string) => string;
  setState: UseListDetailQueryResult["setState"];
  state: ListDetailQueryState;
};

export function useListDetailChips({
  authorName,
  genreName,
  setState,
  state,
}: UseListDetailChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("books.library.activeFilters");
  const tFilters = useTranslations("lists.details.filters");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwner = useTranslations("books.ownershipStatus.options");
  const tFormat = useTranslations("books.format.options");

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
      onRemove: () => void setState({ status: withoutValue(state.status, value) }),
    });
  }

  for (const value of state.owner) {
    chips.push({
      key: `owner:${value}`,
      label:
        value === ListDetailsControllerDetailOwnerItem.none
          ? tFilters("ownership.none")
          : tOwner(value),
      onRemove: () => void setState({ owner: withoutValue(state.owner, value) }),
    });
  }

  for (const value of state.format) {
    chips.push({
      key: `format:${value}`,
      label: tFormat(value),
      onRemove: () => void setState({ format: withoutValue(state.format, value) }),
    });
  }

  for (const value of state.author) {
    chips.push({
      key: `author:${value}`,
      label: t("author", { name: authorName(value) }),
      onRemove: () => void setState({ author: withoutValue(state.author, value) }),
    });
  }

  for (const value of state.genre) {
    chips.push({
      key: `genre:${value}`,
      label: genreName(value),
      onRemove: () => void setState({ genre: withoutValue(state.genre, value) }),
    });
  }

  if (state.bookType !== null) {
    chips.push({
      key: "bookType",
      label: tFilters(`bookType.${state.bookType}`),
      onRemove: () => void setState({ bookType: null }),
    });
  }

  if (state.inQueue !== null) {
    chips.push({
      key: "inQueue",
      label: state.inQueue ? tFilters("queue.in") : tFilters("queue.notIn"),
      onRemove: () => void setState({ inQueue: null }),
    });
  }

  if (state.isFavorite !== null) {
    chips.push({
      key: "isFavorite",
      label: state.isFavorite ? t("favorite") : tFilters("favorite.without"),
      onRemove: () => void setState({ isFavorite: null }),
    });
  }

  return chips;
}

function withoutValue<TValue>(values: TValue[], removed: TValue): null | TValue[] {
  const next = values.filter((value) => value !== removed);
  return next.length === 0 ? null : next;
}
