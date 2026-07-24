import type { CustomListBooksQuery, CustomListDetail, ListBookView } from "@app/shared";

import { normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
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
    const search = normalizeSearch(query.search);
    const searchGenreKeys =
      search === undefined
        ? undefined
        : await this.genresService.searchKeys({ query: search, userId });

    const [items, totalCount] = await Promise.all([
      this.listBooksRepository.listBooks({
        listId,
        search,
        searchGenreKeys,
        sort,
        userId,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.listBooksRepository.countBooks({ listId, search, searchGenreKeys, userId }),
    ]);

    const books = buildPaginator({
      items: items.map((item) => this.toListBookView(item)),
      pageNumber,
      pageSize,
      totalCount,
    });

    return { ...header, books };
  }

  private toListBookView(item: BookListItemWithBook): ListBookView {
    return { ...this.viewAssembler.viewOf(item.book), position: item.position };
  }
}
