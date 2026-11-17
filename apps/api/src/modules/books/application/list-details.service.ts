import type { BookView, CustomListBooksQuery, CustomListDetail, ListBookView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
import {
  buildListBookFilter,
  clearQuickFilterAxes,
  hasQuickFilterAxis,
} from "../domain/list-book-filter.js";
import { toListQuickCountsView } from "../domain/list-quick-counts.js";
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
  bookView: BookView;
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
      search === undefined ? undefined : await this.genresService.searchKeys(search);

    const filter = buildListBookFilter({ query, search, searchGenreKeys, userId });
    const narrowedByQuickFilter = hasQuickFilterAxis(filter);

    const [items, quickCounts, narrowedCount, positionRanks, toBookView] = await Promise.all([
      this.listBooksRepository.listBooks({
        filter,
        listId,
        sort,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.listBooksRepository.countQuickFilters({
        filter: clearQuickFilterAxes(filter),
        listId,
      }),
      narrowedByQuickFilter
        ? this.listBooksRepository.countBooks({ filter, listId })
        : Promise.resolve(undefined),
      sort === "position"
        ? this.listBooksRepository.listPositionRanks({ listId, userId })
        : Promise.resolve(undefined),
      this.viewAssembler.forUser(userId),
    ]);

    const books = buildPaginator({
      items: items.map((item) =>
        toListBookView({ bookView: toBookView(item.book), item, positionRanks }),
      ),
      pageNumber,
      pageSize,
      totalCount: narrowedCount ?? quickCounts.all,
    });

    return { ...header, books, quickCounts: toListQuickCountsView(quickCounts) };
  }
}

function toListBookView({ bookView, item, positionRanks }: ListBookViewInput): ListBookView {
  return {
    ...bookView,
    position: positionRanks?.get(item.bookId) ?? item.position,
  };
}
