import type {
  CustomListCard,
  CustomListsQuery,
  ListsSummaryView,
  MediaView,
  NewListInput,
  Nullable,
  Paginator,
  UpdateListInput,
} from "@app/shared";

import { LIST_NAME_MAX, normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import { toCustomListCard } from "../domain/custom-list-card.mapper.js";
import { toListsSummary } from "../domain/lists-summary.js";
import { type BookListCard, ListsRepository } from "../infrastructure/lists.repository.js";

const LIST_NAME_TAKEN_MESSAGE = "List with this name already exists";
const LIST_NOT_FOUND_MESSAGE = "List not found";
const LIST_COPY_EXHAUSTED_MESSAGE = "Too many copies of this list already exist";

const LIST_COPY = {
  maxAttempts: 50,
  suffix: "копія",
} as const;

export type ListDetailHeader = {
  bookCount: number;
  createdAt: string;
  description: Nullable<string>;
  id: string;
  name: string;
  previewCovers: MediaView[];
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
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async assertOwned({ listId, userId }: AssertOwnedInput): Promise<void> {
    const list = await this.listsRepository.findOwnedById({ id: listId, userId });
    if (list === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }
  }

  countActiveBooks({ listId }: { listId: string }): Promise<number> {
    return this.listsRepository.countItems({ listId });
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

  async duplicate({ listId, userId }: { listId: string; userId: string }): Promise<CustomListCard> {
    const source = await this.listsRepository.findOwnedById({ id: listId, userId });
    if (source === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    return this.transactionRunner.run(async (tx) => {
      await this.listsRepository.acquireCreateLock(userId, tx);

      const name = await this.resolveCopyName({ sourceName: source.name, tx, userId });
      const created = await this.createCopy({ description: source.description, name, tx, userId });
      await this.listsRepository.copyItems({ sourceListId: listId, targetListId: created.id }, tx);

      const card = await this.listsRepository.findOwnedCardById({ listId: created.id, userId }, tx);
      if (card === null) {
        throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
      }
      return this.toCard(card);
    });
  }

  async findCard({ listId, userId }: { listId: string; userId: string }): Promise<CustomListCard> {
    const list = await this.listsRepository.findOwnedCardById({ listId, userId });
    if (list === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }
    return this.toCard(list);
  }

  async findDetailHeader({ listId, userId }: FindDetailHeaderInput): Promise<ListDetailHeader> {
    const list = await this.listsRepository.findOwnedCardById({ listId, userId });
    if (list === null) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    return {
      bookCount: list._count.items,
      createdAt: list.createdAt.toISOString(),
      description: list.description,
      id: list.id,
      name: list.name,
      previewCovers: this.toPreviewCovers(list),
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  async getSummary({ userId }: { userId: string }): Promise<ListsSummaryView> {
    return toListsSummary(await this.listsRepository.summaryCounts({ now: new Date(), userId }));
  }

  async resolveListsForBook(
    { input, userId }: ResolveListsForBookInput,
    client: Prisma.TransactionClient,
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
    const { attention, description, fill, pageNumber, pageSize, search, size, sort } = query;
    const filters = { attention, description, fill, query: search, size };
    const now = new Date();

    const [lists, totalCount] = await Promise.all([
      this.listsRepository.searchOwnedCards({
        ...filters,
        now,
        sort,
        userId,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.listsRepository.countOwned({ ...filters, now, userId }),
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

  private async createCopy({
    description,
    name,
    tx,
    userId,
  }: {
    description: Nullable<string>;
    name: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<BookListCard> {
    try {
      return await this.listsRepository.create(
        { data: { description, name, normalizedName: normalizeName(name) }, userId },
        tx,
      );
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError(LIST_NAME_TAKEN_MESSAGE),
      });
    }
  }

  private async resolveCopyName({
    sourceName,
    tx,
    userId,
  }: {
    sourceName: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<string> {
    for (let attempt = 1; attempt <= LIST_COPY.maxAttempts; attempt += 1) {
      const suffix = attempt === 1 ? ` (${LIST_COPY.suffix})` : ` (${LIST_COPY.suffix} ${attempt})`;
      const candidate = `${sourceName.slice(0, LIST_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
      const taken = await this.listsRepository.findByNormalized(
        { normalizedName: normalizeName(candidate), userId },
        tx,
      );
      if (taken === null) {
        return candidate;
      }
    }
    throw new ConflictError(LIST_COPY_EXHAUSTED_MESSAGE);
  }

  private async resolveOrCreate(
    { newList, userId }: ResolveOrCreateInput,
    client: Prisma.TransactionClient,
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
    return toCustomListCard({ list, previewCovers: this.toPreviewCovers(list) });
  }

  private toPreviewCovers(list: BookListCard): MediaView[] {
    const previewCovers: MediaView[] = [];
    for (const item of list.items) {
      const cover = this.mediaService.buildViewOrNull(item.book.coverMedia);
      if (cover !== null) {
        previewCovers.push(cover);
      }
    }
    return previewCovers;
  }
}
