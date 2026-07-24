import type { BookView, DedicationsQuery, DedicationsSummaryView, Paginator } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import { normalizeSearchQuery } from "../infrastructure/book-search.js";
import { BooksRepository, type DedicationsFilter } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

@Injectable()
export class DedicationsService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookViewAssembler: BookViewAssembler,
    private readonly genresService: GenresService,
  ) {}

  async getDedications({
    query,
    userId,
  }: {
    query: DedicationsQuery;
    userId: string;
  }): Promise<Paginator<BookView>> {
    const { pageNumber, pageSize, sort } = query;
    const search = normalizeSearchQuery(query.q);
    const searchGenreKeys =
      search === undefined
        ? undefined
        : await this.genresService.searchKeys({ query: search, userId });

    const filter: DedicationsFilter = {
      filter: query.filter,
      genreKey: query.genre,
      search,
      searchGenreKeys,
      userId,
    };

    const [books, totalCount] = await Promise.all([
      this.booksRepository.listDedicationsForQuery({
        filter,
        sort,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.booksRepository.countDedicationsForQuery({ filter }),
    ]);

    return buildPaginator({
      items: books.map((book) => this.bookViewAssembler.viewOf(book)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  getDedicationsSummary({ userId }: { userId: string }): Promise<DedicationsSummaryView> {
    return this.booksRepository.dedicationsSummary({ userId });
  }
}
