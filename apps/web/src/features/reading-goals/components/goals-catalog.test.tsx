import "@testing-library/jest-dom/vitest";

import type { CustomListCard, Nullable, ReadingGoalListItem } from "@app/shared";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { createTranslator } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeCustomListCard } from "@/features/lists/model/lists.fixtures";
import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeReadingGoalListItem, makeReadingGoalsOverview } from "../model/reading-goals.fixtures";
import { GoalsCatalog } from "./goals-catalog";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const fetchMock = vi.fn();
const viewport = mockIntersectionObserver();

const FIRST_GOAL = makeReadingGoalListItem({ id: "goal-1", name: "Осінній марафон" });
const SECOND_GOAL = makeReadingGoalListItem({ id: "goal-2", name: "Зимові детективи" });

const translateGoals = createTranslator({ locale: "uk", messages, namespace: "goals" });

const catalogCopy = messages.goals.catalog;

const SUCCESS_RATE_EXPLANATION =
  "Рахуються виконані й прострочені цілі, також в архіві. Активні й заархівовані до підсумку не рахуються.";

const EMPTY_ILLUSTRATION = {
  error: "error-generic.png",
  filtered: "empty-search.png",
  firstGoal: "goal-first-goal-empty-state.png",
} as const;

const FILLED_LIST = makeCustomListCard({ bookCount: 3, id: "list-1", name: "Осіннє читання" });

let respondToCatalog: (url: URL) => Response;
let respondToOverview: () => Response;
let libraryTotal: number;
let eligibleLists: CustomListCard[];

function catalogPage(items: ReadingGoalListItem[], nextCursor: Nullable<string> = null) {
  return { items, nextCursor };
}

function catalogRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/goals");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function libraryOverview(total: number) {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: 0,
      series: 0,
      solo: 0,
      total,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function listsPage(items: CustomListCard[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 24, totalCount: items.length };
}

function renderCatalog(searchParams = "", events: UrlUpdateEvent[] = []) {
  return renderWithProviders(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={(event) => events.push(event)}
      searchParams={searchParams}
    >
      <GoalsCatalog />
    </NuqsTestingAdapter>,
  );
}

function twoPageCatalog(url: URL): Response {
  return url.searchParams.get("cursor") === "cursor-2"
    ? jsonResponse(catalogPage([SECOND_GOAL]))
    : jsonResponse(catalogPage([FIRST_GOAL], "cursor-2"));
}

