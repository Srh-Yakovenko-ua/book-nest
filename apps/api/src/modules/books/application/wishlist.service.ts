import type {
  Nullable,
  WishlistBookView,
  WishlistFacetsView,
  WishlistQuery,
  WishlistView,
} from "@app/shared";

import { WISHLIST_SORT_DEFAULT } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { SeriesWishlistAnchor } from "../domain/wishlist-counts.js";
import type {
  SeriesWishlistAnchorRow,
  WishlistBookRow,
} from "../infrastructure/books.repository.js";

import { computeBestOffer } from "../domain/best-offer.js";
import { toBookStoreLinkView } from "../domain/book-store-link.mapper.js";
import { computeWishlistCounts } from "../domain/wishlist-counts.js";
import { computeWishlistSummary } from "../domain/wishlist-summary.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

@Injectable()
export class WishlistService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookViewAssembler: BookViewAssembler,
  ) {}

  async getFacets({ userId }: { userId: string }): Promise<WishlistFacetsView> {
    const stores = await this.booksRepository.listWishlistStoreFacets(userId);
    return { stores };
  }

  async getWishlist({
    query = { sort: WISHLIST_SORT_DEFAULT },
    userId,
  }: {
    query?: WishlistQuery;
    userId: string;
  }): Promise<WishlistView> {
    const now = new Date();
    const [rows, totalBooksCount] = await Promise.all([
      this.booksRepository.listWishlistBooks({ now, query, userId }),
      this.booksRepository.countWishlistBooks(userId),
    ]);
    const books = rows.map((row) => this.toWishlistBookView(row));

    const anchorRows = await this.booksRepository.listSeriesWishlistAnchors({
      seriesIds: [...new Set(rows.flatMap((row) => (row.seriesId === null ? [] : [row.seriesId])))],
      userId,
    });

    return {
      books,
      summary: computeWishlistSummary({
        bestOffers: books.map((book) => book.bestOffer),
        counts: computeWishlistCounts({ anchors: toAnchors(anchorRows), books: rows, now }),
        storeNames: rows.flatMap((row) => row.storeLinks.map((link) => link.storeName)),
      }),
      totalBooksCount,
    };
  }

  private toWishlistBookView(row: WishlistBookRow): WishlistBookView {
    return {
      ...this.bookViewAssembler.viewOf(row),
      bestOffer: computeBestOffer({ links: row.storeLinks }),
      storeLinks: row.storeLinks.map(toBookStoreLinkView),
    };
  }
}

function toAnchor(row: SeriesWishlistAnchorRow): Nullable<SeriesWishlistAnchor> {
  if (row.seriesId === null || row.highestPartNumberOutsideWishlist === null) {
    return null;
  }
  return {
    highestPartNumberOutsideWishlist: row.highestPartNumberOutsideWishlist,
    seriesId: row.seriesId,
  };
}

function toAnchors(rows: SeriesWishlistAnchorRow[]): SeriesWishlistAnchor[] {
  return rows.flatMap((row) => toAnchor(row) ?? []);
}
