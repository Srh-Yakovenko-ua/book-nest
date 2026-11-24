import type { HomeGoalSection } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeReadingGoalMetrics } from "@/features/reading-goals/model/reading-goals.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { HomeReadingGoal } from "./home-reading-goal";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const goal = messages.home.goal;
const GOAL_ID = "bbbbbbbb-0000-4000-8000-000000000001";
const COMPLETED_GOAL_ID = "bbbbbbbb-0000-4000-8000-000000000002";
const GOAL_NAME = "Зимове читання до Нового року";

const fetchMock = vi.fn();

function goalSection(overrides: Partial<HomeGoalSection> = {}): HomeGoalSection {
  return { activeGoalsCount: 3, primaryGoal: primaryGoal(), recentCompletion: null, ...overrides };
}

function primaryGoal(
  metrics: Parameters<typeof makeReadingGoalMetrics>[0] = {},
): NonNullable<HomeGoalSection["primaryGoal"]> {
  return {
    contextActions: [],
    deadline: "2026-12-31",
    goalId: GOAL_ID,
    listName: "Зимова полиця",
    metrics: makeReadingGoalMetrics({
      completedCount: 4,
      daysLeft: 37,
      progressPercent: 40,
      remainingCount: 6,
      ...metrics,
    }),
    name: GOAL_NAME,
    status: "active",
    targetCount: 10,
  };
}

function showGoal(data: HomeGoalSection) {
  return renderWithProviders(
    <HomeReadingGoal isRetrying={false} onRetry={vi.fn()} widget={{ data, kind: "fresh" }} />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/lists") && method === "GET")
      return Promise.resolve(
        new Response(
          JSON.stringify({ items: [], page: 1, pagesCount: 0, pageSize: 24, totalCount: 0 }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HomeReadingGoal primary goal", () => {
  it("shows the completed and target counts with the percent", () => {
    showGoal(goalSection());

    expect(screen.getByText("4 з 10")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Прогрес цілі: 40%" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(screen.getByText("Залишилося 6 книг")).toBeInTheDocument();
  });

  it("caps the bar at 100 while showing the overachievement", () => {
    showGoal(
      goalSection({
        primaryGoal: primaryGoal({ completedCount: 12, progressPercent: 100, remainingCount: 0 }),
      }),
    );

    expect(screen.getByText("12 з 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Прогрес цілі: 100%" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText("Більше нічого не залишилося")).toBeInTheDocument();
  });

  it("shows the deadline with the days left", () => {
    showGoal(goalSection());

    expect(screen.getByText("До 31 груд. · залишилося 37 днів")).toBeInTheDocument();
  });

  it("links the goal title to the goal page", () => {
    showGoal(goalSection());

    expect(screen.getByRole("link", { name: GOAL_NAME })).toHaveAttribute(
      "href",
      `/goals/${GOAL_ID}`,
    );
  });

  it("links the header to every active goal with their count", () => {
    showGoal(goalSection());

    expect(screen.getByRole("link", { name: "Усі цілі (3)" })).toHaveAttribute("href", "/goals");
  });
});

describe("HomeReadingGoal recent completion", () => {
  it("mentions a goal completed recently", () => {
    showGoal(
      goalSection({
        recentCompletion: {
          completedAt: "2026-11-20",
          goalId: COMPLETED_GOAL_ID,
          listName: null,
          name: "Осінній марафон",
          targetCount: 5,
        },
      }),
    );

    expect(screen.getByText("Ціль досягнуто 20 лист.: Осінній марафон")).toBeInTheDocument();
  });

  it("says nothing about completions when there is none", () => {
    showGoal(goalSection());

    expect(screen.queryByText(/Ціль досягнуто/)).not.toBeInTheDocument();
  });
});

describe("HomeReadingGoal without an active goal", () => {
  it("invites to set a goal and hides the all goals link", () => {
    showGoal(goalSection({ activeGoalsCount: 0, primaryGoal: null }));

    expect(screen.getByText(goal.empty.description)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Усі цілі/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("opens the list picker from the create action", async () => {
    showGoal(goalSection({ activeGoalsCount: 0, primaryGoal: null }));

    await userEvent.click(screen.getByRole("button", { name: goal.create }));

    expect(
      await screen.findByRole("dialog", { name: messages.goals.picker.title }),
    ).toBeInTheDocument();
  });
});

describe("HomeReadingGoal error", () => {
  it("offers a retry when the goal fails to load", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <HomeReadingGoal isRetrying={false} onRetry={onRetry} widget={{ kind: "error" }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(goal.error.title);
    await userEvent.click(screen.getByRole("button", { name: goal.error.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
