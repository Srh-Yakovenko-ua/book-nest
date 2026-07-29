import type {
  PaginatedTrashedSeries,
  SeriesDeletionResult,
  SeriesDetailsView,
  TrashedSeriesQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashedSeriesView } from "../domain/trashed-series.mapper.js";
import { SeriesRepository } from "../infrastructure/series.repository.js";
import { SeriesPurgeScheduler } from "./series-purge.scheduler.js";
import { SeriesService } from "./series.service.js";

const SERIES_NOT_FOUND_MESSAGE = "Series not found";

@Injectable()
export class SeriesLifecycleService {
  constructor(
    private readonly seriesRepository: SeriesRepository,
    private readonly seriesService: SeriesService,
    private readonly purgeScheduler: SeriesPurgeScheduler,
  ) {}

  async listTrash({
    query,
    userId,
  }: {
    query: TrashedSeriesQuery;
    userId: string;
  }): Promise<PaginatedTrashedSeries> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.seriesRepository.listTrashed({ skip, take, userId }),
      this.seriesRepository.countTrashed({ userId }),
    ]);

    return buildPaginator({
      items: rows.map(toTrashedSeriesView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async purge({ seriesId, userId }: { seriesId: string; userId: string }): Promise<void> {
    const series = await this.seriesRepository.findForPurge({ seriesId, userId });
    if (series === null || series.deletedAt === null) {
      return;
    }

    await this.seriesRepository.hardDeleteIfTrashed({
      deletedBefore: TRASH_RETENTION.purgeThreshold(new Date()),
      seriesId,
      userId,
    });
  }

  async restore({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<SeriesDetailsView> {
    const restored = await this.seriesRepository.restore({ seriesId, userId });
    if (restored === 0) {
      throw new NotFoundError(SERIES_NOT_FOUND_MESSAGE);
    }

    await this.purgeScheduler.cancel(seriesId);
    return this.seriesService.getById(userId, seriesId);
  }

  async softDelete({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<SeriesDeletionResult> {
    const deletedAt = new Date();
    const affected = await this.seriesRepository.softDelete({ deletedAt, seriesId, userId });
    if (affected === 0) {
      throw new NotFoundError(SERIES_NOT_FOUND_MESSAGE);
    }

    await this.purgeScheduler.schedule({ seriesId, userId });

    return {
      deletedAt: deletedAt.toISOString(),
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
      seriesId,
    };
  }
}
