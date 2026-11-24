import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import {
  makeReadingGoalActivity,
  makeReadingGoalCheckpoint,
  makeReadingGoalDetail,
} from "../model/reading-goals.fixtures";
import { GoalOverviewTab } from "./goal-overview-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const overview = messages.goals.detail.overview;

const translateOverview = createTranslator({
  locale: "uk",
  messages,
  namespace: "goals.detail.overview",
});

const FORECAST_ILLUSTRATION = "goal-forecast-insufficient-data.png";

const fetchMock = vi.fn();
const onShowActivity = vi.fn();
const onShowRemainingBooks = vi.fn();

const SIX_CHECKPOINTS = [
  makeReadingGoalCheckpoint({
    achievedAt: "2026-09-10",
    currentCompletedCount: 2,
    dueDate: "2026-09-15",
    status: "achieved",
    targetCount: 1,
  }),
  makeReadingGoalCheckpoint({
    achievedAt: "2026-10-03",
    currentCompletedCount: 2,
    dueDate: "2026-09-30",
    status: "missed",
    targetCount: 2,
  }),
  makeReadingGoalCheckpoint({
    currentCompletedCount: 2,
    dueDate: "2026-10-15",
    status: "missed",
    targetCount: 3,
  }),
  makeReadingGoalCheckpoint({ currentCompletedCount: 2, dueDate: "2026-10-31", targetCount: 4 }),
  makeReadingGoalCheckpoint({ currentCompletedCount: 2, dueDate: "2026-11-15", targetCount: 5 }),
  makeReadingGoalCheckpoint({ currentCompletedCount: 2, dueDate: "2026-11-30", targetCount: 6 }),
];

const FOUR_EVENTS = ["Бігуни", "Книга Якова", "Правік", "Диб'я"].map((title, index) =>
  makeReadingGoalActivity({
    book: { id: `book-${index + 1}`, title },
    id: `activity-${index + 1}`,
  }),
);

function renderOverview(overrides: Parameters<typeof makeReadingGoalDetail>[0] = {}) {
  return renderWithProviders(
    <GoalOverviewTab
      goal={makeReadingGoalDetail(overrides)}
      onShowActivity={onShowActivity}
      onShowRemainingBooks={onShowRemainingBooks}
    />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    if (String(input).includes("/api/profile/settings")) {
      return Promise.resolve(
        new Response(JSON.stringify(defaultUserProfileSettings), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalOverviewTab pace and forecast", () => {
  it("gives the current and the required pace as one book every so many days", () => {
    renderOverview({
      actualBooksPerDay: 0.2,
      averageDaysPerBook: 5,
      requiredBooksPerDay: 0.23,
      requiredDaysPerBook: 4.3,
    });

    expect(
      screen.getByText(translateOverview("pace.daysPerBook", { count: 5 })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("pace.daysPerBook", { count: 4.3 })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("pace.booksPerDay", { count: 0.2 })),
    ).toBeInTheDocument();
  });

  it("says there is too little data instead of a zero pace", () => {
    renderOverview({ actualBooksPerDay: 0, averageDaysPerBook: null });

    expect(screen.getByText(overview.pace.noData)).toBeInTheDocument();
    expect(
      screen.queryByText(translateOverview("pace.booksPerDay", { count: 0 })),
    ).not.toBeInTheDocument();
  });

  it("dates a late forecast, says how far past the deadline it lands and how sure it is", () => {
    renderOverview({
      completedCount: 2,
      projectedCompletionDate: "2027-01-15",
      projectedDaysDelta: -15,
      projectionConfidence: "medium",
    });

    expect(screen.getByText("15 січня 2027 р.")).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("projection.late", { count: 15 })),
    ).toBeInTheDocument();
    expect(screen.getByText(overview.projection.confidence.medium)).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("projection.basis", { count: 2 })),
    ).toBeInTheDocument();
  });

  it.each(["none", "low"] as const)(
    "keeps a %s-confidence forecast to a short note without a date",
    (projectionConfidence) => {
      renderOverview({ projectedCompletionDate: "2026-11-25", projectionConfidence });

      expect(screen.getByText(overview.projection.insufficient)).toBeInTheDocument();
      expect(screen.queryByText("25 листопада 2026 р.")).not.toBeInTheDocument();
      expect(screen.queryByText(overview.projection.title)).not.toBeInTheDocument();
    },
  );
});

describe("GoalOverviewTab state", () => {
  it("states in one line that nothing is at risk", () => {
    renderOverview({ riskLevel: "none", riskReasons: [] });

    expect(screen.getByText(overview.risk.none)).toBeInTheDocument();
    expect(screen.queryByText(overview.risk.nextStep)).not.toBeInTheDocument();
  });

  it("explains a projected delay on a goal whose pace is still on track", () => {
    renderOverview({
      pace: "on_track",
      projectedDaysDelta: -15,
      riskLevel: "high",
      riskReasons: ["projected_late"],
    });

    expect(screen.getByText(messages.goals.risk.high)).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("risk.reasons.projected_late", { count: 15 })),
    ).toBeInTheDocument();
    expect(screen.getByText(overview.risk.onTrackProjectedLate)).toBeInTheDocument();
  });

  it("names a projected delay without a day count when the forecast gives none", () => {
    renderOverview({
      projectedDaysDelta: null,
      riskLevel: "medium",
      riskReasons: ["projected_late"],
    });

    expect(screen.getByText(overview.risk.projectedLateUnknown)).toBeInTheDocument();
  });

  it("suggests the required pace as the next step for a goal at risk", () => {
    renderOverview({
      requiredDaysPerBook: 12.7,
      riskLevel: "medium",
      riskReasons: ["behind_schedule"],
    });

    expect(
      screen.getByText(translateOverview("risk.requiredRate", { count: 12.7 })),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: overview.risk.showRemaining }),
    ).not.toBeInTheDocument();
  });

  it("sends the reader to the remaining books when no required pace is known", async () => {
    renderOverview({
      requiredDaysPerBook: null,
      riskLevel: "high",
      riskReasons: ["deadline_soon"],
    });

    await userEvent.click(screen.getByRole("button", { name: overview.risk.showRemaining }));

    expect(onShowRemainingBooks).toHaveBeenCalledTimes(1);
  });
});

