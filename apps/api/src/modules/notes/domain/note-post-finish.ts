import type { MediaView, Nullable, PostFinishNotesView } from "@app/shared";

import { compareDesc } from "date-fns";

import { addDaysToIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { emptyToNull } from "./note-fields.js";

export const NOTE_POST_FINISH_POLICY = { windowDays: 30 } as const;

export type NotePostFinishCandidate = {
  bookId: string;
  finishedAt: Date;
  id: string;
};

export type NotePostFinishCounts = {
  favoritesCount: number;
  notesCount: number;
  pinnedCount: number;
};

export type NotePostFinishSelection = {
  candidate: NotePostFinishCandidate;
  counts: NotePostFinishCounts;
};

export type NotePostFinishWindow = {
  earliestFinishedOn: string;
  latestFinishedOn: string;
};

export function notePostFinishWindow(today: string): NotePostFinishWindow {
  return {
    earliestFinishedOn: addDaysToIsoDate(today, -NOTE_POST_FINISH_POLICY.windowDays),
    latestFinishedOn: today,
  };
}

export function selectNotePostFinishCandidate({
  candidates,
  countsByBookId,
}: {
  candidates: NotePostFinishCandidate[];
  countsByBookId: ReadonlyMap<string, NotePostFinishCounts>;
}): Nullable<NotePostFinishSelection> {
  const ordered = [...candidates].sort(compareByCompletionRecency);

  for (const candidate of ordered) {
    const counts = countsByBookId.get(candidate.bookId);
    if (counts !== undefined && counts.notesCount > 0) {
      return { candidate, counts };
    }
  }

  return null;
}

export function toPostFinishNotesView({
  book,
  cover,
  selection,
}: {
  book: { firstAuthorName: string; id: string; title: string };
  cover: Nullable<MediaView>;
  selection: NotePostFinishSelection;
}): PostFinishNotesView {
  return {
    book: {
      author: emptyToNull(book.firstAuthorName),
      cover,
      id: book.id,
      title: book.title,
    },
    favoritesCount: selection.counts.favoritesCount,
    finishedAt: toIsoDate(selection.candidate.finishedAt),
    notesCount: selection.counts.notesCount,
    pinnedCount: selection.counts.pinnedCount,
    readingCycleId: selection.candidate.id,
  };
}

function compareByCompletionRecency(
  first: NotePostFinishCandidate,
  second: NotePostFinishCandidate,
): number {
  const byFinishedAt = compareDesc(first.finishedAt, second.finishedAt);
  return byFinishedAt === 0 ? first.id.localeCompare(second.id) : byFinishedAt;
}
