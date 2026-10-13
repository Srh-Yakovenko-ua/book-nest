import type { BookChaptersView, BookChapterUsageView } from "@app/shared";

import { BOOK_CHAPTER_USAGE_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { BookChapterUsageRow } from "../infrastructure/book-chapters.repository.js";

import { BookChaptersRepository } from "../infrastructure/book-chapters.repository.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { assertBookOwned } from "./assert-book-owned.js";

type ChapterGroup = {
  count: number;
  spellings: SpellingCounts;
};

type SpellingCounts = Map<string, number>;

@Injectable()
export class BookChaptersService {
  constructor(
    private readonly bookChaptersRepository: BookChaptersRepository,
    private readonly booksRepository: BooksRepository,
  ) {}

  async getChapters({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookChaptersView> {
    await assertBookOwned({ bookId, booksRepository: this.booksRepository, userId });
    const rows = await this.bookChaptersRepository.findChapterUsage({ bookId });
    return { chapters: mergeChapterUsage(rows) };
  }
}

function compareChapterUsage(left: BookChapterUsageView, right: BookChapterUsageView): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  if (left.chapter === right.chapter) {
    return 0;
  }
  return left.chapter < right.chapter ? -1 : 1;
}

function groupBySpelling(rows: BookChapterUsageRow[]): ChapterGroup[] {
  const groups = new Map<string, ChapterGroup>();

  for (const row of rows) {
    const chapter = row.chapter.trim();
    if (chapter.length === 0) {
      continue;
    }
    const key = chapter.toLowerCase();
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += row.count;
    group.spellings.set(chapter, (group.spellings.get(chapter) ?? 0) + row.count);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function mergeChapterUsage(rows: BookChapterUsageRow[]): BookChapterUsageView[] {
  return groupBySpelling(rows)
    .map((group) => ({ chapter: pickDominantSpelling(group.spellings), count: group.count }))
    .sort(compareChapterUsage)
    .slice(0, BOOK_CHAPTER_USAGE_MAX);
}

function pickDominantSpelling(spellings: SpellingCounts): string {
  let dominant = "";
  let dominantCount = -1;

  for (const [spelling, count] of spellings) {
    if (count > dominantCount || (count === dominantCount && spelling < dominant)) {
      dominant = spelling;
      dominantCount = count;
    }
  }

  return dominant;
}
