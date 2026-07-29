import type {
  CustomListCard,
  CustomListsQuery,
  MediaView,
  NewListInput,
  Nullable,
  Paginator,
  UpdateListInput,
} from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import { toCustomListCard } from "../domain/custom-list-card.mapper.js";
import { type BookListCard, ListsRepository } from "../infrastructure/lists.repository.js";

const LIST_NAME_TAKEN_MESSAGE = "List with this name already exists";
const LIST_NOT_FOUND_MESSAGE = "List not found";

export type ListDetailHeader = {
  bookCount: number;
  createdAt: string;
  description: Nullable<string>;
  id: string;
  name: string;
  updatedAt: string;
};

type AssertNameAvailableInput = {
  excludeId: string;
  normalizedName: string;
  userId: string;
};

type AssertOwnedInput = {
  listId: string;
  userId: string;
};

type CreateInput = {
  input: NewListInput;
  userId: string;
};

type FindDetailHeaderInput = {
  listId: string;
  userId: string;
};

type ResolveListsForBookInput = {
  input: ResolveListsInput;
  userId: string;
};

type ResolveListsInput = {
  listIds?: string[];
  newLists?: NewListInput[];
};

type ResolveOrCreateInput = {
  newList: NewListInput;
  userId: string;
};

type SearchInput = {
  query: CustomListsQuery;
  userId: string;
};

type UpdateInput = {
  input: UpdateListInput;
  listId: string;
  userId: string;
};

@Injectable()
export class ListsService {
  constructor(
    private readonly listsRepository: ListsRepository,
    private readonly mediaService: MediaService,
  ) {}

  async assertOwned({ listId, userId }: AssertOwnedInput): Promise<void> {
    const list = await this.listsRepository.findOwnedById({ id: listId, userId });
    if (list === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }
  }

  async create({ input, userId }: CreateInput): Promise<CustomListCard> {
    const normalizedName = normalizeName(input.name);
    const existing = await this.listsRepository.findByNormalized({ normalizedName, userId });
    if (existing !== null) {
      throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
    }

    try {
      const created = await this.listsRepository.create({
        data: {
          description: input.description ?? null,
          name: input.name,
          normalizedName,
        },
        userId,
      });
      return this.toCard(created);
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError(LIST_NAME_TAKEN_MESSAGE),
      });
    }
  }

  async findCard({ listId, userId }: { listId: string; userId: string }): Promise<CustomListCard> {
    const list = await this.listsRepository.findOwnedCardById({ listId, userId });
    if (list === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }
    return this.toCard(list);
  }

  async findDetailHeader({ listId, userId }: FindDetailHeaderInput): Promise<ListDetailHeader> {
    const list = await this.listsRepository.findOwnedById({ id: listId, userId });
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

  async resolveListsForBook(
    { input, userId }: ResolveListsForBookInput,
    client?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const resolvedIds = new Set<string>();

    const requestedIds = input.listIds ?? [];
    if (requestedIds.length > 0) {
      const owned = await this.listsRepository.findOwnedByIds(
        { ids: requestedIds, userId },
        client,
      );
      const ownedIds = new Set(owned.map((list) => list.id));
      for (const requestedId of requestedIds) {
        if (!ownedIds.has(requestedId)) {
          throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
        }
        resolvedIds.add(requestedId);
      }
    }

    for (const newList of input.newLists ?? []) {
      resolvedIds.add(await this.resolveOrCreate({ newList, userId }, client));
    }

    return [...resolvedIds];
  }

  async search({ query, userId }: SearchInput): Promise<Paginator<CustomListCard>> {
    const { pageNumber, pageSize, search, sort } = query;

    const [lists, totalCount] = await Promise.all([
      this.listsRepository.searchOwnedCards({
        query: search,
        sort,
        userId,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.listsRepository.countOwned({ query: search, userId }),
    ]);

    return buildPaginator({
      items: lists.map((list) => this.toCard(list)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async update({ input, listId, userId }: UpdateInput): Promise<CustomListCard> {
    const current = await this.listsRepository.findOwnedById({ id: listId, userId });
    if (current === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    const normalizedName = normalizeName(input.name);
    await this.assertNameAvailable({ excludeId: listId, normalizedName, userId });

    try {
      const updated = await this.listsRepository.updateOwned({
        data: {
          description: input.description ?? null,
          name: input.name,
          normalizedName,
        },
        id: listId,
        userId,
      });
      return this.toCard(updated);
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError(LIST_NAME_TAKEN_MESSAGE),
      });
    }
  }

  private async assertNameAvailable({
    excludeId,
    normalizedName,
    userId,
  }: AssertNameAvailableInput): Promise<void> {
    const existing = await this.listsRepository.findByNormalized({ normalizedName, userId });
    if (existing !== null && existing.id !== excludeId) {
      throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
    }
  }

  private async resolveOrCreate(
    { newList, userId }: ResolveOrCreateInput,
    client?: Prisma.TransactionClient,
  ): Promise<string> {
    const normalizedName = normalizeName(newList.name);
    await this.listsRepository.acquireCreateLock(userId, client);
    const existing = await this.listsRepository.findByNormalized(
      { normalizedName, userId },
      client,
    );
    if (existing !== null) {
      return existing.id;
    }

    const created = await this.listsRepository.createByNormalized(
      {
        data: {
          description: newList.description ?? null,
          name: newList.name,
          normalizedName,
        },
        userId,
      },
      client,
    );
    return created.id;
  }

  private toCard(list: BookListCard): CustomListCard {
    const previewCovers: MediaView[] = [];
    for (const item of list.items) {
      const cover = this.mediaService.buildViewOrNull(item.book.coverMedia);
      if (cover !== null) {
        previewCovers.push(cover);
      }
    }
    return toCustomListCard({ list, previewCovers });
  }
}
