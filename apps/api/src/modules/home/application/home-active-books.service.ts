import type { HomeActiveBook, HomeActiveBooksPage } from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { ActiveBookEntry } from "../domain/active-book.mapper.js";

import { decodeActiveBookCursor, encodeActiveBookCursor } from "../domain/active-book-cursor.js";
import { sortActiveBooks, takeActiveBooksPage } from "../domain/active-book-order.js";
import { toActiveBookEntry, toHomeActiveBook } from "../domain/active-book.mapper.js";
import { HomeActiveBooksRepository } from "../infrastructure/home-active-books.repository.js";
import { HomeBookFactsLoader } from "./home-book-facts.loader.js";

@Injectable()
export class HomeActiveBooksService {
  constructor(
    private readonly activeBooksRepository: HomeActiveBooksRepository,
    private readonly bookFactsLoader: HomeBookFactsLoader,
  ) {}

  async listActiveBooks(userId: string): Promise<ActiveBookEntry[]> {
    const rows = await this.activeBooksRepository.findActiveBookKeys(userId);
    return sortActiveBooks(rows.map(toActiveBookEntry));
  }

  async loadPage({
    cursor,
    userId,
  }: {
    cursor: string | undefined;
    userId: string;
  }): Promise<HomeActiveBooksPage> {
    const ordered = await this.listActiveBooks(userId);
    const page = takeActiveBooksPage({
      after: decodeActiveBookCursor(cursor),
      ordered,
      pageSize: HOME_DASHBOARD_RULES.activeBooks.pageSize,
    });
    const factsById = await this.bookFactsLoader.loadFacts({
      bookIds: page.items.map((entry) => entry.id),
      userId,
    });

    const items = page.items.flatMap((entry): HomeActiveBook[] => {
      const facts = factsById.get(entry.id);
      if (facts === undefined) {
        return [];
      }
      const book = toHomeActiveBook({ facts, lastProgressAt: entry.lastProgressAt });
      return book === null ? [] : [book];
    });

    return {
      items,
      nextCursor: page.nextCursor === null ? null : encodeActiveBookCursor(page.nextCursor),
      total: ordered.length,
    };
  }
}
