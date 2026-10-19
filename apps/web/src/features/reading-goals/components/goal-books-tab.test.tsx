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

import type { GoalBooksScope } from "../model/goal-detail-query";

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

function renderBooksTab(scope: GoalBooksScope = "all") {
  const onScopeChange = vi.fn();
  renderWithProviders(
    <GoalBooksTab goalId={GOAL_ID} onScopeChange={onScopeChange} scope={scope} />,
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

    await userEvent.click(screen.getByRole("radio", { name: "Ще не зараховані" }));

    expect(onScopeChange).toHaveBeenCalledWith("remaining");
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
});
