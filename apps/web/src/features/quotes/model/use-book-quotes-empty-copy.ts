"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import type { BookQuotesEmptyReason } from "./book-quotes-list-state";

export function useBookQuotesEmptyCopy(): Record<BookQuotesEmptyReason, EmptyStateEntry> {
  const t = useTranslations("quotes");

  return {
    book: {
      desc: t("bookTab.empty.description"),
      illu: "empty-quotes",
      primary: { icon: "plus", label: t("actions.add") },
      title: t("bookTab.empty.title"),
    },
    filters: {
      desc: t("bookTab.emptyFilters.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("bookTab.emptyFilters.clear") },
      title: t("bookTab.emptyFilters.title"),
    },
    search: {
      desc: t("bookTab.emptySearch.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("toolbar.searchClear") },
      title: t("noResults.title"),
    },
  };
}
