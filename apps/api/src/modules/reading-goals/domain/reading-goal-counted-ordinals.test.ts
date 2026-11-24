import { describe, expect, it } from "vitest";

import type { ReadingGoalQualifyingBook } from "./reading-goal-progress.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { assignReadingGoalCountedOrdinals } from "./reading-goal-counted-ordinals.js";

function countedOrdinals({
  newlyCounted,
  qualifyingBooks,
}: {
  newlyCounted: string[];
  qualifyingBooks: ReadingGoalQualifyingBook[];
}): Record<string, number> {
  return Object.fromEntries(
    assignReadingGoalCountedOrdinals({
      newlyCountedBookIds: new Set(newlyCounted),
      qualifyingBooks,
    }).map(({ bookId, completedCount }) => [bookId, completedCount]),
  );
}

function qualifying(bookId: string, finishedAt: string): ReadingGoalQualifyingBook {
  return { bookId, finishedAt: parseIsoDate(finishedAt) };
}

describe("assignReadingGoalCountedOrdinals", () => {
  it("counts the first book of a goal as one", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-zeta"],
        qualifyingBooks: [qualifying("book-zeta", "2026-03-05")],
      }),
    ).toStrictEqual({ "book-zeta": 1 });
  });

  it("counts a second book finished the same day as two even when its id sorts first", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-alpha"],
        qualifyingBooks: [
          qualifying("book-alpha", "2026-03-05"),
          qualifying("book-zeta", "2026-03-05"),
        ],
      }),
    ).toStrictEqual({ "book-alpha": 2 });
  });

  it("counts a backdated book as the next total rather than by its reading date", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-backdated"],
        qualifyingBooks: [
          qualifying("book-backdated", "2026-02-10"),
          qualifying("book-march", "2026-03-01"),
          qualifying("book-april", "2026-04-05"),
        ],
      }),
    ).toStrictEqual({ "book-backdated": 3 });
  });

  it("records nothing for an operation that only uncounts a book", () => {
    expect(
      countedOrdinals({
        newlyCounted: [],
        qualifyingBooks: [qualifying("book-a", "2026-03-01"), qualifying("book-c", "2026-03-09")],
      }),
    ).toStrictEqual({});
  });

  it("counts a recounted book as the total at the moment it comes back", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-b"],
        qualifyingBooks: [
          qualifying("book-b", "2026-02-20"),
          qualifying("book-a", "2026-03-01"),
          qualifying("book-c", "2026-03-09"),
        ],
      }),
    ).toStrictEqual({ "book-b": 3 });
  });

  it("numbers every book of a newly created goal from one, by reading date then book id", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-c", "book-a", "book-b", "book-d"],
        qualifyingBooks: [
          qualifying("book-d", "2026-03-12"),
          qualifying("book-c", "2026-03-04"),
          qualifying("book-a", "2026-03-04"),
          qualifying("book-b", "2026-03-01"),
        ],
      }),
    ).toStrictEqual({ "book-a": 2, "book-b": 1, "book-c": 3, "book-d": 4 });
  });

  it("gives several books counted in one operation consecutive values ending at the new total", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-late", "book-early"],
        qualifyingBooks: [
          qualifying("book-early", "2026-01-15"),
          qualifying("book-old-1", "2026-03-01"),
          qualifying("book-old-2", "2026-03-02"),
          qualifying("book-late", "2026-03-20"),
        ],
      }),
    ).toStrictEqual({ "book-early": 3, "book-late": 4 });
  });

  it("starts after the books still counted when the same operation uncounts one and counts another", () => {
    expect(
      countedOrdinals({
        newlyCounted: ["book-new"],
        qualifyingBooks: [
          qualifying("book-kept", "2026-03-01"),
          qualifying("book-new", "2026-03-03"),
        ],
      }),
    ).toStrictEqual({ "book-new": 2 });
  });
});
