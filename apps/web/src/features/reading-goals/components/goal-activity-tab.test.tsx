import "@testing-library/jest-dom/vitest";

import type { Nullable, ReadingGoalActivityView } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import type { GoalActivityType } from "../model/goal-detail-query";

import { makeReadingGoalActivity } from "../model/reading-goals.fixtures";
import { GoalActivityTab } from "./goal-activity-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const GOAL_ID = "goal-1";
const ACTIVITY_PATH = `/api/goals/${GOAL_ID}/activity`;

const fetchMock = vi.fn();
const viewport = mockIntersectionObserver();

let respondToActivity: (url: URL) => Response;

function activityPage(items: ReadingGoalActivityView[], nextCursor: Nullable<string> = null) {
  return { items, nextCursor };
}

function activityRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === ACTIVITY_PATH);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function numberedEvents(from: number, count: number): ReadingGoalActivityView[] {
  return Array.from({ length: count }, (_, index) =>
    makeReadingGoalActivity({ id: `activity-${from + index}` }),
  );
}

function renderActivityTab(activityType: Nullable<GoalActivityType> = null) {
  const onActivityTypeChange = vi.fn();
  renderWithProviders(
    <GoalActivityTab
      activityType={activityType}
      goalId={GOAL_ID}
      onActivityTypeChange={onActivityTypeChange}
    />,
  );
  return { onActivityTypeChange };
}

function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest("li");
  if (row === null) throw new Error(`no row for ${text}`);
  return row;
}

beforeEach(() => {
  respondToActivity = () => jsonResponse(activityPage([makeReadingGoalActivity()]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === ACTIVITY_PATH) return Promise.resolve(respondToActivity(url));
    return Promise.reject(new Error(`unexpected ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalActivityTab requests", () => {
  it("asks for twenty events of every type without a cursor or a type", async () => {
    renderActivityTab();

    await screen.findByText("Книгу зараховано");
    const [firstRequest] = activityRequests();
    expect(firstRequest?.searchParams.get("limit")).toBe("20");
    expect(firstRequest?.searchParams.has("type")).toBe(false);
    expect(firstRequest?.searchParams.has("cursor")).toBe(false);
  });

  it("sends the chosen event type to the server", async () => {
    renderActivityTab("book_counted");

    expect(await screen.findByRole("link", { name: "Бігуни" })).toBeInTheDocument();
    const [firstRequest] = activityRequests();
    expect(firstRequest?.searchParams.get("type")).toBe("book_counted");
    expect(firstRequest?.searchParams.has("cursor")).toBe(false);
  });

  it("loads the next cursor page once more than twenty events exist", async () => {
    respondToActivity = (url) =>
      url.searchParams.get("cursor") === "cursor-2"
        ? jsonResponse(activityPage(numberedEvents(21, 5)))
        : jsonResponse(activityPage(numberedEvents(1, 20), "cursor-2"));

    renderActivityTab();
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(20));
    viewport.enterViewport();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(25));
    expect(activityRequests().map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "cursor-2",
    ]);
  });
});

describe("GoalActivityTab events", () => {
  it("falls back to the event name when metadata is missing or unexpected", async () => {
    respondToActivity = () =>
      jsonResponse(
        activityPage([
          makeReadingGoalActivity({
            book: null,
            id: "a-1",
            metadata: null,
            type: "target_changed",
          }),
          makeReadingGoalActivity({
            book: null,
            id: "a-2",
            metadata: { from: 5, to: "soon" },
            type: "deadline_changed",
          }),
          makeReadingGoalActivity({
            book: null,
            id: "a-3",
            metadata: { unexpected: true },
            type: "goal_renamed",
          }),
          makeReadingGoalActivity({
            book: null,
            id: "a-4",
            metadata: { from: 8, to: 10 },
            type: "target_changed",
          }),
        ]),
      );

    renderActivityTab();

    expect(await screen.findByText("Змінено дедлайн")).toBeInTheDocument();
    expect(screen.getByText("Ціль перейменовано")).toBeInTheDocument();
    expect(screen.getAllByText("Змінено кількість книг")).toHaveLength(2);
    expect(screen.getByText("Тепер 10 книг замість 8")).toBeInTheDocument();
    expect(screen.queryByText(/Новий дедлайн/)).not.toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("links the book only when the event carries one", async () => {
    respondToActivity = () =>
      jsonResponse(
        activityPage([
          makeReadingGoalActivity({ book: { id: "book-7", title: "Дюна" }, id: "a-1" }),
          makeReadingGoalActivity({ book: null, id: "a-2", type: "goal_created" }),
        ]),
      );

    renderActivityTab();

    expect(await screen.findByRole("link", { name: "Дюна" })).toHaveAttribute(
      "href",
      "/books/book-7",
    );
    expect(within(rowOf("Ціль створено")).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("GoalActivityTab states", () => {
  it("keeps the loaded events and offers a retry when the next page fails", async () => {
    let nextPageFails = true;
    respondToActivity = (url) => {
      if (url.searchParams.get("cursor") !== "cursor-2") {
        return jsonResponse(activityPage(numberedEvents(1, 20), "cursor-2"));
      }
      return nextPageFails
        ? jsonResponse({ message: "boom" }, 500)
        : jsonResponse(activityPage(numberedEvents(21, 1)));
    };

    renderActivityTab();
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(20));
    viewport.enterViewport();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити наступні події")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(20);

    nextPageFails = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Повторити" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(21));
    expect(activityRequests().filter((url) => url.searchParams.has("cursor"))).toHaveLength(2);
  });

  it("tells an empty filter apart and resets it to every event", async () => {
    respondToActivity = () => jsonResponse(activityPage([]));
    const { onActivityTypeChange } = renderActivityTab("goal_archived");

    expect(await screen.findByText("Немає подій цього типу")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати всі події" }));

    expect(onActivityTypeChange).toHaveBeenCalledWith(null);
  });
});
