import { defaultUserProfileSettings } from "@app/shared";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { makeReadingGoalDetail } from "../model/reading-goals.fixtures";
import { GoalProgressHero } from "./goal-progress-hero";

const hero = messages.goals.detail.hero;
const pace = messages.goals.pace;

const SETTINGS_PATH = "/api/profile/settings";
const PROFILE_SETTINGS = { ...defaultUserProfileSettings, timezone: "America/New_York" };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === SETTINGS_PATH) {
      return Promise.resolve(
        new Response(JSON.stringify(PROFILE_SETTINGS), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const translateHero = createTranslator({ locale: "uk", messages, namespace: "goals.detail.hero" });
const translateDetail = createTranslator({ locale: "uk", messages, namespace: "goals.detail" });

const ILLUSTRATION = {
  completed: "goal-completed-trophy-books.png",
  expired: "goal-expired-hourglass.png",
} as const;

const TWO_OF_FIVE = makeReadingGoalDetail({
  completedCount: 2,
  daysLeft: 38,
  elapsedDays: 35,
  elapsedPercent: 47.9,
  expectedCompletedCount: 2.4,
  pace: "on_track",
  paceDeltaBooks: -0.4,
  progressPercent: 40,
  remainingCount: 3,
  targetCount: 5,
  totalDays: 73,
});

describe("GoalProgressHero for an active goal", () => {
  it("leads with the share of books read and the count behind it", () => {
    renderWithProviders(<GoalProgressHero goal={TWO_OF_FIVE} />);

    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(
      screen.getByText(translateDetail("progress", { completed: 2, target: 5 })),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("sets today's plan next to the actual share in the legend of the bar", () => {
    renderWithProviders(<GoalProgressHero goal={TWO_OF_FIVE} />);

    expect(screen.getByText(translateHero("actual", { percent: 40 }))).toBeInTheDocument();
    expect(screen.getByText(translateHero("plan", { percent: 48 }))).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAccessibleDescription(
      expect.stringContaining(translateHero("plan", { percent: 48 })),
    );
  });

  it("reads a small lag inside the on-track band as close to plan, not behind", () => {
    renderWithProviders(<GoalProgressHero goal={TWO_OF_FIVE} />);

    expect(screen.getByText(hero.closeToPlan)).toBeInTheDocument();
    expect(
      screen.getByText(translateHero("gap.closeBehind", { count: 0.4, expected: 2.4 })),
    ).toBeInTheDocument();
    expect(screen.queryByText(pace.behind)).not.toBeInTheDocument();
  });

  it("calls a gap that rounds to no books exactly on plan", () => {
    const onPlan = { ...TWO_OF_FIVE, expectedCompletedCount: 2.04, paceDeltaBooks: -0.04 };

    renderWithProviders(<GoalProgressHero goal={onPlan} />);

    expect(screen.getByText(pace.on_track)).toBeInTheDocument();
    expect(screen.getByText(translateHero("gap.onPlan", { expected: 2 }))).toBeInTheDocument();
    expect(screen.queryByText(hero.closeToPlan)).not.toBeInTheDocument();
  });

  it("keeps a critical goal behind even when it has read more than today's plan", () => {
    const criticalAhead = makeReadingGoalDetail({
      ...TWO_OF_FIVE,
      pace: "critical",
      paceDeltaBooks: 0.6,
    });

    renderWithProviders(<GoalProgressHero goal={criticalAhead} />);

    expect(screen.getByText(pace.critical)).toBeInTheDocument();
    expect(
      screen.getByText(translateHero("gap.behind", { count: 0, expected: 2.4 })),
    ).toBeInTheDocument();
    expect(screen.queryByText(pace.ahead)).not.toBeInTheDocument();
    expect(
      screen.queryByText(translateHero("gap.ahead", { count: 0.6, expected: 2.4 })),
    ).not.toBeInTheDocument();
  });

  it("counts the days left and the days already gone", () => {
    renderWithProviders(<GoalProgressHero goal={TWO_OF_FIVE} />);

    expect(screen.getByText(translateHero("daysLeft", { count: 38 }))).toBeInTheDocument();
    expect(
      screen.getByText(translateHero("elapsed", { elapsed: 35, total: 73 })),
    ).toBeInTheDocument();
  });
});

describe("GoalProgressHero for a closed goal", () => {
  it("dates a completed goal and drops today's plan", () => {
    renderWithProviders(
      <GoalProgressHero
        goal={makeReadingGoalDetail({
          completedAt: "2026-11-12",
          completedCount: 8,
          daysLeft: null,
          progressPercent: 100,
          remainingCount: 0,
          status: "completed",
        })}
      />,
    );

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(
      screen.getByText(translateHero("completedOn", { date: "12 листопада 2026 р." })),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^План на сьогодні/)).not.toBeInTheDocument();
    expect(screen.queryByText(pace.on_track)).not.toBeInTheDocument();
  });

  it("counts how long an expired goal is overdue instead of the days left", () => {
    renderWithProviders(
      <GoalProgressHero goal={makeReadingGoalDetail({ daysLeft: -4, status: "expired" })} />,
    );

    expect(screen.getByText(translateHero("overdue", { count: 4 }))).toBeInTheDocument();
    expect(screen.queryByText(/до дедлайну$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^План на сьогодні/)).not.toBeInTheDocument();
  });

  it("dates when an archived goal went to the archive", async () => {
    renderWithProviders(
      <GoalProgressHero
        goal={makeReadingGoalDetail({
          archivedAt: "2026-10-01T02:00:00.000Z",
          daysLeft: null,
          pace: null,
          status: "archived",
        })}
      />,
    );

    expect(
      await screen.findByText(translateHero("archivedOn", { date: "30 вересня 2026 р." })),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^План на сьогодні/)).not.toBeInTheDocument();
  });
});

describe("GoalProgressHero illustration", () => {
  it("crowns a completed goal with the trophy", () => {
    renderWithProviders(
      <GoalProgressHero
        goal={makeReadingGoalDetail({
          completedAt: "2026-11-12",
          daysLeft: null,
          status: "completed",
        })}
      />,
    );

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(ILLUSTRATION.completed),
    );
  });

  it("marks an expired goal with the hourglass", () => {
    renderWithProviders(
      <GoalProgressHero goal={makeReadingGoalDetail({ daysLeft: -4, status: "expired" })} />,
    );

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(ILLUSTRATION.expired),
    );
  });

  it("keeps the hourglass off an active goal that is only forecast to finish late", () => {
    renderWithProviders(
      <GoalProgressHero
        goal={makeReadingGoalDetail({
          projectedDaysDelta: -15,
          riskLevel: "high",
          riskReasons: ["projected_late"],
          status: "active",
        })}
      />,
    );

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("draws nothing for an archived goal even when it had expired", () => {
    renderWithProviders(
      <GoalProgressHero
        goal={makeReadingGoalDetail({
          archivedAt: "2026-10-01T09:00:00.000Z",
          daysLeft: -3,
          pace: null,
          result: "expired",
          status: "archived",
        })}
      />,
    );

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });
});
