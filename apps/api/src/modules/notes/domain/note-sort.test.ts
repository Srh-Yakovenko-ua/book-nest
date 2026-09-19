import { BookNoteSortSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import {
  BOOK_NOTE_SORT_ORDER_BY,
  BOOK_NOTES_ORDER_BY,
  SERIES_NOTES_ORDER_BY,
} from "./note-sort.js";

const PINNED_FIRST_SORT = "pinned_first";

type OrderByTerm = Record<string, unknown>;

function hasPinnedTerm(orderBy: OrderByTerm[]): boolean {
  return orderBy.some((term) => "isPinned" in term);
}

describe("book archive sort", () => {
  const nonPinnedSorts = BookNoteSortSchema.options.filter((sort) => sort !== PINNED_FIRST_SORT);

  it.each(nonPinnedSorts)("%s never promotes pinned notes", (sort) => {
    expect(hasPinnedTerm(BOOK_NOTE_SORT_ORDER_BY[sort])).toBe(false);
  });

  it.each(BookNoteSortSchema.options)("%s ends with the id tiebreaker", (sort) => {
    expect(BOOK_NOTE_SORT_ORDER_BY[sort].at(-1)).toEqual({ id: "asc" });
  });

  it("pinned_first starts with pinned notes, then newest, then id", () => {
    expect(BOOK_NOTE_SORT_ORDER_BY.pinned_first).toEqual([
      { isPinned: "desc" },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("orders title, author and page by the book", () => {
    expect(BOOK_NOTE_SORT_ORDER_BY.title).toEqual([
      { book: { title: "asc" } },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
    expect(BOOK_NOTE_SORT_ORDER_BY.author).toEqual([
      { book: { firstAuthorName: "asc" } },
      { book: { title: "asc" } },
      { id: "asc" },
    ]);
    expect(BOOK_NOTE_SORT_ORDER_BY.page).toEqual([
      { book: { title: "asc" } },
      { page: { nulls: "last", sort: "asc" } },
      { id: "asc" },
    ]);
    expect(BOOK_NOTE_SORT_ORDER_BY.recently_updated).toEqual([
      { updatedAt: "desc" },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });
});

describe("entity details sort", () => {
  it("keeps the book details order pinned, page, newest, id", () => {
    expect(BOOK_NOTES_ORDER_BY).toEqual([
      { isPinned: "desc" },
      { page: { nulls: "last", sort: "asc" } },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("keeps the series details order pinned, recently updated, newest, id", () => {
    expect(SERIES_NOTES_ORDER_BY).toEqual([
      { isPinned: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });
});
