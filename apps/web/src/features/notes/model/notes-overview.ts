import type { BookNotesOverviewView, SeriesNotesOverviewView } from "@app/shared";

import { assertNever } from "./assert-never";

export type NotesOverview =
  (BookNotesOverviewView & { scope: "books" }) | (SeriesNotesOverviewView & { scope: "series" });

export function hasContextualBlocks(overview: NotesOverview): boolean {
  switch (overview.scope) {
    case "books":
      return overview.memoryNote !== null || overview.postFinish !== null;
    case "series":
      return overview.beforeNextBook !== null || overview.memoryNote !== null;
    default:
      return assertNever(overview);
  }
}
