import "@testing-library/jest-dom/vitest";

import type { Nullable, ReadingGoalBookView } from "@app/shared";
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

import type { GoalBooksScopeCounts } from "../model/goal-books-scope-counts";
import type { GoalBooksScope } from "../model/goal-detail-query";

import { goalBooksScopeCounts } from "../model/goal-books-scope-counts";
import { makeReadingGoalBook } from "../model/reading-goals.fixtures";
import { GoalBooksTab } from "./goal-books-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const GOAL_ID = "goal-1";
const BOOKS_PATH = `/api/goals/${GOAL_ID}/books`;
const NETWORK_LATENCY_MS = 10;
const ONE_COUNTED_BOOK: GoalBooksScopeCounts = { all: 1, counted: 1, remaining: 0 };

const fetchMock = vi.fn();
const viewport = mockIntersectionObserver();

let respondToBooks: (url: URL) => Response;

function booksPage(items: ReadingGoalBookView[], nextCursor: Nullable<string> = null) {
  return { items, nextCursor };
}

function booksRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === BOOKS_PATH);
}

function inProgressBook(pagesCount: Nullable<number>): ReadingGoalBookView {
  return makeReadingGoalBook({
    countedFinishedAt: null,
    qualifies: false,
    reading: {
      currentPage: 123,
      finishedAt: null,
      pagesCount,
      startedAt: "2026-10-01",
      status: "reading",
    },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function numberedBook(position: number): ReadingGoalBookView {
  return makeReadingGoalBook({
    id: `book-${position}`,
    snapshotPosition: position,
    title: `Книга ${position}`,
  });
}

function renderBooksTab(
  scope: GoalBooksScope = "all",
  counts: GoalBooksScopeCounts = ONE_COUNTED_BOOK,
  listFocusRequest: Nullable<number> = null,
) {
  const onScopeChange = vi.fn();
  renderWithProviders(
    <GoalBooksTab
      counts={counts}
      goalId={GOAL_ID}
      listFocusRequest={listFocusRequest}
      onScopeChange={onScopeChange}
      scope={scope}
    />,
  );
  return { onScopeChange };
}

beforeEach(() => {
  respondToBooks = () => jsonResponse(booksPage([makeReadingGoalBook()]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === BOOKS_PATH) return Promise.resolve(respondToBooks(url));
    return Promise.reject(new Error(`unexpected ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalBooksTab pagination", () => {
  it("asks for the first twenty books of every scope without a cursor", async () => {
    renderBooksTab();

    expect((await screen.findByText("Бігуни")).closest("a")).toHaveAttribute(
      "href",
      "/books/book-1",
    );
    const [firstRequest] = booksRequests();
    expect(firstRequest?.searchParams.get("limit")).toBe("20");
    expect(firstRequest?.searchParams.get("scope")).toBe("all");
    expect(firstRequest?.searchParams.has("cursor")).toBe(false);
  });

  it("sends the returned cursor for the next page and keeps the loaded one", async () => {
    respondToBooks = (url) =>
      url.searchParams.get("cursor") === "cursor-2"
        ? jsonResponse(booksPage([numberedBook(2)]))
        : jsonResponse(booksPage([numberedBook(1)], "cursor-2"));

    renderBooksTab();
    await screen.findByText("Книга 1");
    viewport.enterViewport();

    expect(await screen.findByText("Книга 2")).toBeInTheDocument();
    expect(screen.getByText("Книга 1")).toBeInTheDocument();
    expect(booksRequests().map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "cursor-2",
    ]);
  });

  it("loads every book past a hundred through the cursor instead of a capped preview", async () => {
    const pageCount = 6;
    respondToBooks = (url) => {
      const page = Number(url.searchParams.get("cursor") ?? "0");
      const items = Array.from({ length: 20 }, (_, index) => numberedBook(page * 20 + index + 1));
      return jsonResponse(booksPage(items, page + 1 < pageCount ? String(page + 1) : null));
    };
    fetchMock.mockImplementation(
      (input: RequestInfo | URL) =>
        new Promise<Response>((resolve) => {
          setTimeout(
            () => resolve(respondToBooks(new URL(String(input), "http://localhost"))),
            NETWORK_LATENCY_MS,
          );
        }),
    );

    renderBooksTab();
    await screen.findByText("Книга 1");
    viewport.enterViewport();

    expect(await screen.findByText("Книга 120", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(120);
    expect(booksRequests()).toHaveLength(pageCount);
  });
});

describe("GoalBooksTab scope", () => {
  it("asks the server for the counted books only", async () => {
    renderBooksTab("counted");

    await screen.findByText("Бігуни");
    expect(booksRequests()[0]?.searchParams.get("scope")).toBe("counted");
  });

  it("hands the chosen scope to the URL state", async () => {
    const { onScopeChange } = renderBooksTab();
    await screen.findByText("Бігуни");

    await userEvent.click(screen.getByRole("radio", { name: /^Ще не зараховані/ }));

    expect(onScopeChange).toHaveBeenCalledWith("remaining");
  });

  it("counts every snapshot book, the counted ones and the rest on the scope chips", async () => {
    renderBooksTab("all", goalBooksScopeCounts({ completedCount: 2, snapshotBookCount: 5 }));
    await screen.findByText("Бігуни");

    expect(within(screen.getByRole("radio", { name: /^Усі/ })).getByText("5")).toBeInTheDocument();
    expect(
      within(screen.getByRole("radio", { name: /^Зараховані/ })).getByText("2"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("radio", { name: /^Ще не зараховані/ })).getByText("3"),
    ).toBeInTheDocument();
  });

  it("keeps the snapshot note to one line and opens the full explanation from the keyboard", async () => {
    renderBooksTab();
    await screen.findByText("Бігуни");
    const snapshotHint =
      "Склад книг зафіксовано під час створення цілі, тож пізніші зміни списку на неї не впливають. Книга зараховується, якщо її дочитано з дня створення цілі по день дедлайну включно.";
    const more = screen.getByRole("button", { name: "Докладніше" });

    expect(screen.getByText("Книги цілі зафіксовано під час її створення.")).toBeInTheDocument();
    expect(screen.queryByText(snapshotHint)).not.toBeInTheDocument();

    more.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText(snapshotHint)).toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "true");
  });
});

describe("GoalBooksTab focus", () => {
  it("moves focus to the list of goal books when asked to on mount", async () => {
    renderBooksTab("all", ONE_COUNTED_BOOK, 1);
    await screen.findByText("Бігуни");

    expect(screen.getByRole("region", { name: "Книги цілі" })).toHaveFocus();
  });

  it("leaves focus where it was when not asked to focus the list", async () => {
    renderBooksTab();
    await screen.findByText("Бігуни");

    expect(screen.getByRole("region", { name: "Книги цілі" })).not.toHaveFocus();
  });

  it("moves focus back to the list on every new request while the tab stays open", async () => {
    function booksTab(listFocusRequest: Nullable<number>) {
      return (
        <GoalBooksTab
          counts={ONE_COUNTED_BOOK}
          goalId={GOAL_ID}
          listFocusRequest={listFocusRequest}
          onScopeChange={vi.fn()}
          scope="all"
        />
      );
    }

    const { rerender } = renderWithProviders(booksTab(null));
    await screen.findByText("Бігуни");
    const list = screen.getByRole("region", { name: "Книги цілі" });
    const countedChip = screen.getByRole("radio", { name: /^Зараховані/ });
    const remainingChip = screen.getByRole("radio", { name: /^Ще не зараховані/ });

    await userEvent.click(countedChip);
    expect(countedChip).toHaveFocus();
    rerender(booksTab(1));
    expect(list).toHaveFocus();

    await userEvent.click(remainingChip);
    expect(remainingChip).toHaveFocus();
    rerender(booksTab(2));
    expect(list).toHaveFocus();
  });
});

describe("GoalBooksTab rows", () => {
  it("tells a counted finish apart from a finish outside the goal period", async () => {
    respondToBooks = () =>
      jsonResponse(
        booksPage([
          makeReadingGoalBook({ id: "book-1", title: "Бігуни" }),
          makeReadingGoalBook({
            countedFinishedAt: null,
            id: "book-2",
            qualifies: false,
            reading: {
              currentPage: null,
              finishedAt: "2026-08-01",
              pagesCount: 280,
              startedAt: "2026-07-10",
              status: "finished",
            },
            title: "Книга Якова",
          }),
        ]),
      );

    renderBooksTab();

    const countedRow = (await screen.findByText("Бігуни")).closest("li");
    const outsideRow = screen.getByText("Книга Якова").closest("li");
    if (countedRow === null || outsideRow === null) throw new Error("rows are missing");

    expect(within(countedRow).getByText("Зараховано")).toBeInTheDocument();
    expect(within(countedRow).getByText(/^дочитано /)).toBeInTheDocument();
    expect(within(outsideRow).getByText("Не зараховано")).toBeInTheDocument();
    expect(within(outsideRow).getByText(/поза періодом цілі/)).toBeInTheDocument();
    expect(within(outsideRow).queryByText("Зараховано")).not.toBeInTheDocument();
  });

  it("shows the current page of a book in progress and survives missing cover and authors", async () => {
    respondToBooks = () =>
      jsonResponse(
        booksPage([
          makeReadingGoalBook({
            authors: [],
            countedFinishedAt: null,
            cover: null,
            qualifies: false,
            reading: {
              currentPage: 120,
              finishedAt: null,
              pagesCount: null,
              startedAt: "2026-10-01",
              status: "reading",
            },
          }),
        ]),
      );

    renderBooksTab();

    expect(await screen.findByText("стор. 120")).toBeInTheDocument();
    expect(screen.getByText("Читаю")).toBeInTheDocument();
  });

  it("measures a book in progress against its page count without counting it", async () => {
    respondToBooks = () => jsonResponse(booksPage([inProgressBook(368)]));

    renderBooksTab();

    const pagesBar = await screen.findByRole("progressbar", { name: "Прочитано 33% книги" });
    expect(pagesBar).toHaveAttribute("aria-valuenow", "33");
    expect(pagesBar).toHaveAttribute("aria-valuemin", "0");
    expect(pagesBar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("стор. 123 із 368 · 33%")).toBeInTheDocument();
    expect(screen.getByText("Читаю")).toBeInTheDocument();
    expect(screen.queryByText("Зараховано")).not.toBeInTheDocument();
  });

  it("shows only the page reached when the book has no page count", async () => {
    respondToBooks = () => jsonResponse(booksPage([inProgressBook(null)]));

    renderBooksTab();

    expect(await screen.findByText("стор. 123")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("GoalBooksTab states", () => {
  it("offers a retry when the first page fails and asks for it again", async () => {
    respondToBooks = () => jsonResponse({ message: "boom" }, 500);

    renderBooksTab();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити книги цілі")).toBeInTheDocument();
    const requestsBeforeRetry = booksRequests().length;

    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    await waitFor(() => expect(booksRequests().length).toBeGreaterThan(requestsBeforeRetry));
  });

  it("explains an empty remaining scope and offers every book instead", async () => {
    respondToBooks = () => jsonResponse(booksPage([]));
    const { onScopeChange } = renderBooksTab("remaining");

    expect(await screen.findByText("Незарахованих книг немає")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати всі книги" }));

    expect(onScopeChange).toHaveBeenCalledWith("all");
  });

  it("illustrates an empty counted scope and offers every book instead", async () => {
    respondToBooks = () => jsonResponse(booksPage([]));
    const { onScopeChange } = renderBooksTab("counted", { all: 3, counted: 0, remaining: 3 });

    expect(
      await screen.findByRole("heading", { name: "Ще жодної книги не зараховано" }),
    ).toBeInTheDocument();
    const booksRegion = screen.getByRole("region", { name: "Книги цілі" });
    expect(within(booksRegion).getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("goal-no-counted-books-yet"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Показати всі книги" }));

    expect(onScopeChange).toHaveBeenCalledWith("all");
  });
});
