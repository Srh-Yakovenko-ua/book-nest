import "@testing-library/jest-dom/vitest";

import type { CustomListCard } from "@app/shared";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeCustomListCard } from "@/features/lists/model/lists.fixtures";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import {
  makeReadingGoalListItem,
  makeReadingGoalsOverview,
  makeReadingGoalView,
} from "../model/reading-goals.fixtures";
import { GoalsCatalog } from "./goals-catalog";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const LIST_GOAL_PATH = /^\/api\/lists\/[^/]+\/goal$/;
const PICKER_TITLE = "Оберіть список для цілі";
const CREATE_TITLE = "Створити ціль для добірки";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
mockIntersectionObserver();

const AUTUMN_LIST = makeCustomListCard({ bookCount: 12, id: "list-1", name: "Осіннє читання" });
const WINTER_LIST = makeCustomListCard({ bookCount: 4, id: "list-2", name: "Зимові детективи" });

let respondToLists: () => Response;
let respondToListGoal: () => Response;
let respondToCreate: () => Response;

function calendarDay(day: string) {
  return within(screen.getByRole("grid")).getByText(day);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function listGoalLookups(): string[] {
  return sentRequests()
    .filter(({ method, url }) => method === "GET" && LIST_GOAL_PATH.test(url.pathname))
    .map(({ url }) => url.pathname);
}

function listsPage(items: CustomListCard[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 24, totalCount: items.length };
}

function listsRequests(): URL[] {
  return sentRequests()
    .filter(({ url }) => url.pathname === "/api/lists")
    .map(({ url }) => url);
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

async function openPicker() {
  await userEvent.click(await screen.findByRole("button", { name: "Нова ціль" }));
  return screen.findByRole("dialog", { name: PICKER_TITLE });
}

function renderCatalog() {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams="">
      <GoalsCatalog />
    </NuqsTestingAdapter>,
  );
}

function sentRequests() {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: init?.body,
    method: (init?.method ?? "GET").toUpperCase(),
    url: new URL(String(input), "http://localhost"),
  }));
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  respondToLists = () => jsonResponse(listsPage([AUTUMN_LIST, WINTER_LIST]));
  respondToListGoal = noContentResponse;
  respondToCreate = () => jsonResponse(makeReadingGoalView({ id: "goal-new" }), 201);

  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.pathname === "/api/profile/settings") {
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    }
    if (url.pathname === "/api/goals/overview") {
      return Promise.resolve(jsonResponse(makeReadingGoalsOverview()));
    }
    if (url.pathname === "/api/goals") {
      return Promise.resolve(
        jsonResponse({ items: [makeReadingGoalListItem()], nextCursor: null }),
      );
    }
    if (url.pathname === "/api/lists") return Promise.resolve(respondToLists());
    if (LIST_GOAL_PATH.test(url.pathname) && method === "POST") {
      return Promise.resolve(respondToCreate());
    }
    if (LIST_GOAL_PATH.test(url.pathname)) return Promise.resolve(respondToListGoal());
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalListPicker lists", () => {
  it("asks only for lists with books and shows how many each one holds", async () => {
    renderCatalog();

    const picker = await openPicker();

    expect(await within(picker).findByRole("button", { name: /Осіннє читання/ })).toHaveTextContent(
      "12 книг",
    );
    expect(within(picker).getByRole("button", { name: /Зимові детективи/ })).toHaveTextContent(
      "4 книги",
    );
    expect(listsRequests()[0]?.searchParams.getAll("fill")).toEqual(["with_books"]);
    expect(listGoalLookups()).toEqual([]);
  });

  it("sends a reader without lists of books to the lists page", async () => {
    respondToLists = () => jsonResponse(listsPage([]));

    renderCatalog();

    const picker = await openPicker();

    expect(await within(picker).findByRole("link", { name: "До списків" })).toHaveAttribute(
      "href",
      "/lists",
    );
    expect(within(picker).getByText("Поки немає списків із книгами")).toBeInTheDocument();
  });
});

