import type { HomeAttentionGroup, HomeAttentionSource, HomeAttentionView } from "@app/shared";

import { HOME_DASHBOARD_RULES, LOAN_STATS_WINDOWS } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { QueueDeadlineEntry } from "../domain/attention-queue.js";
import type { HomeTemporalContext } from "../domain/home-temporal-context.js";

import { addDaysToUtcDay, toIsoDate } from "../../../core/iso-date.js";
import { createLogger } from "../../../core/logger.js";
import { DeliveryReadService } from "../../delivery/index.js";
import { LoansService } from "../../loans/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalPlansService } from "../../reading-goals/index.js";
import { SeriesOrderCheckService } from "../../series-order-check/index.js";
import { buildDeliveryAttention } from "../domain/attention-delivery.js";
import { buildGoalAttention } from "../domain/attention-goals.js";
import { buildLoanAttention } from "../domain/attention-loans.js";
import { sortAttentionGroups } from "../domain/attention-order.js";
import { buildQueueDeadlineAttention } from "../domain/attention-queue.js";
import { buildReadingStaleAttention } from "../domain/attention-reading.js";
import { buildSeriesOrderAttention } from "../domain/attention-series-order.js";
import { toHomeTemporalContext } from "../domain/home-temporal-context.js";
import { HomeAttentionRepository } from "../infrastructure/home-attention.repository.js";
import { HomeActiveBooksService } from "./home-active-books.service.js";
import { HOME_SOURCE_LIMITS } from "./home-source-limits.js";
import { settleSources } from "./settle-sources.js";

const log = createLogger("home.attention");

@Injectable()
export class HomeAttentionService {
  constructor(
    private readonly activeBooksService: HomeActiveBooksService,
    private readonly attentionRepository: HomeAttentionRepository,
    private readonly deliveryReadService: DeliveryReadService,
    private readonly loansService: LoansService,
    private readonly readingGoalPlansService: ReadingGoalPlansService,
    private readonly seriesOrderCheckService: SeriesOrderCheckService,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async getAttention(userId: string): Promise<HomeAttentionView> {
    const temporal = toHomeTemporalContext(
      await this.userSettingsContextService.calendar({ now: new Date(), userId }),
    );

    const settled = await settleSources<HomeAttentionSource, HomeAttentionGroup[]>([
      { load: () => this.loadDeliveryGroups({ temporal, userId }), source: "deliveries" },
      { load: () => this.loadLoanGroups(userId), source: "loans" },
      { load: () => this.loadGoalGroups({ temporal, userId }), source: "goals" },
      { load: () => this.loadReadingGroups({ temporal, userId }), source: "reading" },
      { load: () => this.loadSeriesOrderGroups(userId), source: "series_order" },
      { load: () => this.loadQueueGroups({ temporal, userId }), source: "queue" },
    ]);

    for (const failure of settled.failures) {
      log.warn({ source: failure.source, userId }, "home attention source unavailable");
    }
    const [firstFailure] = settled.failures;
    if (settled.values.length === 0 && firstFailure !== undefined) {
      throw firstFailure.error;
    }

    return {
      groups: sortAttentionGroups(settled.values.flatMap((value) => value.data)),
      unavailableSources: settled.failures.map((failure) => failure.source),
    };
  }

  private async loadDeliveryGroups({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<HomeAttentionGroup[]> {
    const [summary, readyForPickup] = await Promise.all([
      this.deliveryReadService.inTransitSummary({ userId }),
      this.deliveryReadService.readyForPickupNotExpiring({
        today: temporal.day,
        userId,
        weekStartDay: temporal.weekStartDay,
      }),
    ]);
    return buildDeliveryAttention({ attention: summary.attention, readyForPickup });
  }

  private async loadGoalGroups({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<HomeAttentionGroup[]> {
    const plans = await this.readingGoalPlansService.listGoalPlans({
      timeZone: temporal.timeZone,
      today: temporal.day,
      userId,
    });
    return buildGoalAttention(plans.active);
  }

  private async loadLoanGroups(userId: string): Promise<HomeAttentionGroup[]> {
    const summary = await this.loansService.summary({ userId });
    return buildLoanAttention({ borrowed: summary.borrowed, lent: summary.lent });
  }

  private async loadQueueGroups({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<HomeAttentionGroup[]> {
    const rows = await this.attentionRepository.findQueueDeadlines({
      from: temporal.day,
      to: addDaysToUtcDay({
        day: temporal.day,
        days: HOME_DASHBOARD_RULES.attention.queueDeadlineDays,
      }),
      userId,
    });
    const entries = rows.flatMap((row): QueueDeadlineEntry[] =>
      row.queuePriorityTargetDate === null
        ? []
        : [
            {
              id: row.id,
              queuePriorityReason: row.queuePriorityReason,
              targetDate: toIsoDate(row.queuePriorityTargetDate),
              title: row.title,
            },
          ],
    );
    const loanDueBookIds = await this.attentionRepository.findBorrowedLoanDueBookIds({
      bookIds: entries.map((entry) => entry.id),
      dueBy: addDaysToUtcDay({ day: temporal.day, days: LOAN_STATS_WINDOWS.returnSoonDays }),
      userId,
    });

    return buildQueueDeadlineAttention({
      entries,
      loanDueBookIds: new Set(loanDueBookIds),
      today: temporal.today,
    });
  }

  private async loadReadingGroups({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<HomeAttentionGroup[]> {
    const books = await this.activeBooksService.listActiveBooks(userId);
    return buildReadingStaleAttention({ books, today: temporal.today });
  }

  private async loadSeriesOrderGroups(userId: string): Promise<HomeAttentionGroup[]> {
    const issues = await this.seriesOrderCheckService.listIssues({
      limit: HOME_SOURCE_LIMITS.fullScan,
      userId,
    });
    return buildSeriesOrderAttention(issues.items);
  }
}
