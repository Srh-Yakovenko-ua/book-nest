import type {
  BookView,
  DedicationsQuery,
  DedicationsQuickCounts,
  DedicationsQuickCountsQuery,
  DedicationsSummaryView,
  Paginator,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { DedicationsBaseFilter } from "../domain/dedications-quick-counts.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import {
  buildDedicationsBaseFilter,
  buildDedicationsQuickCountFilters,
} from "../domain/dedications-quick-counts.js";
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
    const base = await this.resolveBaseFilter({ query, userId });
    const filter: DedicationsFilter = { ...base, filter: query.filter };

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

  async getDedicationsQuickCounts({
    query,
    userId,
  }: {
    query: DedicationsQuickCountsQuery;
    userId: string;
  }): Promise<DedicationsQuickCounts> {
    const base = await this.resolveBaseFilter({ query, userId });
    return this.booksRepository.countDedicationQuickFilters({
      filters: buildDedicationsQuickCountFilters(base),
    });
  }

  getDedicationsSummary({ userId }: { userId: string }): Promise<DedicationsSummaryView> {
    return this.booksRepository.dedicationsSummary({ userId });
  }

  private async resolveBaseFilter({
    query,
    userId,
  }: {
    query: DedicationsQuickCountsQuery;
    userId: string;
  }): Promise<DedicationsBaseFilter> {
    const search = normalizeSearchQuery(query.q);
    const searchGenreKeys =
      search === undefined ? undefined : await this.genresService.searchKeys(search);
    return buildDedicationsBaseFilter({ query, search, searchGenreKeys, userId });
  }
}
