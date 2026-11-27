import "@testing-library/jest-dom/vitest";

import type { ReadingQueueSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { AddBookToQueueDialog } from "./add-book-to-queue-dialog";
import { makeBookView } from "./book-details.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const add = messages.readingQueue.add;
const position = messages.readingQueue.position;
const fetchMock = vi.fn();

let respondToAdd: () => Response;
let respondToBooks: (url: URL) => unknown;
let queuedCount: number;

function addRequestBody() {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/reading-queue") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
  return JSON.parse(String(call?.[1].body));
}

function booksPage() {
  return {
    items: [
      makeBookView({ id: "book-available", isInReadingQueue: false, title: "Доступна книга" }),
      makeBookView({ id: "book-queued", isInReadingQueue: true, title: "Уже додана книга" }),
    ],
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: 2,
  };
}

function emptyBooksPage() {
  return { items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 };
}

function emptyQueue() {
  return { count: 0, items: [], totalCount: 0, totalPagesCount: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function queueSummary(totalCount: number): ReadingQueueSummaryView {
  return {
    availableNowCount: totalCount,
    blockedBySeriesOrderCount: 0,
    seriesBooksCount: 0,
    seriesInQueueCount: 0,
    standaloneBooksCount: totalCount,
    totalCount,
    unavailableByOwnership: { inTransit: 0, lentToSomeone: 0, none: 0, wantToBuy: 0 },
    unavailableCount: 0,
  };
}

const QUEUE_ITEMS = [
  { id: "q1", position: 1, title: "Черга 1" },
  { id: "q2", position: 2, title: "Черга 2" },
  { id: "q3", position: 3, title: "Черга 3" },
];

function renderDialog(queueItems = QUEUE_ITEMS) {
  return renderWithProviders(
    <AddBookToQueueDialog onOpenChange={vi.fn()} open queueItems={queueItems} />,
  );
}

beforeEach(() => {
  respondToAdd = () => jsonResponse(emptyQueue());
  respondToBooks = () => booksPage();
  queuedCount = 1;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/reading-queue") && method === "POST") {
      return Promise.resolve(respondToAdd());
    }
    if (url.includes("/api/reading-queue/summary")) {
      return Promise.resolve(jsonResponse(queueSummary(queuedCount)));
    }
    if (url.includes("/api/books")) {
      return Promise.resolve(jsonResponse(respondToBooks(new URL(url, "http://localhost"))));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddBookToQueueDialog", () => {
  it("disables books that are already in the queue", async () => {
    renderDialog();

    expect(await screen.findByRole("radio", { name: /Уже додана книга/ })).toBeDisabled();
    expect(screen.getByText(add.alreadyInQueue)).toBeInTheDocument();
  });

  it("reveals the placement selector only after a book is selected", async () => {
    renderDialog();
    await screen.findByRole("radio", { name: /Доступна книга/ });

    expect(screen.queryByText(position.legend)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Доступна книга/ }));

    expect(screen.getByText(position.legend)).toBeInTheDocument();
  });

  it("posts the selected book with the default end placement", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Доступна книга/ }));
    await userEvent.click(screen.getByRole("button", { name: add.submit }));

    await waitFor(() =>
      expect(addRequestBody()).toEqual({ bookId: "book-available", placement: "end" }),
    );
  });

  it("posts a specific position when chosen", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Доступна книга/ }));
    await userEvent.click(screen.getByRole("radio", { name: position.specific }));
    await userEvent.clear(screen.getByLabelText(position.positionLabel));
    await userEvent.type(screen.getByLabelText(position.positionLabel), "2");
    await userEvent.click(screen.getByRole("button", { name: add.submit }));

    await waitFor(() =>
      expect(addRequestBody()).toEqual({
        bookId: "book-available",
        placement: "specific",
        position: 2,
      }),
    );
  });

  it("surfaces the duplicate message when the server rejects with a conflict", async () => {
    respondToAdd = () => jsonResponse({ message: "duplicate" }, 409);
    renderDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Доступна книга/ }));
    await userEvent.click(screen.getByRole("button", { name: add.submit }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(add.duplicateToast));
  });
});

describe("AddBookToQueueDialog notices", () => {
  it("explains that every book is already in the queue", async () => {
    queuedCount = 2;
    renderDialog();

    expect(await screen.findByText(add.allQueued)).toBeInTheDocument();
  });

  it("links to a new book when every book is already in the queue", async () => {
    queuedCount = 2;
    renderDialog();

    expect(await screen.findByRole("link", { name: add.addNewBook })).toHaveAttribute(
      "href",
      "/books/new",
    );
  });

  it("keeps the selectable books while some are still out of the queue", async () => {
    renderDialog();

    expect(await screen.findByRole("radio", { name: /Доступна книга/ })).toBeEnabled();
    expect(screen.queryByText(add.allQueued)).not.toBeInTheDocument();
  });

  it("offers the first book when the library has no books", async () => {
    queuedCount = 0;
    respondToBooks = () => emptyBooksPage();
    renderDialog();

    expect(await screen.findByText(add.noBooks)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.books.firstBook.cta })).toHaveAttribute(
      "href",
      "/books/new",
    );
  });

  it("keeps the not-found message when a search matches no book", async () => {
    queuedCount = 2;
    respondToBooks = (url) => (url.searchParams.has("q") ? emptyBooksPage() : booksPage());
    renderDialog();
    await screen.findByText(add.allQueued);

    await userEvent.type(screen.getByRole("textbox", { name: add.searchLabel }), "zzz");

    expect(await screen.findByText(add.empty)).toBeInTheDocument();
    expect(screen.queryByText(add.allQueued)).not.toBeInTheDocument();
  });
});
