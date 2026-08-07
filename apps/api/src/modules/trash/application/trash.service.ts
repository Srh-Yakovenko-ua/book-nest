import type { PaginatedTrash, TrashEntityType, TrashQuery, TrashSummaryView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashItemView } from "../domain/trash-item.mapper.js";
import { type TrashCountRow, TrashRepository } from "../infrastructure/trash.repository.js";

const EMPTY_TRASH_COUNTS = {
  book: 0,
  book_list: 0,
  character: 0,
  note: 0,
  quote: 0,
  series: 0,
  timeline: 0,
} satisfies Record<TrashEntityType, number>;

@Injectable()
export class TrashService {
  constructor(private readonly trashRepository: TrashRepository) {}

  async list({ query, userId }: { query: TrashQuery; userId: string }): Promise<PaginatedTrash> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.trashRepository.list({ entityType: query.entityType, skip, take, userId }),
      this.trashRepository.count({ entityType: query.entityType, userId }),
    ]);

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
      totalCount: sumCounts(countsByType),
    };
  }

  private groupCounts(rows: TrashCountRow[]): Record<TrashEntityType, number> {
    const counts = { ...EMPTY_TRASH_COUNTS };
    for (const row of rows) {
      counts[row.entityType] = row.count;
    }
    return counts;
  }
}

function sumCounts(counts: Record<TrashEntityType, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}
