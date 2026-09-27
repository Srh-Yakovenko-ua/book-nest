import { describe, expect, it } from "vitest";

import type { NoteAuthorLink, NoteEntityCount } from "./note-facets.js";

import { buildBookNotesSummary } from "./book-notes-summary.js";

const HERBERT = { id: "author-herbert", name: "Frank Herbert" };
const SIMMONS = { id: "author-simmons", name: "Dan Simmons" };
const GAIMAN = { id: "author-gaiman", name: "Neil Gaiman" };
const PRATCHETT = { id: "author-pratchett", name: "Terry Pratchett" };

function bookCount(entityId: string, count: number): NoteEntityCount {
  return { count, entityId, label: `Title of ${entityId}` };
}

function link(entityId: string, author: { id: string; name: string }): NoteAuthorLink {
  return { author, entityId };
}

describe("buildBookNotesSummary", () => {
  it("returns zeros and null leaders without notes", () => {
    expect(
      buildBookNotesSummary({ authorLinks: [], bookCounts: [], createdLast30DaysCount: 0 }),
    ).toEqual({
      bookNotesCount: 0,
      booksWithFiveOrMoreNotesCount: 0,
      booksWithNotesCount: 0,
      createdLast30DaysCount: 0,
      topAuthor: null,
      topBook: null,
    });
  });

  it("counts a book with exactly five notes as a 5+ book and four as not", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [],
      bookCounts: [bookCount("dune", 5), bookCount("hyperion", 4)],
      createdLast30DaysCount: 2,
    });

    expect(summary.bookNotesCount).toBe(9);
    expect(summary.booksWithNotesCount).toBe(2);
    expect(summary.booksWithFiveOrMoreNotesCount).toBe(1);
    expect(summary.createdLast30DaysCount).toBe(2);
  });

  it("credits the full count of a co-authored book to each author", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [
        link("good-omens", GAIMAN),
        link("good-omens", PRATCHETT),
        link("discworld", PRATCHETT),
      ],
      bookCounts: [bookCount("good-omens", 3), bookCount("discworld", 1)],
      createdLast30DaysCount: 0,
    });

    expect(summary.topAuthor).toEqual({ leadersCount: 1, name: "Terry Pratchett", notesCount: 4 });
  });

  it("reports an author tie with a leaders count and no name", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [link("dune", HERBERT), link("hyperion", SIMMONS)],
      bookCounts: [bookCount("dune", 2), bookCount("hyperion", 2)],
      createdLast30DaysCount: 0,
    });

    expect(summary.topAuthor).toEqual({ leadersCount: 2, name: null, notesCount: 2 });
  });

  it("reports a book tie with a leaders count and no title", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [],
      bookCounts: [bookCount("dune", 3), bookCount("hyperion", 3), bookCount("solaris", 1)],
      createdLast30DaysCount: 0,
    });

    expect(summary.topBook).toEqual({ leadersCount: 2, notesCount: 3, title: null });
  });

  it("names the unique top book", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [],
      bookCounts: [bookCount("dune", 4), bookCount("hyperion", 1)],
      createdLast30DaysCount: 0,
    });

    expect(summary.topBook).toEqual({ leadersCount: 1, notesCount: 4, title: "Title of dune" });
  });

  it("exposes the all-ones case as every book leading with one note", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [],
      bookCounts: [bookCount("dune", 1), bookCount("hyperion", 1)],
      createdLast30DaysCount: 0,
    });

    expect(summary.topBook).toEqual({ leadersCount: 2, notesCount: 1, title: null });
    expect(summary.booksWithNotesCount).toBe(2);
  });

  it("returns a null top author when no book has author data", () => {
    const summary = buildBookNotesSummary({
      authorLinks: [],
      bookCounts: [bookCount("dune", 2)],
      createdLast30DaysCount: 0,
    });

    expect(summary.topAuthor).toBeNull();
  });
});
