import type { CustomListBooksQuery, CustomListDetail, ListBookView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { LibraryFilter } from "../infrastructure/book-where.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
import { buildListBookFilter } from "../domain/list-book-filter.js";
import { toListStatusCounts } from "../domain/list-status-counts.js";
import { normalizeSearchQuery } from "../infrastructure/book-search.js";
import {
  type BookListItemWithBook,
  ListBooksRepository,
} from "../infrastructure/list-books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

type DetailInput = {
  listId: string;
  query: CustomListBooksQuery;
  userId: string;
};

type ListBookViewInput = {
  item: BookListItemWithBook;
  positionRanks: Map<string, number> | undefined;
};

@Injectable()
export class ListDetailsService {
  constructor(
    private readonly listsService: ListsService,
    private readonly listBooksRepository: ListBooksRepository,
    private readonly genresService: GenresService,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async detail({ listId, query, userId }: DetailInput): Promise<CustomListDetail> {
    const header = await this.listsService.findDetailHeader({ listId, userId });

    const { pageNumber, pageSize, sort } = query;
    const search = normalizeSearchQuery(query.search);
    const searchGenreKeys =
      search === undefined
        ? undefined
        : await this.genresService.searchKeys({ query: search, userId });

    const filter = buildListBookFilter({ query, search, searchGenreKeys, userId });
    const tabCountsFilter: LibraryFilter = { ...filter, readingStatuses: undefined };
    const narrowedByStatus = filter.readingStatuses !== undefined;

    const [items, tabCounts, narrowedCount, positionRanks] = await Promise.all([
      this.listBooksRepository.listBooks({
        filter,
        listId,
        sort,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.listBooksRepository.countByTab({ filter: tabCountsFilter, listId }),
      narrowedByStatus
        ? this.listBooksRepository.countBooks({ filter, listId })
        : Promise.resolve(undefined),
      sort === "position"
        ? this.listBooksRepository.listPositionRanks({ listId, userId })
        : Promise.resolve(undefined),
    ]);

    const books = buildPaginator({
      items: items.map((item) => this.toListBookView({ item, positionRanks })),
      pageNumber,
      pageSize,
      totalCount: narrowedCount ?? tabCounts.all,
    });

    return { ...header, books, statusCounts: toListStatusCounts(tabCounts) };
  }

  private toListBookView({ item, positionRanks }: ListBookViewInput): ListBookView {
    return {
      ...this.viewAssembler.viewOf(item.book),
      position: positionRanks?.get(item.bookId) ?? item.position,
    };
  }
}
