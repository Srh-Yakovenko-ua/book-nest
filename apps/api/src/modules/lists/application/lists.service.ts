import type {
  BookListView,
  NewListInput,
  Paginator,
  TaxonomySearchPaginationQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toBookListView } from "../domain/book-list.mapper.js";
import { ListsRepository } from "../infrastructure/lists.repository.js";

type ResolveListsInput = {
  listIds?: string[];
  newLists?: NewListInput[];
};

@Injectable()
export class ListsService {
  constructor(private readonly listsRepository: ListsRepository) {}

  async resolveListsForBook(userId: string, input: ResolveListsInput): Promise<string[]> {
    const resolvedIds = new Set<string>();

    const requestedIds = input.listIds ?? [];
    if (requestedIds.length > 0) {
      const owned = await this.listsRepository.findOwnedByIds(userId, requestedIds);
      const ownedIds = new Set(owned.map((list) => list.id));
      for (const requestedId of requestedIds) {
        if (!ownedIds.has(requestedId)) {
          throw new NotFoundError("List not found");
        }
        resolvedIds.add(requestedId);
      }
    }

    for (const newList of input.newLists ?? []) {
      resolvedIds.add(await this.resolveOrCreate(userId, newList));
    }

    return [...resolvedIds];
  }

  async search(
    userId: string,
    query: TaxonomySearchPaginationQuery,
  ): Promise<Paginator<BookListView>> {
    const { pageNumber, pageSize, search } = query;

    const [lists, totalCount] = await Promise.all([
      this.listsRepository.searchOwned({
        query: search,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        userId,
      }),
      this.listsRepository.countOwned(userId, search),
    ]);

    return buildPaginator({
      items: lists.map(toBookListView),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  private async resolveOrCreate(userId: string, newList: NewListInput): Promise<string> {
    const normalizedName = normalizeName(newList.name);
    const existing = await this.listsRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      return existing.id;
    }

    try {
      const created = await this.listsRepository.create(userId, {
        description: newList.description ?? null,
        name: newList.name,
        normalizedName,
      });
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.listsRepository.findByNormalized(userId, normalizedName);
      if (winner === null) {
        throw error;
      }
      return winner.id;
    }
  }
}
