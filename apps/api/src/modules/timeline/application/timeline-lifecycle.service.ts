import type { PaginatedTrashedTimelines, TrashedTimelinesQuery } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashedTimelineView } from "../domain/trashed-timeline.mapper.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";
import { TimelinePurgeScheduler } from "./timeline-purge.scheduler.js";

const TIMELINE_NOT_FOUND_MESSAGE = "Timeline not found";
const TIMELINE_NAME_TAKEN_MESSAGE =
  "A timeline with this name already exists for this book; rename it before restoring";

@Injectable()
export class TimelineLifecycleService {
  constructor(
    private readonly timelineRepository: TimelineRepository,
    private readonly purgeScheduler: TimelinePurgeScheduler,
  ) {}

  async listTrash({
    query,
    userId,
  }: {
    query: TrashedTimelinesQuery;
    userId: string;
  }): Promise<PaginatedTrashedTimelines> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.timelineRepository.listTrashed({ skip, take, userId }),
      this.timelineRepository.countTrashed({ userId }),
    ]);

    return buildPaginator({
      items: rows.map(toTrashedTimelineView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async purge({ timelineId, userId }: { timelineId: string; userId: string }): Promise<void> {
    const timeline = await this.timelineRepository.findForPurge({ timelineId, userId });
    if (timeline === null || timeline.deletedAt === null) {
      return;
    }

    await this.timelineRepository.hardDeleteIfTrashed({
      deletedBefore: TRASH_RETENTION.purgeThreshold(new Date()),
      timelineId,
      userId,
    });
  }

  async restore({ timelineId, userId }: { timelineId: string; userId: string }): Promise<void> {
    const restored = await this.restoreRow({ timelineId, userId });
    if (restored === 0) {
      throw new NotFoundError(TIMELINE_NOT_FOUND_MESSAGE, {
        code: TIMELINE_ERROR_CODES.timelineNotFound,
      });
    }

    await this.purgeScheduler.cancel(timelineId);
  }

  private async restoreRow({
    timelineId,
    userId,
  }: {
    timelineId: string;
    userId: string;
  }): Promise<number> {
    try {
      return await this.timelineRepository.restore({ timelineId, userId });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(TIMELINE_NAME_TAKEN_MESSAGE, {
          code: TIMELINE_ERROR_CODES.duplicateName,
        });
      }
      throw error;
    }
  }
}
