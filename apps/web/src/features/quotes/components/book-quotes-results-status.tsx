"use client";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { BookQuotesListState } from "../model/book-quotes-list-state";

import { useBookQuotesEmptyCopy } from "../model/use-book-quotes-empty-copy";

type BookQuotesResultsStatusProps = {
  state: BookQuotesListState;
  totalCount: number;
};

export function BookQuotesResultsStatus({ state, totalCount }: BookQuotesResultsStatusProps) {
  const t = useTranslations("quotes");
  const emptyCopy = useBookQuotesEmptyCopy();

  function announcement(): string {
    switch (state.kind) {
      case "empty":
        return emptyCopy[state.reason].title;
      case "error":
        return "";
      case "loading":
        return t("loading");
      case "ready":
        return t("bookTab.resultsFound", { count: totalCount });
      default:
        return assertNever(state);
    }
  }

  return (
    <p aria-live="polite" className="sr-only" role="status">
      {announcement()}
    </p>
  );
}
