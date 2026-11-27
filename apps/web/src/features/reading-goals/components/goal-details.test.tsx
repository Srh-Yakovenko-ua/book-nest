import "@testing-library/jest-dom/vitest";

import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { createTranslator } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeReadingGoalActivity,
  makeReadingGoalBook,
  makeReadingGoalCheckpoint,
  makeReadingGoalDetail,
} from "../model/reading-goals.fixtures";
import { GoalDetails } from "./goal-details";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const GOAL_ID = "goal-1";
const GOAL_URL = `/api/goals/${GOAL_ID}`;

const detail = messages.goals.detail;

const ILLUSTRATION = {
  error: "error-generic.png",
  notFound: "error-not-found.png",
} as const;
const translateGoals = createTranslator({ locale: "uk", messages, namespace: "goals" });

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToDetail: () => Response;

function deleteCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(GOAL_URL) && (init?.method ?? "GET").toUpperCase() === "DELETE",
  ) as [string, RequestInit] | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDetails(searchParams = "", events: UrlUpdateEvent[] = []) {
  return renderWithProviders(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={(event) => events.push(event)}
      searchParams={searchParams}
    >
      <GoalDetails id={GOAL_ID} />
    </NuqsTestingAdapter>,
  );
}

function respondWith(overrides: Parameters<typeof makeReadingGoalDetail>[0]) {
  respondToDetail = () => jsonResponse(makeReadingGoalDetail(overrides));
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  respondToDetail = () => jsonResponse(makeReadingGoalDetail());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes(GOAL_URL) && method === "DELETE")
      return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes(`${GOAL_URL}/books`) || url.includes(`${GOAL_URL}/activity`))
      return Promise.resolve(jsonResponse({ items: [], nextCursor: null }));
    if (url.includes(GOAL_URL)) return Promise.resolve(respondToDetail());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalDetails", () => {
  it("exposes the server progress of the goal to assistive tech", async () => {
    renderDetails();

    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "63");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  });

  it("keeps the server percent when more books are counted than the target", async () => {
    respondWith({ completedCount: 9, progressPercent: 100, remainingCount: 0, targetCount: 8 });

    renderDetails();

    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("9 із 8 книг")).toBeInTheDocument();
  });

  it("caps the edited target at the books fixed in the goal, not the current list", async () => {
    respondWith({ listBookCount: 20, snapshotBookCount: 8 });

    renderDetails();

    await userEvent.click(await screen.findByRole("button", { name: "Редагувати ціль" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Прочитати книг")).toHaveAttribute("max", "8");
    expect(within(dialog).getByText("У цілі 8 книг")).toBeInTheDocument();
  });

  it("goes back to all goals while the source list stays linked in the metadata", async () => {
    renderDetails();

    expect(await screen.findByRole("link", { name: "Усі цілі" })).toHaveAttribute("href", "/goals");
    expect(screen.getByRole("link", { name: "Книги на осінь" })).toHaveAttribute(
      "href",
      "/lists/list-1",
    );
  });

  it("falls back to the goals catalog when the source list is gone", async () => {
    respondWith({ list: null });

    renderDetails();

    expect(await screen.findByRole("link", { name: "Усі цілі" })).toHaveAttribute("href", "/goals");
  });

  it("returns to the catalog with the status and view it was opened from", async () => {
    renderDetails("?catalog=status%3Dcompleted%26view%3Dlist");

    expect(await screen.findByRole("link", { name: "Усі цілі" })).toHaveAttribute(
      "href",
      "/goals?status=completed&view=list",
    );
  });

  it("returns to the default catalog when the remembered state is not valid", async () => {
    renderDetails("?catalog=status%3Dbogus%26view%3Dtiles");

    expect(await screen.findByRole("link", { name: "Усі цілі" })).toHaveAttribute("href", "/goals");
  });

  it("keeps the remembered catalog state while the reader moves between tabs", async () => {
    const events: UrlUpdateEvent[] = [];
    renderDetails("?tab=books&catalog=status%3Darchived", events);

    expect(await screen.findByText(detail.books.empty.all.title)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: detail.tabs.books })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.click(screen.getByRole("tab", { name: detail.tabs.overview }));

    await waitFor(() => expect(events).not.toHaveLength(0));
    expect(events.at(-1)?.searchParams.has("tab")).toBe(false);
    expect(events.at(-1)?.searchParams.get("catalog")).toBe("status=archived");
  });

  it("sends the not-found state back to the goals catalog", async () => {
    respondToDetail = () => jsonResponse({ message: "not found" }, 404);

    renderDetails();

    expect(await screen.findByText("Ціль не знайдено")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Повторити" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "До цілей" }));
    expect(pushMock).toHaveBeenCalledWith("/goals");
  });

  it("lets the reader retry a goal that failed to load", async () => {
    respondToDetail = () => jsonResponse({ message: "boom" }, 500);

    renderDetails();

    expect(await screen.findByText("Не вдалося завантажити ціль")).toBeInTheDocument();

    respondToDetail = () => jsonResponse(makeReadingGoalDetail());
    await userEvent.click(screen.getByRole("button", { name: "Повторити" }));

    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
  });

  it("shows the not-found art when the goal is not found", async () => {
    respondToDetail = () => jsonResponse({ message: "not found" }, 404);

    renderDetails();

    await screen.findByRole("heading", { name: detail.notFoundTitle });
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(ILLUSTRATION.notFound),
    );
  });

  it("shows the generic error art when the goal fails to load", async () => {
    respondToDetail = () => jsonResponse({ message: "boom" }, 500);

    renderDetails();

    await screen.findByRole("heading", { name: detail.errorTitle });
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(ILLUSTRATION.error),
    );
  });

  it("returns focus to the archive button when the confirmation is cancelled", async () => {
    renderDetails();

    const archive = await screen.findByRole("button", { name: "Архівувати" });
    await userEvent.click(archive);
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Скасувати" }));

    await waitFor(() => expect(archive).toHaveFocus());
  });

  it("keeps an archived goal read-only and shows that it has no result", async () => {
    respondWith({
      daysLeft: null,
      pace: null,
      projectionConfidence: "none",
      result: null,
      status: "archived",
    });

    renderDetails();

    expect(await screen.findByText("Заархівована")).toBeInTheDocument();
    expect(screen.getByText("Без результату")).toBeInTheDocument();
    expect(screen.getByText(detail.hero.archived)).toBeInTheDocument();
    expect(screen.queryByText("Прострочена")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Редагувати ціль" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Архівувати" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();
  });

  it("confirms the deletion and then replaces the page with the goals catalog", async () => {
    renderDetails();

    await userEvent.click(await screen.findByRole("button", { name: "Видалити" }));
    const confirmation = await screen.findByRole("alertdialog");

    expect(deleteCall()).toBeUndefined();

    await userEvent.click(within(confirmation).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteCall()).toBeDefined());
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/goals"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("drops the book scope from the URL when leaving the books tab", async () => {
    const events: UrlUpdateEvent[] = [];
    renderDetails("?tab=books&scope=counted", events);

    await userEvent.click(await screen.findByRole("tab", { name: "Історія" }));

    await waitFor(() => expect(events).not.toHaveLength(0));
    const lastUpdate = events.at(-1);
    expect(lastUpdate?.searchParams.get("tab")).toBe("activity");
    expect(lastUpdate?.searchParams.has("scope")).toBe(false);
    expect(lastUpdate?.options.history).toBe("push");
  });

  it("clears the tab and the activity filter when returning to the overview", async () => {
    const events: UrlUpdateEvent[] = [];
    renderDetails("?tab=activity&activityType=book_counted", events);

    await userEvent.click(await screen.findByRole("tab", { name: "Огляд" }));

    await waitFor(() => expect(events).not.toHaveLength(0));
    expect(events.at(-1)?.searchParams.toString()).toBe("");
    expect(screen.getByRole("tab", { name: "Огляд" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the activity tab from the recent events preview", async () => {
    const events: UrlUpdateEvent[] = [];
    respondWith({ activityPreview: [makeReadingGoalActivity()] });

    renderDetails("", events);

    await userEvent.click(await screen.findByRole("button", { name: "Уся історія" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("tab")).toBe("activity"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: detail.activity.listLabel })).toHaveFocus(),
    );
  });

  it("opens the remaining books from the next step of an at-risk goal and focuses the list", async () => {
    respondWith({
      requiredDaysPerBook: null,
      riskLevel: "high",
      riskReasons: ["behind_schedule"],
    });

    renderDetails();

    await userEvent.click(
      await screen.findByRole("button", { name: detail.overview.risk.showRemaining }),
    );

    expect(await screen.findByText(detail.books.empty.remaining.title)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: detail.tabs.books })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("radio", { name: /^Ще не зараховані/ })).toBeChecked();
    expect(screen.getByRole("region", { name: detail.books.listLabel })).toHaveFocus();
  });

  it("keeps focus on the books tab when it is chosen from the tab list", async () => {
    renderDetails();

    const booksTab = await screen.findByRole("tab", { name: detail.tabs.books });
    await userEvent.click(booksTab);

    expect(await screen.findByText(detail.books.empty.all.title)).toBeInTheDocument();
    expect(booksTab).toHaveFocus();
    expect(screen.getByRole("region", { name: detail.books.listLabel })).not.toHaveFocus();
  });

  it("opens the remaining books from the hero and focuses the list from the overview", async () => {
    const events: UrlUpdateEvent[] = [];
    renderDetails("", events);

    await userEvent.click(await screen.findByRole("button", { name: detail.hero.action.books }));

    expect(await screen.findByText(detail.books.empty.remaining.title)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: detail.tabs.books })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("radio", { name: /^Ще не зараховані/ })).toBeChecked();
    expect(screen.getByRole("region", { name: detail.books.listLabel })).toHaveFocus();
    await waitFor(() => expect(events.at(-1)?.searchParams.get("scope")).toBe("remaining"));
    expect(events.at(-1)?.searchParams.get("tab")).toBe("books");
  });

  it("narrows an open books tab to the remaining books from the hero and focuses the list", async () => {
    renderDetails();

    await userEvent.click(await screen.findByRole("tab", { name: detail.tabs.books }));
    expect(await screen.findByText(detail.books.empty.all.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: detail.hero.action.books }));

    expect(await screen.findByText(detail.books.empty.remaining.title)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Ще не зараховані/ })).toBeChecked();
    expect(screen.getByRole("region", { name: detail.books.listLabel })).toHaveFocus();
  });

  it("sends the hero to the book in progress instead of the goal books", async () => {
    respondWith({
      remainingBooks: [
        makeReadingGoalBook({
          countedFinishedAt: null,
          id: "book-in-progress",
          qualifies: false,
          reading: {
            currentPage: 120,
            finishedAt: null,
            pagesCount: 320,
            startedAt: "2026-08-01",
            status: "reading",
          },
        }),
      ],
    });

    renderDetails();

    const continueLink = await screen.findByRole("link", { name: detail.hero.action.continue });
    expect(continueLink).toHaveAttribute("href", "/books/book-in-progress");
    expect(
      screen.queryByRole("button", { name: detail.hero.action.books }),
    ).not.toBeInTheDocument();
  });

  it("shows the shared progress hero once on every tab without the old progress and time block", async () => {
    respondWith({ completedCount: 2, progressPercent: 40, remainingCount: 3, targetCount: 5 });
    const heroLabel = translateGoals("detail.progressLabel", { percent: 40 });

    function expectOnlyTheSharedHero() {
      const heroes = screen.getAllByRole("progressbar", { name: heroLabel });
      expect(heroes).toHaveLength(1);
      expect(heroes[0]).toHaveAttribute("aria-valuenow", "40");
      expect(screen.queryByRole("heading", { name: /Прогрес і час/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Прогрес і час/)).not.toBeInTheDocument();
    }

    renderDetails();

    expect(await screen.findByRole("tab", { name: detail.tabs.overview })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expectOnlyTheSharedHero();

    await userEvent.click(screen.getByRole("tab", { name: detail.tabs.books }));
    expect(await screen.findByText(detail.books.empty.all.title)).toBeInTheDocument();
    expectOnlyTheSharedHero();

    await userEvent.click(screen.getByRole("tab", { name: detail.tabs.activity }));
    expect(await screen.findByText(detail.activity.empty.title)).toBeInTheDocument();
    expectOnlyTheSharedHero();
  });

  it("names a forecast date only when the server is confident about it", async () => {
    respondWith({
      projectedCompletionDate: "2026-11-25",
      projectedDaysDelta: 5,
      projectionConfidence: "medium",
    });

    renderDetails();

    expect(await screen.findByText("25 листопада 2026 р.")).toBeInTheDocument();
    expect(
      screen.getByText(translateGoals("detail.overview.projection.early", { count: 5 })),
    ).toBeInTheDocument();
    expect(screen.getByText(detail.overview.projection.confidence.medium)).toBeInTheDocument();
  });

  it("does not state an exact date for a low-confidence forecast", async () => {
    respondWith({ projectedCompletionDate: "2026-11-25", projectionConfidence: "low" });

    renderDetails();

    expect(await screen.findByText(detail.overview.projection.insufficient)).toBeInTheDocument();
    expect(screen.queryByText(/25 листопада 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Впевненість/)).not.toBeInTheDocument();
  });

  it("keeps both the miss and the late achievement of a checkpoint", async () => {
    respondWith({
      checkpoints: [
        makeReadingGoalCheckpoint({
          achievedAt: "2026-10-20",
          dueDate: "2026-10-15",
          status: "missed",
        }),
      ],
    });

    renderDetails();

    const checkpoints = detail.overview.checkpoints;
    expect(await screen.findByText(checkpoints.status.achieved_late)).toBeInTheDocument();
    expect(
      screen.getByText(
        translateGoals("detail.overview.checkpoints.achievedLate", {
          count: 5,
          date: "20 жовтня 2026 р.",
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(checkpoints.status.missed)).not.toBeInTheDocument();
    expect(screen.queryByText(checkpoints.status.achieved)).not.toBeInTheDocument();
  });

  it("keeps the pace close to plan while the forecast warns of a 15-day delay", async () => {
    respondWith({
      completedCount: 2,
      daysLeft: 38,
      elapsedPercent: 47.9,
      expectedCompletedCount: 2.4,
      pace: "on_track",
      paceDeltaBooks: -0.4,
      progressPercent: 40,
      projectedCompletionDate: "2027-01-15",
      projectedDaysDelta: -15,
      projectionConfidence: "medium",
      remainingCount: 3,
      riskLevel: "high",
      riskReasons: ["projected_late"],
      targetCount: 5,
    });

    renderDetails();

    expect(
      await screen.findByText(
        translateGoals("detail.overview.risk.reasons.projected_late", { count: 15 }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(detail.overview.risk.onTrackProjectedLate)).toBeInTheDocument();
    expect(screen.getByText(detail.hero.closeToPlan)).toBeInTheDocument();
    expect(screen.queryByText(messages.goals.pace.behind)).not.toBeInTheDocument();
  });

  it("titles an unnamed goal by its target and keeps the deadline and list apart", async () => {
    respondWith({ name: null, targetCount: 8 });

    renderDetails();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: translateGoals("fallbackTitle", { count: 8 }),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(translateGoals("detail.meta.deadline", { date: "30 листопада 2026 р." })),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Книги на осінь" })).toHaveAttribute(
      "href",
      "/lists/list-1",
    );
  });

  it.each([
    {
      note: translateGoals("detail.hero.completedOn", { date: "12 листопада 2026 р." }),
      overrides: {
        completedAt: "2026-11-12",
        completedCount: 8,
        daysLeft: null,
        progressPercent: 100,
        remainingCount: 0,
        status: "completed" as const,
      },
      status: messages.goals.status.completed,
    },
    {
      note: translateGoals("detail.hero.overdue", { count: 4 }),
      overrides: { daysLeft: -4, status: "expired" as const },
      status: messages.goals.status.expired,
    },
  ])(
    "labels a goal $status in the header and dates it in the hero",
    async ({ note, overrides, status }) => {
      respondWith(overrides);

      renderDetails();

      expect(await screen.findByText(status)).toBeInTheDocument();
      expect(screen.getByText(note)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: detail.edit })).toBeInTheDocument();
    },
  );

  it("names every risk reason the server reports", async () => {
    respondWith({ riskLevel: "high", riskReasons: ["behind_schedule", "no_recent_progress"] });

    renderDetails();

    expect(await screen.findByText("Високий ризик")).toBeInTheDocument();
    expect(screen.getByText("Прогрес відстає від запланованого графіка")).toBeInTheDocument();
    expect(screen.getByText("Давно не було нових зарахованих книг")).toBeInTheDocument();
  });
});
