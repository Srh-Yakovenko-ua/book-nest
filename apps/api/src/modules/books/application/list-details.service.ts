import type { CustomListBooksQuery, CustomListDetail, ListBookView } from "@app/shared";

import { collapseSpaces } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { buildPaginator } from "../../../core/paginator.js";
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
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async detail({ listId, query, userId }: DetailInput): Promise<CustomListDetail> {
    const header = await this.listsService.findDetailHeader({ listId, userId });

    const { pageNumber, pageSize, sort } = query;
    const search = normalizeSearch(query.search);

    const [items, totalCount] = await Promise.all([
      this.listBooksRepository.listBooks({
        listId,
        search,
        skip: (pageNumber - 1) * pageSize,
        sort,
        take: pageSize,
        userId,
      }),
      this.listBooksRepository.countBooks({ listId, search, userId }),
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

function normalizeSearch(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const collapsed = collapseSpaces(value);
  return collapsed.length === 0 ? undefined : collapsed;
}
