import type {
  CustomListCard,
  ListDeletionResult,
  PaginatedTrashedLists,
  TrashedListsQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashedListView } from "../domain/trashed-list.mapper.js";
import { ListsRepository } from "../infrastructure/lists.repository.js";
import { ListPurgeScheduler } from "./list-purge.scheduler.js";
import { ListsService } from "./lists.service.js";

const LIST_NOT_FOUND_MESSAGE = "List not found";
const LIST_NAME_TAKEN_MESSAGE = "A list with this name already exists; rename it before restoring";

@Injectable()
export class ListLifecycleService {
  constructor(
    private readonly listsRepository: ListsRepository,
    private readonly listsService: ListsService,
    private readonly purgeScheduler: ListPurgeScheduler,
  ) {}

  async listTrash({
    query,
    userId,
  }: {
    query: TrashedListsQuery;
    userId: string;
  }): Promise<PaginatedTrashedLists> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.listsRepository.listTrashed({ skip, take, userId }),
      this.listsRepository.countTrashed({ userId }),
    ]);

    return buildPaginator({
      items: rows.map(toTrashedListView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async purge({ listId, userId }: { listId: string; userId: string }): Promise<void> {
    const list = await this.listsRepository.findForPurge({ listId, userId });
    if (list === null || list.deletedAt === null) {
      return;
    }

    await this.listsRepository.hardDeleteIfTrashed({
      deletedBefore: TRASH_RETENTION.purgeThreshold(new Date()),
      listId,
      userId,
    });
  }

  async restore({ listId, userId }: { listId: string; userId: string }): Promise<CustomListCard> {
    const restored = await this.restoreRow({ listId, userId });
    if (restored === 0) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    await this.purgeScheduler.cancel(listId);
    return this.listsService.findCard({ listId, userId });
  }

  async softDelete({
    listId,
    userId,
  }: {
    listId: string;
    userId: string;
  }): Promise<ListDeletionResult> {
    const deletedAt = new Date();
    const affected = await this.listsRepository.softDelete({ deletedAt, listId, userId });
    if (affected === 0) {
      throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
    }

    await this.purgeScheduler.schedule({ listId, userId });

    return {
      deletedAt: deletedAt.toISOString(),
      listId,
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
    };
  }

  private async restoreRow({
    listId,
    userId,
  }: {
    listId: string;
    userId: string;
  }): Promise<number> {
    try {
      return await this.listsRepository.restore({ listId, userId });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(LIST_NAME_TAKEN_MESSAGE);
      }
      throw error;
    }
  }
}