beforeEach(() => {
  respondToOverview = () => jsonResponse(makeReadingGoalsOverview());
  respondToCatalog = () => jsonResponse(catalogPage([FIRST_GOAL]));
  libraryTotal = 3;
  eligibleLists = [FILLED_LIST];

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/goals/overview") return Promise.resolve(respondToOverview());
    if (url.pathname === "/api/goals") return Promise.resolve(respondToCatalog(url));
    if (url.pathname === "/api/books/overview") {
      return Promise.resolve(jsonResponse(libraryOverview(libraryTotal)));
    }
    if (url.pathname === "/api/lists") {
      return Promise.resolve(jsonResponse(listsPage(eligibleLists)));
    }
    return Promise.reject(new Error(`unexpected ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalsCatalog pagination", () => {
  it("asks for the first page without a cursor and twenty goals per page", async () => {
    renderCatalog();

    expect(await screen.findByRole("link", { name: "Осінній марафон" })).toHaveAttribute(
      "href",
      "/goals/goal-1",
    );
    const [firstRequest] = catalogRequests();
    expect(firstRequest?.searchParams.get("limit")).toBe("20");
    expect(firstRequest?.searchParams.get("sort")).toBe("created_desc");
    expect(firstRequest?.searchParams.has("cursor")).toBe(false);
    expect(firstRequest?.searchParams.has("status")).toBe(false);
  });

  it("sends the returned cursor for the next page and keeps the loaded one", async () => {
    respondToCatalog = twoPageCatalog;

    renderCatalog();
    await screen.findByRole("link", { name: "Осінній марафон" });
    viewport.enterViewport();

    expect(await screen.findByRole("link", { name: "Зимові детективи" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Осінній марафон" })).toBeInTheDocument();
    expect(catalogRequests().map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "cursor-2",
    ]);
  });

  it("starts over without a cursor when the status changes and pushes it to history", async () => {
    const events: UrlUpdateEvent[] = [];
    respondToCatalog = twoPageCatalog;

    renderCatalog("", events);
    await screen.findByRole("link", { name: "Осінній марафон" });
    viewport.enterViewport();
    await screen.findByRole("link", { name: "Зимові детективи" });

    await userEvent.click(screen.getByRole("radio", { name: "Прострочені" }));

    await waitFor(() =>
      expect(catalogRequests().some((url) => url.searchParams.get("status") === "expired")).toBe(
        true,
      ),
    );
    const [firstExpiredRequest] = catalogRequests().filter(
      (url) => url.searchParams.get("status") === "expired",
    );
    expect(firstExpiredRequest?.searchParams.has("cursor")).toBe(false);
    expect(events.at(-1)?.searchParams.get("status")).toBe("expired");
    expect(events.at(-1)?.options.history).toBe("push");
  });
});

describe("GoalsCatalog overview", () => {
  it("shows the four server figures regardless of the status filter", async () => {
    renderCatalog("status=archived");

    expect(await screen.findByText("83%")).toBeInTheDocument();
    expect(screen.getByText("Потребують уваги")).toBeInTheDocument();
    expect(screen.getByText("5 із 6 цілей із підсумком")).toBeInTheDocument();
    expect(screen.getByText(SUCCESS_RATE_EXPLANATION)).toBeInTheDocument();
  });

  it("shows 0% with the finished goals behind it when none of them succeeded", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeReadingGoalsOverview({
          success: { finishedGoals: 2, successfulGoals: 0, successRatePercent: 0 },
        }),
      );

    renderCatalog();

    expect(await screen.findByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 із 2 цілей із підсумком")).toBeInTheDocument();
    expect(screen.getByText(SUCCESS_RATE_EXPLANATION)).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("shows a dash and a hint instead of 0% when no goal has finished yet", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeReadingGoalsOverview({
          success: { finishedGoals: 0, successfulGoals: 0, successRatePercent: 0 },
        }),
      );

    renderCatalog();

    expect(await screen.findByText("—")).toBeInTheDocument();
    expect(screen.getByText("Ще немає цілей із підсумком")).toBeInTheDocument();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("explains a projected delay that needs attention with its days and source list", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeReadingGoalsOverview({
          attention: [
            {
              goalId: "goal-3",
              goalName: null,
              listName: "Детективи на зиму",
              messageData: { lateDays: 15, remainingCount: 3, targetCount: 5 },
              reason: "projected_late",
              severity: "high",
            },
          ],
        }),
      );

    renderCatalog();

    const item = await screen.findByRole("link", {
      name: new RegExp(translateGoals("fallbackTitle", { count: 5 })),
    });
    expect(item).toHaveAttribute("href", "/goals/goal-3");
    expect(within(item).getByText("Детективи на зиму")).toBeInTheDocument();
    expect(
      within(item).getByText(
        new RegExp(translateGoals("catalog.attention.reasons.projectedLateDays", { count: 15 })),
      ),
    ).toBeInTheDocument();
  });
});

describe("GoalsCatalog states", () => {
  it("offers a retry when the catalog fails and asks for it again", async () => {
    respondToCatalog = () => jsonResponse({ message: "boom" }, 500);

    renderCatalog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити цілі")).toBeInTheDocument();
    const requestsBeforeRetry = catalogRequests().length;

    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    await waitFor(() => expect(catalogRequests().length).toBeGreaterThan(requestsBeforeRetry));
  });

  it("tells a reader with no goals apart from an empty status filter", async () => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    const { unmount } = renderCatalog();
    expect(await screen.findByText(catalogCopy.empty.title)).toBeInTheDocument();
    unmount();

    renderCatalog("status=archived");
    expect(await screen.findByText("Архів порожній")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати всі цілі" }));

    await waitFor(() => expect(catalogRequests().at(-1)?.searchParams.has("status")).toBe(false));
  });

  it.each([
    { status: "completed", title: "Поки немає виконаних цілей" },
    { status: "expired", title: "Немає цілей із цим статусом" },
    { status: "active", title: "Немає цілей із цим статусом" },
  ])("titles an empty $status filter for what it filters", async ({ status, title }) => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    renderCatalog(`status=${status}`);

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показати всі цілі" })).toBeInTheDocument();
  });

  it("labels an archived goal without a result and a deleted source list", async () => {
    respondToCatalog = () =>
      jsonResponse(
        catalogPage([
          makeReadingGoalListItem({
            archivedAt: "2026-10-01T09:00:00.000Z",
            daysLeft: null,
            list: null,
            name: "Літні класики",
            pace: null,
            result: null,
            status: "archived",
          }),
        ]),
      );

    renderCatalog();

    await screen.findByRole("link", { name: "Літні класики" });
    expect(screen.getByText("Заархівована")).toBeInTheDocument();
    expect(screen.getByText("Без результату")).toBeInTheDocument();
    expect(screen.getByText("Список видалено")).toBeInTheDocument();
  });

  it("titles an unnamed goal by its target and shows the deadline and list apart", async () => {
    respondToCatalog = () =>
      jsonResponse(catalogPage([makeReadingGoalListItem({ name: null, targetCount: 8 })]));

    renderCatalog();

    expect(
      await screen.findByRole("link", { name: translateGoals("fallbackTitle", { count: 8 }) }),
    ).toHaveAttribute("href", "/goals/goal-1");
    expect(screen.getByRole("link", { name: "Книги на осінь" })).toHaveAttribute(
      "href",
      "/lists/list-1",
    );
    expect(
      screen.getByText(translateGoals("catalog.card.deadline", { date: "30 лист. 2026 р." })),
    ).toBeInTheDocument();
  });
});

describe("GoalsCatalog illustrations", () => {
  it("greets a reader with no goals with the first-goal art", async () => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    renderCatalog();

    await screen.findByText(catalogCopy.empty.title);
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(EMPTY_ILLUSTRATION.firstGoal),
    );
  });

  it("leaves the first-goal empty state as the only create button", async () => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    renderCatalog();

    await screen.findByText(catalogCopy.empty.title);
    expect(screen.getAllByRole("button", { name: catalogCopy.empty.create })).toHaveLength(1);
  });

  it("keeps the search art for a status filter that matches nothing", async () => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    renderCatalog("status=archived");

    expect(await screen.findByText("Архів порожній")).toBeInTheDocument();
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(EMPTY_ILLUSTRATION.filtered),
    );
    expect(screen.getByRole("button", { name: "Показати всі цілі" })).toBeInTheDocument();
  });

  it("keeps the generic error art when the catalog fails", async () => {
    respondToCatalog = () => jsonResponse({ message: "boom" }, 500);

    renderCatalog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(EMPTY_ILLUSTRATION.error),
    );
  });
});

describe("GoalsCatalog accessible names", () => {
  it("names each goal card after its title, an unnamed one after its target", async () => {
    const unnamedTitle = translateGoals("fallbackTitle", { count: 8 });
    respondToCatalog = () =>
      jsonResponse(
        catalogPage([
          FIRST_GOAL,
          makeReadingGoalListItem({ id: "goal-2", name: null, targetCount: 8 }),
        ]),
      );

    renderCatalog();

    const named = await screen.findByRole("article", { name: "Осінній марафон" });
    const unnamed = screen.getByRole("article", { name: unnamedTitle });
    expect(within(named).getByRole("link", { name: "Осінній марафон" })).toHaveAttribute(
      "href",
      "/goals/goal-1",
    );
    expect(within(unnamed).getByRole("link", { name: unnamedTitle })).toHaveAttribute(
      "href",
      "/goals/goal-2",
    );
  });

  it("names the risk level of each attention item next to its reason", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeReadingGoalsOverview({
          attention: [
            {
              goalId: "goal-3",
              goalName: "Нічні детективи",
              listName: null,
              messageData: {},
              reason: "behind_schedule",
              severity: "high",
            },
            {
              goalId: "goal-4",
              goalName: "Поезія на зиму",
              listName: null,
              messageData: {},
              reason: "required_pace_high",
              severity: "medium",
            },
          ],
        }),
      );

    renderCatalog();

    const highRisk = await screen.findByRole("link", { name: /Нічні детективи/ });
    const mediumRisk = screen.getByRole("link", { name: /Поезія на зиму/ });
    expect(
      within(highRisk).getByRole("img", { name: messages.goals.risk.high }),
    ).toBeInTheDocument();
    expect(
      within(highRisk).getByText(catalogCopy.attention.reasons.behindSchedule),
    ).toBeInTheDocument();
    expect(
      within(mediumRisk).getByRole("img", { name: messages.goals.risk.medium }),
    ).toBeInTheDocument();
    expect(
      within(mediumRisk).getByText(catalogCopy.attention.reasons.requiredPaceHigh),
    ).toBeInTheDocument();
  });
});

describe("GoalsCatalog return state", () => {
  it("hands the filtered status and the view to the goal it opens", async () => {
    renderCatalog("status=completed&view=list");

    const title = await screen.findByRole("link", { name: "Осінній марафон" });
    const detailUrl = new URL(title.getAttribute("href") ?? "", "http://localhost");

    expect(detailUrl.pathname).toBe("/goals/goal-1");
    expect(detailUrl.searchParams.get("catalog")).toBe("status=completed&view=list");
  });
});

describe("GoalsCatalog first step", () => {
  const { empty } = catalogCopy;

  beforeEach(() => {
    respondToCatalog = () => jsonResponse(catalogPage([]));
  });

  it("opens the create form when the account has no books", async () => {
    libraryTotal = 0;
    renderCatalog();
    await screen.findByRole("heading", { name: empty.noBooks.title });

    await userEvent.click(screen.getByRole("button", { name: messages.books.firstBook.cta }));

    expect(routerPush).toHaveBeenCalledWith("/books/new");
  });

  it("leads to the lists when no list holds books yet", async () => {
    eligibleLists = [];
    renderCatalog();
    await screen.findByRole("heading", { name: empty.noLists.title });

    await userEvent.click(screen.getByRole("button", { name: empty.noLists.cta }));

    expect(routerPush).toHaveBeenCalledWith("/lists");
  });

  it("explains that a list has to be created or filled before a goal", async () => {
    eligibleLists = [];
    renderCatalog();
    await screen.findByRole("heading", { name: empty.noLists.title });

    expect(screen.getByText(empty.noLists.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: empty.create })).not.toBeInTheDocument();
  });

  it("opens the list picker from the empty state once a list holds books", async () => {
    renderCatalog();
    await screen.findByRole("heading", { name: empty.title });

    await userEvent.click(screen.getByRole("button", { name: empty.create }));

    expect(
      await screen.findByRole("dialog", { name: messages.goals.picker.title }),
    ).toBeInTheDocument();
  });

  it("returns focus to the empty-state create button when the picker closes", async () => {
    renderCatalog();
    await screen.findByRole("heading", { name: empty.title });
    await userEvent.click(screen.getByRole("button", { name: empty.create }));
    await screen.findByRole("dialog", { name: messages.goals.picker.title });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.getByRole("button", { name: empty.create })).toHaveFocus());
  });
});
