import type {
  HomeGoalSection,
  HomeReadingView,
  HomeReadingWeek,
  HomeSectionUnavailableReason,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { HomeTemporalContext } from "../domain/home-temporal-context.js";

import { createLogger } from "../../../core/logger.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalPlansService } from "../../reading-goals/index.js";
import { ReadingWeekService } from "../../statistics/index.js";
import { buildHomeGoalSection } from "../domain/home-goal-section.js";
import { toHomeTemporalContext } from "../domain/home-temporal-context.js";
import { buildHomeReadingWeek, resolveCalendarWeek } from "../domain/reading-week.js";
import { HomeActiveBooksService } from "./home-active-books.service.js";
import { rethrowWhenAllRejected } from "./settle-sources.js";

type HomeReadingSection = keyof Omit<HomeReadingView, "today">;

type HomeSection<TData> =
  | { data: TData; status: "available" }
  | { reason: HomeSectionUnavailableReason; status: "unavailable" };

const log = createLogger("home.reading");

@Injectable()
export class HomeReadingService {
  constructor(
    private readonly activeBooksService: HomeActiveBooksService,
    private readonly readingGoalPlansService: ReadingGoalPlansService,
    private readonly readingWeekService: ReadingWeekService,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async getReading(userId: string): Promise<HomeReadingView> {
    const temporal = toHomeTemporalContext(
      await this.userSettingsContextService.calendar({ now: new Date(), userId }),
    );

    const [currentlyReading, readingGoal, readingWeek] = await Promise.allSettled([
      this.activeBooksService.loadPage({ cursor: undefined, userId }),
      this.loadGoal({ temporal, userId }),
      this.loadWeek({ temporal, userId }),
    ]);
    rethrowWhenAllRejected([currentlyReading, readingGoal, readingWeek]);

    return {
      currentlyReading: toSection({
        result: currentlyReading,
        section: "currentlyReading",
        userId,
      }),
      readingGoal: toSection({ result: readingGoal, section: "readingGoal", userId }),
      readingWeek: toSection({ result: readingWeek, section: "readingWeek", userId }),
      today: temporal.today,
    };
  }

  private async loadGoal({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<HomeGoalSection> {
    const plans = await this.readingGoalPlansService.listGoalPlans({
      timeZone: temporal.timeZone,
      today: temporal.day,
      userId,
    });
    return buildHomeGoalSection({ plans, today: temporal.today });
  }

  private async loadWeek({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<HomeReadingWeek> {
    const period = resolveCalendarWeek({
      today: temporal.today,
      weekStartDay: temporal.weekStartDay,
    });
    const activity = await this.readingWeekService.loadWeek({
      period,
      today: temporal.today,
      userId,
    });
    return buildHomeReadingWeek({ activity, period, temporal });
  }
}

function toSection<TData>({
  result,
  section,
  userId,
}: {
  result: PromiseSettledResult<TData>;
  section: HomeReadingSection;
  userId: string;
}): HomeSection<TData> {
  if (result.status === "fulfilled") {
    return { data: result.value, status: "available" };
  }
  log.warn({ section, userId }, "home reading section unavailable");
  return { reason: "SOURCE_FAILED", status: "unavailable" };
}
