import { BOOK_CHAPTER_USAGE_MAX } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type {
  BookChaptersRepository,
  BookChapterUsageRow,
} from "../infrastructure/book-chapters.repository.js";
import type { BooksRepository } from "../infrastructure/books.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BookChaptersService } from "./book-chapters.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";

function getChapters(rows: BookChapterUsageRow[]) {
  return setup(rows).service.getChapters({ bookId: BOOK_ID, userId: USER_ID });
}

function setup(rows: BookChapterUsageRow[], options: { owned?: boolean } = {}) {
  const findChapterUsage = vi.fn().mockResolvedValue(rows);
  const existsOwned = vi.fn().mockResolvedValue(options.owned ?? true);
  const service = new BookChaptersService(
    { findChapterUsage } as unknown as BookChaptersRepository,
    { existsOwned } as unknown as BooksRepository,
  );

  return { existsOwned, findChapterUsage, service };
}

describe("BookChaptersService.getChapters", () => {
  it("throws the shared book-not-found error when the book is missing or foreign", async () => {
    const { findChapterUsage, service } = setup([], { owned: false });

    await expect(service.getChapters({ bookId: BOOK_ID, userId: USER_ID })).rejects.toThrow(
      NotFoundError,
    );
    expect(findChapterUsage).not.toHaveBeenCalled();
  });

  it("reads only the requested book", async () => {
    const { existsOwned, findChapterUsage, service } = setup([]);

    await service.getChapters({ bookId: BOOK_ID, userId: USER_ID });

    expect(existsOwned).toHaveBeenCalledWith({ bookId: BOOK_ID, userId: USER_ID });
    expect(findChapterUsage).toHaveBeenCalledWith({ bookId: BOOK_ID });
  });

  it("returns an empty array when the book has no chapters", async () => {
    await expect(getChapters([])).resolves.toEqual({ chapters: [] });
  });

  it("merges spellings that differ only by case and sums their counts", async () => {
    const result = await getChapters([
      { chapter: "Розділ 1", count: 3 },
      { chapter: "розділ 1", count: 2 },
      { chapter: "РОЗДІЛ 1", count: 1 },
    ]);

    expect(result).toEqual({ chapters: [{ chapter: "Розділ 1", count: 6 }] });
  });

  it("merges spellings that differ only by surrounding whitespace", async () => {
    const result = await getChapters([
      { chapter: "Розділ 2", count: 1 },
      { chapter: "  Розділ 2  ", count: 4 },
    ]);

    expect(result).toEqual({ chapters: [{ chapter: "Розділ 2", count: 5 }] });
  });

  it("returns the most frequent spelling of a group", async () => {
    const result = await getChapters([
      { chapter: "розділ 7", count: 9 },
      { chapter: "Розділ 7", count: 2 },
    ]);

    expect(result).toEqual({ chapters: [{ chapter: "розділ 7", count: 11 }] });
  });

  it("breaks a spelling tie by the spelling that sorts first", async () => {
    const result = await getChapters([
      { chapter: "розділ 9", count: 5 },
      { chapter: "Розділ 9", count: 5 },
    ]);

    expect(result).toEqual({ chapters: [{ chapter: "Розділ 9", count: 10 }] });
  });

  it("sums the same chapter across notes, quotes and timeline events", async () => {
    const result = await getChapters([
      { chapter: "Розділ 4", count: 2 },
      { chapter: "розділ 4", count: 3 },
      { chapter: "Розділ 4", count: 4 },
    ]);

    expect(result).toEqual({ chapters: [{ chapter: "Розділ 4", count: 9 }] });
  });

  it("drops chapters that are empty or whitespace only", async () => {
    const result = await getChapters([
      { chapter: "", count: 3 },
      { chapter: "   ", count: 5 },
      { chapter: "\t\n", count: 7 },
      { chapter: "Розділ 1", count: 1 },
    ]);

    expect(result).toEqual({ chapters: [{ chapter: "Розділ 1", count: 1 }] });
  });

  it("sorts by count descending then by chapter ascending", async () => {
    const result = await getChapters([
      { chapter: "Епілог", count: 2 },
      { chapter: "Розділ 1", count: 5 },
      { chapter: "Пролог", count: 2 },
      { chapter: "Розділ 2", count: 9 },
    ]);

    expect(result.chapters).toEqual([
      { chapter: "Розділ 2", count: 9 },
      { chapter: "Розділ 1", count: 5 },
      { chapter: "Епілог", count: 2 },
      { chapter: "Пролог", count: 2 },
    ]);
  });

  it("caps the result at the shared maximum, keeping the most used chapters", async () => {
    const rows = Array.from({ length: BOOK_CHAPTER_USAGE_MAX + 50 }, (_unused, index) => ({
      chapter: `Chapter ${index}`,
      count: index + 1,
    }));

    const result = await getChapters(rows);

    expect(result.chapters).toHaveLength(BOOK_CHAPTER_USAGE_MAX);
    expect(result.chapters[0]).toEqual({
      chapter: `Chapter ${BOOK_CHAPTER_USAGE_MAX + 49}`,
      count: BOOK_CHAPTER_USAGE_MAX + 50,
    });
    expect(result.chapters.at(-1)).toEqual({ chapter: "Chapter 50", count: 51 });
  });
});
