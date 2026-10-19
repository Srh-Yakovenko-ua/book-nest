"use client";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type {
  NotesArchiveEmptyReason,
  NotesArchiveListState,
} from "../model/notes-archive-list-state";

type BookNotesResultsStatusProps = {
  state: NotesArchiveListState;
  totalCount: number;
};

export function BookNotesResultsStatus({ state, totalCount }: BookNotesResultsStatusProps) {
  const t = useTranslations("notes");

  const emptyTitles = {
    filters: t("archive.emptyFilters.title"),
    library: t("bookTab.empty.title"),
    search: t("archive.emptySearch.title"),
  } satisfies Record<NotesArchiveEmptyReason, string>;

  function announcement(): string {
    switch (state.kind) {
      case "empty":
        return emptyTitles[state.reason];
      case "error":
        return "";
      case "loading":
        return t("states.loading");
      case "ready":
        return t("bookTab.resultsFound", { count: totalCount });
      default:
        return assertNever(state);
    }
  }

  return (
    <p className="sr-only" role="status">
      {announcement()}
    </p>
  );
}