describe("GoalListPicker selection", () => {
  it("checks the goal of the chosen list only, once", async () => {
    renderCatalog();

    const picker = await openPicker();
    await userEvent.click(await within(picker).findByRole("button", { name: /Зимові детективи/ }));

    expect(await screen.findByRole("dialog", { name: CREATE_TITLE })).toBeInTheDocument();
    expect(listGoalLookups()).toEqual(["/api/lists/list-2/goal"]);
  });

  it("opens the active goal instead of offering a second one", async () => {
    respondToListGoal = () => jsonResponse(makeReadingGoalView({ id: "goal-7", status: "active" }));

    renderCatalog();

    const picker = await openPicker();
    await userEvent.click(await within(picker).findByRole("button", { name: /Осіннє читання/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/goals/goal-7"));
    expect(toast.info).toHaveBeenCalledWith("У цього списку вже є активна ціль. Відкриваємо її.");
    expect(screen.queryByRole("dialog", { name: CREATE_TITLE })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: PICKER_TITLE })).not.toBeInTheDocument(),
    );
  });

  it("offers a new goal after a completed one and says the old one will be archived", async () => {
    respondToListGoal = () =>
      jsonResponse(
        makeReadingGoalView({
          completedCount: 8,
          daysLeft: null,
          remainingCount: 0,
          result: "completed",
          status: "completed",
        }),
      );

    renderCatalog();

    const picker = await openPicker();
    await userEvent.click(await within(picker).findByRole("button", { name: /Осіннє читання/ }));

    const dialog = await screen.findByRole("dialog", { name: CREATE_TITLE });
    expect(
      within(dialog).getByText(
        "Попередню ціль цього списку виконано. Щойно ви створите нову, попередня автоматично перейде в архів.",
      ),
    ).toBeInTheDocument();
    expect(sentRequests().some(({ url }) => url.pathname.endsWith("/archive"))).toBe(false);
  });

  it("keeps the picker open when the goal check fails and lets the reader try again", async () => {
    respondToListGoal = () => jsonResponse({ message: "boom" }, 500);

    renderCatalog();

    const picker = await openPicker();
    const option = await within(picker).findByRole("button", { name: /Осіннє читання/ });
    await userEvent.click(option);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Не вдалося перевірити ціль цього списку. Спробуйте ще раз.",
      ),
    );
    expect(screen.getByRole("dialog", { name: PICKER_TITLE })).toBeInTheDocument();

    respondToListGoal = noContentResponse;
    await userEvent.click(option);

    expect(await screen.findByRole("dialog", { name: CREATE_TITLE })).toBeInTheDocument();
    expect(listGoalLookups()).toEqual(["/api/lists/list-1/goal", "/api/lists/list-1/goal"]);
  });
});

describe("GoalListPicker creation", () => {
  it("creates the goal for the chosen list and opens it", async () => {
    renderCatalog();

    const picker = await openPicker();
    await userEvent.click(await within(picker).findByRole("button", { name: /Осіннє читання/ }));
    const dialog = await screen.findByRole("dialog", { name: CREATE_TITLE });

    expect(within(dialog).getByLabelText("Прочитати книг")).toHaveAttribute("max", "12");
    await userEvent.click(within(dialog).getByRole("button", { name: "До дати" }));
    await userEvent.click(calendarDay("20"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Створити ціль" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/goals/goal-new"));
    const createRequest = sentRequests().find(
      ({ method, url }) => method === "POST" && LIST_GOAL_PATH.test(url.pathname),
    );
    expect(createRequest?.url.pathname).toBe("/api/lists/list-1/goal");
    expect(JSON.parse(String(createRequest?.body))).toEqual({
      deadline: "2026-08-20",
      targetCount: 5,
    });
    expect(toast.success).toHaveBeenCalledWith("Ціль створено");
  });
});
