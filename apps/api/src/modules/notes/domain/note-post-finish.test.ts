import { describe, expect, it } from "vitest";

import type { NotePostFinishCandidate, NotePostFinishCounts } from "./note-post-finish.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import {
  notePostFinishWindow,
  selectNotePostFinishCandidate,
  toPostFinishNotesView,
} from "./note-post-finish.js";

const COUNTS: NotePostFinishCounts = { favoritesCount: 1, notesCount: 3, pinnedCount: 2 };

function cycle(id: string, bookId: string, finishedOn: string): NotePostFinishCandidate {
  return { bookId, finishedAt: parseIsoDate(finishedOn), id };
}

describe("notePostFinishWindow", () => {
  it("spans the thirty local days up to today", () => {
    expect(notePostFinishWindow("2026-09-10")).toEqual({
      earliestFinishedOn: "2026-08-11",
      latestFinishedOn: "2026-09-10",
    });
  });
});

describe("selectNotePostFinishCandidate", () => {
  it("picks the most recently finished cycle whose book holds a note", () => {
    const selection = selectNotePostFinishCandidate({
      candidates: [
        cycle("c-old", "book-old", "2026-09-01"),
        cycle("c-empty", "book-empty", "2026-09-09"),
        cycle("c-new", "book-new", "2026-09-05"),
      ],
      countsByBookId: new Map([
        ["book-empty", { ...COUNTS, notesCount: 0 }],
        ["book-new", COUNTS],
        ["book-old", COUNTS],
      ]),
    });

    expect(selection?.candidate.id).toBe("c-new");
  });

  it("breaks a same-day tie on the smaller cycle id", () => {
    const selection = selectNotePostFinishCandidate({
      candidates: [cycle("c-b", "book-b", "2026-09-05"), cycle("c-a", "book-a", "2026-09-05")],
      countsByBookId: new Map([
        ["book-a", COUNTS],
        ["book-b", COUNTS],
      ]),
    });

    expect(selection?.candidate.id).toBe("c-a");
  });

  it("returns null when no candidate book holds a note", () => {
    expect(
      selectNotePostFinishCandidate({
        candidates: [cycle("c-a", "book-a", "2026-09-05")],
        countsByBookId: new Map(),
      }),
    ).toBeNull();
  });
});

describe("toPostFinishNotesView", () => {
  it("maps the book preview, the finished day and every count", () => {
    const view = toPostFinishNotesView({
      book: { firstAuthorName: "", id: "book-a", title: "Dune" },
      cover: null,
      selection: { candidate: cycle("c-a", "book-a", "2026-09-05"), counts: COUNTS },
    });

    expect(view).toEqual({
      book: { author: null, cover: null, id: "book-a", title: "Dune" },
      favoritesCount: 1,
      finishedAt: "2026-09-05",
      notesCount: 3,
      pinnedCount: 2,
      readingCycleId: "c-a",
    });
  });
});
