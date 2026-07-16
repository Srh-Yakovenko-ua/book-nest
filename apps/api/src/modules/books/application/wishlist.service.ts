import type { WishlistBookView, WishlistView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { computeBestOffer } from "../domain/best-offer.js";
import { toBookStoreLinkView } from "../domain/book-store-link.mapper.js";
import { computeWishlistSummary } from "../domain/wishlist-summary.js";
import { BooksRepository, type WishlistBookRow } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

@Injectable()
export class WishlistService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookViewAssembler: BookViewAssembler,
  ) {}

  async getWishlist({ userId }: { userId: string }): Promise<WishlistView> {
    const rows = await this.booksRepository.listWishlistBooks({ userId });
    const books = rows.map((row) => this.toWishlistBookView(row));

    return {
      books,
      summary: computeWishlistSummary({
        bestOffers: books.map((book) => book.bestOffer),
        storeNames: rows.flatMap((row) => row.storeLinks.map((link) => link.storeName)),
      }),
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
