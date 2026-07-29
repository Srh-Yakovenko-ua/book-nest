import type { PaginatedTrashedTimelines, TrashedTimelinesQuery } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashedTimelineView } from "../domain/trashed-timeline.mapper.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";
import { TimelinePurgeScheduler } from "./timeline-purge.scheduler.js";

const TIMELINE_NOT_FOUND_MESSAGE = "Timeline not found";

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
    const restored = await this.timelineRepository.restore({ timelineId, userId });
    if (restored === 0) {
      throw new NotFoundError(TIMELINE_NOT_FOUND_MESSAGE, {
        code: TIMELINE_ERROR_CODES.timelineNotFound,
      });
    }

    await this.purgeScheduler.cancel(timelineId);
  }
}
