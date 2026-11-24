import "@testing-library/jest-dom/vitest";

import type { Nullable, ReadingGoalListItem } from "@app/shared";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { createTranslator } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchMock = vi.fn();
const viewport = mockIntersectionObserver();

const FIRST_GOAL = makeReadingGoalListItem({ id: "goal-1", name: "Осінній марафон" });
const SECOND_GOAL = makeReadingGoalListItem({ id: "goal-2", name: "Зимові детективи" });

const translateGoals = createTranslator({ locale: "uk", messages, namespace: "goals" });

const catalogCopy = messages.goals.catalog;

const EMPTY_ILLUSTRATION = {
  error: "error-generic.png",
  filtered: "empty-search.png",
  firstGoal: "goal-first-goal-empty-state.png",
} as const;

let respondToCatalog: (url: URL) => Response;
let respondToOverview: () => Response;

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

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/goals/overview") return Promise.resolve(respondToOverview());
    if (url.pathname === "/api/goals") return Promise.resolve(respondToCatalog(url));
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
    expect(screen.getByText("Виконано 5 із 6 завершених")).toBeInTheDocument();
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
    expect(screen.getByText("Ще немає завершених цілей")).toBeInTheDocument();
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
    expect(await screen.findByText("Поставте першу ціль читання")).toBeInTheDocument();
    unmount();

    renderCatalog("status=archived");
    expect(await screen.findByText("Немає цілей із цим статусом")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати всі цілі" }));

    await waitFor(() => expect(catalogRequests().at(-1)?.searchParams.has("status")).toBe(false));
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

  it("adds a create button to the first-goal empty state besides the header one", async () => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    renderCatalog();

    await screen.findByText(catalogCopy.empty.title);
    expect(screen.getAllByRole("button", { name: catalogCopy.empty.create })).toHaveLength(2);
  });

  it("keeps the search art for a status filter that matches nothing", async () => {
    respondToCatalog = () => jsonResponse(catalogPage([]));

    renderCatalog("status=archived");

    await screen.findByText(catalogCopy.filteredEmpty.title);
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(EMPTY_ILLUSTRATION.filtered),
    );
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
