import type {
  CustomListCard,
  CustomListsQuery,
  MediaView,
  NewListInput,
  Paginator,
  UpdateListInput,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import { toCustomListCard } from "../domain/custom-list-card.mapper.js";
import { type BookListCard, ListsRepository } from "../infrastructure/lists.repository.js";

const LIST_NAME_TAKEN_MESSAGE = "List with this name already exists";
const LIST_NOT_FOUND_MESSAGE = "List not found";

const log = createLogger("lists.service");

export type ListDetailHeader = {
  bookCount: number;
  createdAt: string;
  description: null | string;
  id: string;
  name: string;
  updatedAt: string;
};

type AssertNameAvailableInput = {
  excludeId: string;
  normalizedName: string;
  userId: string;
};

type FindDetailHeaderInput = {
  listId: string;
  userId: string;
};

type ResolveListsInput = {
  listIds?: string[];
  newLists?: NewListInput[];
};

@Injectable()
export class ListsService {
  constructor(
    private readonly listsRepository: ListsRepository,
    private readonly mediaService: MediaService,
  ) {}

  async create(userId: string, input: NewListInput): Promise<CustomListCard> {
    const normalizedName = normalizeName(input.name);
    const existing = await this.listsRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
    }

    try {
      const created = await this.listsRepository.create(userId, {
        description: input.description ?? null,
        name: input.name,
        normalizedName,
      });
      return this.toCard(created);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
    }
  }

  async delete(userId: string, listId: string): Promise<void> {
    const deletedCount = await this.listsRepository.deleteOwned(userId, listId);
    if (deletedCount === 0) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }
  }

  async findDetailHeader({ listId, userId }: FindDetailHeaderInput): Promise<ListDetailHeader> {
    const list = await this.listsRepository.findOwnedById(userId, listId);
    if (list === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    const bookCount = await this.listsRepository.countItems(listId);
    return {
      bookCount,
      createdAt: list.createdAt.toISOString(),
      description: list.description,
      id: list.id,
      name: list.name,
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  async resolveListsForBook(userId: string, input: ResolveListsInput): Promise<string[]> {
    const resolvedIds = new Set<string>();

    const requestedIds = input.listIds ?? [];
    if (requestedIds.length > 0) {
      const owned = await this.listsRepository.findOwnedByIds(userId, requestedIds);
      const ownedIds = new Set(owned.map((list) => list.id));
      for (const requestedId of requestedIds) {
        if (!ownedIds.has(requestedId)) {
          throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
        }
        resolvedIds.add(requestedId);
      }
    }

    for (const newList of input.newLists ?? []) {
      resolvedIds.add(await this.resolveOrCreate(userId, newList));
    }

    return [...resolvedIds];
  }

  async search(userId: string, query: CustomListsQuery): Promise<Paginator<CustomListCard>> {
    const { pageNumber, pageSize, search, sort } = query;

    const [lists, totalCount] = await Promise.all([
      this.listsRepository.searchOwnedCards({
        query: search,
        skip: (pageNumber - 1) * pageSize,
        sort,
        take: pageSize,
        userId,
      }),
      this.listsRepository.countOwned(userId, search),
    ]);

    return buildPaginator({
      items: lists.map((list) => this.toCard(list)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async update(userId: string, listId: string, input: UpdateListInput): Promise<CustomListCard> {
    const current = await this.listsRepository.findOwnedById(userId, listId);
    if (current === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    const normalizedName = normalizeName(input.name);
    await this.assertNameAvailable({ excludeId: listId, normalizedName, userId });

    try {
      const updated = await this.listsRepository.updateOwned(userId, listId, {
        description: input.description ?? null,
        name: input.name,
        normalizedName,
      });
      return this.toCard(updated);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
    }
  }

  private async assertNameAvailable({
    excludeId,
    normalizedName,
    userId,
  }: AssertNameAvailableInput): Promise<void> {
    const existing = await this.listsRepository.findByNormalized(userId, normalizedName);
    if (existing !== null && existing.id !== excludeId) {
      throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
    }
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

  private toCard(list: BookListCard): CustomListCard {
    const previewCovers: MediaView[] = [];
    for (const item of list.items) {
      if (item.book.coverMedia === null) {
        continue;
      }
      try {
        previewCovers.push(this.mediaService.buildView(item.book.coverMedia));
      } catch (error) {
        log.warn({ err: error, listId: list.id }, "failed to build preview cover view");
      }
    }
    return toCustomListCard({ list, previewCovers });
  }
}