describe("GoalOverviewTab checkpoints", () => {
  it("keeps a checkpoint that was never reached as missed", () => {
    renderOverview({
      checkpoints: [
        makeReadingGoalCheckpoint({
          achievedAt: null,
          currentCompletedCount: 3,
          dueDate: "2026-10-15",
          status: "missed",
          targetCount: 4,
        }),
      ],
    });

    expect(screen.getByText(overview.checkpoints.status.missed)).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("checkpoints.current", { current: 3, target: 4 })),
    ).toBeInTheDocument();
    expect(screen.queryByText(overview.checkpoints.status.achieved)).not.toBeInTheDocument();
    expect(screen.queryByText(overview.checkpoints.status.achieved_late)).not.toBeInTheDocument();
  });

  it("marks a checkpoint reached on its due date as achieved", () => {
    renderOverview({
      checkpoints: [
        makeReadingGoalCheckpoint({
          achievedAt: "2026-10-15",
          dueDate: "2026-10-15",
          status: "achieved",
        }),
      ],
    });

    expect(screen.getByText(overview.checkpoints.status.achieved)).toBeInTheDocument();
    expect(
      screen.getByText(translateOverview("checkpoints.achievedOn", { date: "15 жовтня 2026 р." })),
    ).toBeInTheDocument();
    expect(screen.queryByText(overview.checkpoints.status.achieved_late)).not.toBeInTheDocument();
  });

  it("lists every checkpoint in order, not only the first five", () => {
    renderOverview({ checkpoints: SIX_CHECKPOINTS });

    const items = within(screen.getByRole("list")).getAllByRole("listitem");

    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent(translateOverview("checkpoints.count", { count: 1 }));
    expect(items[5]).toHaveTextContent(translateOverview("checkpoints.count", { count: 6 }));
  });

  it("counts the late checkpoints apart from the reached ones", () => {
    renderOverview({ checkpoints: SIX_CHECKPOINTS });

    expect(
      screen.getByText(
        translateOverview("checkpoints.summaryWithLate", { late: 1, reached: 2, total: 6 }),
      ),
    ).toBeInTheDocument();
  });
});

describe("GoalOverviewTab recent events", () => {
  it("shows only the three latest events", () => {
    renderOverview({ activityPreview: FOUR_EVENTS });

    expect(screen.getByRole("link", { name: "Бігуни" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Книга Якова" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Правік" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Диб'я" })).not.toBeInTheDocument();
  });

  it("opens the full history from the recent events", async () => {
    renderOverview({ activityPreview: FOUR_EVENTS });

    await userEvent.click(screen.getByRole("button", { name: overview.recentActivity.showAll }));

    expect(onShowActivity).toHaveBeenCalledTimes(1);
  });

  it("keeps the recent events section and says there are no events yet", () => {
    renderOverview({ activityPreview: [] });

    const recent = screen.getByRole("region", { name: overview.recentActivity.title });
    expect(
      within(recent).getByRole("heading", { level: 2, name: overview.recentActivity.title }),
    ).toBeInTheDocument();
    expect(within(recent).getByText(overview.recentActivity.empty)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: overview.recentActivity.showAll }),
    ).not.toBeInTheDocument();
  });
});

describe("GoalOverviewTab forecast illustration", () => {
  it.each(["none", "low"] as const)(
    "draws the not-enough-data art beside a %s-confidence forecast",
    (projectionConfidence) => {
      renderOverview({ projectedCompletionDate: "2026-11-25", projectionConfidence });

      expect(screen.getByRole("presentation")).toHaveAttribute(
        "src",
        expect.stringContaining(FORECAST_ILLUSTRATION),
      );
    },
  );

  it("draws the not-enough-data art when the forecast has no date", () => {
    renderOverview({ projectedCompletionDate: null, projectionConfidence: "medium" });

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(FORECAST_ILLUSTRATION),
    );
  });

  it.each(["medium", "high"] as const)(
    "leaves a dated %s-confidence forecast without the art",
    (projectionConfidence) => {
      renderOverview({ projectedCompletionDate: "2026-11-25", projectionConfidence });

      expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    },
  );

  it("leaves a completed goal without the art even when its forecast had no data", () => {
    renderOverview({
      completedAt: "2026-11-12",
      daysLeft: null,
      projectedCompletionDate: null,
      projectionConfidence: "none",
      status: "completed",
    });

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });
});

describe("GoalOverviewTab cards", () => {
  it("names each card after its heading and keeps its content inside", () => {
    renderOverview({
      checkpoints: [
        makeReadingGoalCheckpoint({
          achievedAt: "2026-10-15",
          dueDate: "2026-10-15",
          status: "achieved",
        }),
      ],
      riskLevel: "none",
      riskReasons: [],
    });

    expect(
      within(screen.getByRole("region", { name: overview.pace.title })).getByText(
        overview.pace.actual,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: overview.risk.title })).getByText(
        overview.risk.none,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: overview.checkpoints.title })).getByText(
        overview.checkpoints.status.achieved,
      ),
    ).toBeInTheDocument();
  });
});
