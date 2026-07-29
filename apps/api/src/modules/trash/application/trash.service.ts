import type { PaginatedTrash, TrashEntityType, TrashQuery, TrashSummaryView } from "@app/shared";

import { TrashEntityTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashItemView } from "../domain/trash-item.mapper.js";
import { TrashRepository } from "../infrastructure/trash.repository.js";

@Injectable()
export class TrashService {
  constructor(private readonly trashRepository: TrashRepository) {}

  async list({ query, userId }: { query: TrashQuery; userId: string }): Promise<PaginatedTrash> {
    const { skip, take } = pageSlice(query);
    const [rows, counts] = await Promise.all([
      this.trashRepository.list({ entityType: query.entityType, skip, take, userId }),
      this.trashRepository.countByType({ userId }),
    ]);

    const countsByType = this.groupCounts(counts);
    const totalCount =
      query.entityType === undefined
        ? Object.values(countsByType).reduce((total, count) => total + count, 0)
        : (countsByType[query.entityType] ?? 0);

    return buildPaginator({
      items: rows.map(toTrashItemView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async summary({ userId }: { userId: string }): Promise<TrashSummaryView> {
    const countsByType = this.groupCounts(await this.trashRepository.countByType({ userId }));

    return {
      countsByType,
      retentionDays: TRASH_RETENTION.days,
      totalCount: Object.values(countsByType).reduce((total, count) => total + count, 0),
    };
  }

  private groupCounts(
    rows: { count: number; entityType: string }[],
  ): Partial<Record<TrashEntityType, number>> {
    const counts: Partial<Record<TrashEntityType, number>> = {};
    for (const row of rows) {
      counts[TrashEntityTypeSchema.parse(row.entityType)] = row.count;
    }
    return counts;
  }
}
