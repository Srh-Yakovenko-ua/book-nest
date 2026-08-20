import type {
  CancelledFollowUpView,
  CancelledFollowUpWishlistResult,
  DeliveryBookPreview,
  Nullable,
} from "@app/shared";

import { CANCELLED_FOLLOW_UP_LIMITS, OwnershipStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { CancelledPlanEntry } from "../domain/cancelled-follow-up.js";
import type {
  CancelledFollowUpPreviewRow,
  UnresolvedCancelledRow,
} from "../infrastructure/cancelled-follow-up.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { MediaService } from "../../media/index.js";
import { ReadingGoalPlansService } from "../../reading-goals/index.js";
import { buildCancelledPlanEntries } from "../domain/cancelled-follow-up.js";
import { cancelledBookOwnership } from "../domain/order-item-transition.js";
import { CancelledFollowUpRepository } from "../infrastructure/cancelled-follow-up.repository.js";
import { OrderBooksRepository } from "../infrastructure/order-books.repository.js";

const UNRESOLVED_OWNERSHIP_STATUS = OwnershipStatusSchema.enum.none;

const WISHLIST_OWNERSHIP = cancelledBookOwnership(true);

@Injectable()
export class CancelledFollowUpService {
  constructor(
    private readonly cancelledFollowUpRepository: CancelledFollowUpRepository,
    private readonly mediaService: MediaService,
    private readonly orderBooksRepository: OrderBooksRepository,
    private readonly readingGoalPlansService: ReadingGoalPlansService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async read({ userId }: { userId: string }): Promise<CancelledFollowUpView> {
    const rows = await this.cancelledFollowUpRepository.listUnresolved(userId);
    if (rows.length === 0) {
      return { plans: null, unresolved: null };
    }

    const [goals, seriesRows] = await Promise.all([
      this.readingGoalPlansService.listActiveMemberships({
        bookIds: rows.map((row) => row.id),
        userId,
      }),
      this.cancelledFollowUpRepository.listSeriesRows({
        seriesIds: [
          ...new Set(rows.flatMap((row) => (row.seriesId === null ? [] : [row.seriesId]))),
        ],
        userId,
      }),
    ]);

    const planEntries = buildCancelledPlanEntries({ goals, rows, seriesRows });
    const visibleRows = rows.slice(0, CANCELLED_FOLLOW_UP_LIMITS.visible);
    const visiblePlans = planEntries.slice(0, CANCELLED_FOLLOW_UP_LIMITS.visible);
    const previews = await this.loadPreviews({
      bookIds: [
        ...new Set([...visibleRows.map((row) => row.id), ...visiblePlans.map((entry) => entry.id)]),
      ],
      userId,
    });

    return {
      plans:
        planEntries.length === 0
          ? null
          : {
              books: visiblePlans.flatMap((entry) => toPlanBook({ entry, previews })),
              booksCount: planEntries.length,
            },
      unresolved: {
        books: visibleRows.flatMap((row) => toUnresolvedBook({ previews, row })),
        booksCount: rows.length,
      },
    };
  }

  returnAllToWishlist({ userId }: { userId: string }): Promise<CancelledFollowUpWishlistResult> {
    const now = new Date();

    return this.transactionRunner.run(async (tx) => {
      const rows = await this.cancelledFollowUpRepository.listUnresolved(userId, tx);
      if (rows.length === 0) {
        return { updatedCount: 0 };
      }

      const updatedCount = await this.orderBooksRepository.applyOwnership(
        {
          bookIds: rows.map((row) => row.id),
          expectedStatus: UNRESOLVED_OWNERSHIP_STATUS,
          now,
          ownershipStatus: WISHLIST_OWNERSHIP.ownershipStatus,
          userId,
        },
        tx,
      );

      return { updatedCount };
    });
  }

  private async loadPreviews({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<Map<string, DeliveryBookPreview>> {
    const rows = await this.cancelledFollowUpRepository.listPreviews({ bookIds, userId });
    return new Map(rows.map((row) => [row.id, this.toBookPreview(row)]));
  }

  private toBookPreview(row: CancelledFollowUpPreviewRow): DeliveryBookPreview {
    return {
      authorName: row.firstAuthorName,
      cover: this.mediaService.buildViewOrNull(row.coverMedia),
      id: row.id,
      title: row.title,
    };
  }
}

function nullableReason(reason: Nullable<string>): Nullable<string> {
  return reason === null || reason.trim() === "" ? null : reason;
}

function toPlanBook({
  entry,
  previews,
}: {
  entry: CancelledPlanEntry;
  previews: Map<string, DeliveryBookPreview>;
}) {
  const preview = previews.get(entry.id);
  return preview === undefined ? [] : [{ ...preview, contexts: entry.contexts }];
}

function toUnresolvedBook({
  previews,
  row,
}: {
  previews: Map<string, DeliveryBookPreview>;
  row: UnresolvedCancelledRow;
}) {
  const preview = previews.get(row.id);
  if (preview === undefined) {
    return [];
  }
  return [
    {
      ...preview,
      cancelledAt: row.cancelledAt.toISOString(),
      cancelReason: nullableReason(row.cancelReason),
    },
  ];
}
