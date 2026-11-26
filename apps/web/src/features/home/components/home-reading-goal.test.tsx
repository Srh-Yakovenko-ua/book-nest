import type { CustomListCard, HomeGoalSection } from "@app/shared";
import type { ComponentProps } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeCustomListCard } from "@/features/lists/model/lists.fixtures";
import { makeReadingGoalMetrics } from "@/features/reading-goals/model/reading-goals.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

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
const LIST_GOAL_PATH = /^\/api\/lists\/[^/]+\/goal$/;
const LIST_GOAL_PREVIEW_PATH = /^\/api\/lists\/[^/]+\/goal\/preview$/;

const fetchMock = vi.fn();

let pickerLists: CustomListCard[];

function goalSection(overrides: Partial<HomeGoalSection> = {}): HomeGoalSection {
  return { activeGoalsCount: 3, primaryGoal: primaryGoal(), recentCompletion: null, ...overrides };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
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
  pickerLists = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && pathname === "/api/lists")
      return Promise.resolve(
        jsonResponse({
          items: pickerLists,
          page: 1,
          pagesCount: pickerLists.length === 0 ? 0 : 1,
          pageSize: 24,
          totalCount: pickerLists.length,
        }),
      );
    if (method === "GET" && pathname === "/api/profile/settings")
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (method === "GET" && LIST_GOAL_PATH.test(pathname))
      return Promise.resolve(new Response(null, { status: 204 }));
    if (method === "GET" && LIST_GOAL_PREVIEW_PATH.test(pathname))
      return Promise.resolve(jsonResponse({ bookCount: 6, countedCount: 0 }));
    return Promise.reject(new Error(`unexpected ${method} ${pathname}`));
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

  it("goes back from the goal form to the list picker", async () => {
    pickerLists = [makeCustomListCard({ bookCount: 6, id: "list-1", name: "Осіннє читання" })];
    showGoal(goalSection({ activeGoalsCount: 0, primaryGoal: null }));

    await userEvent.click(screen.getByRole("button", { name: goal.create }));
    const picker = await screen.findByRole("dialog", { name: messages.goals.picker.title });
    await userEvent.click(await within(picker).findByRole("button", { name: /Осіннє читання/ }));
    const form = await screen.findByRole("dialog", { name: messages.goals.form.title });
    await userEvent.click(
      within(form).getByRole("button", { name: messages.goals.form.changeList }),
    );

    expect(
      await screen.findByRole("dialog", { name: messages.goals.picker.title }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: messages.goals.form.title }),
    ).not.toBeInTheDocument();
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
