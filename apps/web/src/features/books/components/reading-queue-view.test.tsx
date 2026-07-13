import "@testing-library/jest-dom/vitest";

import type { ReadingQueueItemView } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { ReadingQueueView } from "./reading-queue-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.readingQueue;

const genresFixture = [
  {
    groupKey: "fiction",
    groupName: "Художня література",
    id: "genre-fantasy",
    isDefault: true,
    key: "fantasy",
    name: "Фентезі",
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockQueueFetch(respond: () => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(genresFixture));
      if (url.includes("/api/reading-queue")) return respond();
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function queueItem(position: number, id: string, title: string): ReadingQueueItemView {
  return { book: makeBookView({ id, isInReadingQueue: true, title }), position };
}

function queueView(items: ReadingQueueItemView[]) {
  return {
    count: items.length,
    items,
    totalPagesCount: items.reduce((sum, item) => sum + (item.book.pagesCount ?? 0), 0),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReadingQueueView", () => {
  it("shows a busy skeleton while the queue is loading", () => {
    mockQueueFetch(() => new Promise<Response>(() => {}));

    renderWithProviders(<ReadingQueueView />);

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(screen.queryByText(copy.empty.title)).not.toBeInTheDocument();
  });

  it("shows an error state with a retry action when the queue fails to load", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));

    renderWithProviders(<ReadingQueueView />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.error.title);
    expect(screen.getByRole("button", { name: copy.error.retry })).toBeInTheDocument();
  });

  it("shows the empty-queue state when the queue has no books", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse(queueView([]))));

    renderWithProviders(<ReadingQueueView />);

    expect(await screen.findByText(copy.empty.title)).toBeInTheDocument();
    expect(screen.queryByText(copy.noSearchResults.title)).not.toBeInTheDocument();
  });

  it("lists the queued books with their positions", async () => {
    mockQueueFetch(() =>
      Promise.resolve(
        jsonResponse(
          queueView([queueItem(1, "book-1", "Перша книга"), queueItem(2, "book-2", "Друга книга")]),
        ),
      ),
    );

    renderWithProviders(<ReadingQueueView />);

    expect(await screen.findByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("Друга книга")).toBeInTheDocument();
  });

  it("shows the no-results state instead of the list when a search matches nothing", async () => {
    mockQueueFetch(() =>
      Promise.resolve(
        jsonResponse(
          queueView([queueItem(1, "book-1", "Перша книга"), queueItem(2, "book-2", "Друга книга")]),
        ),
      ),
    );

    renderWithProviders(<ReadingQueueView />);
    await screen.findByText("#1");

    await userEvent.type(screen.getByRole("textbox", { name: copy.toolbar.searchLabel }), "zzzzzz");

    expect(await screen.findByText(copy.noSearchResults.title)).toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
    expect(screen.queryByText(copy.empty.title)).not.toBeInTheDocument();
  });

  it("renders localized genre names on queued books rather than raw keys", async () => {
    const book = makeBookView({
      genres: ["fantasy"],
      id: "book-1",
      tags: [],
      title: "Перша книга",
    });
    mockQueueFetch(() => Promise.resolve(jsonResponse(queueView([{ book, position: 1 }]))));

    renderWithProviders(<ReadingQueueView />);

    expect(await screen.findByText("Фентезі")).toBeInTheDocument();
    expect(screen.queryByText("fantasy")).not.toBeInTheDocument();
  });

  it("surfaces the reading-now badge after starting a book that stays in the queue", async () => {
    const queuedBook = makeBookView({
      id: "book-1",
      isInReadingQueue: true,
      readingStatus: "not_started",
      title: "Перша книга",
    });
    const startedBook = makeBookView({
      id: "book-1",
      isInReadingQueue: true,
      readingStatus: "reading",
      title: "Перша книга",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(genresFixture));
        if (url.includes("/start-reading") && method === "POST") {
          return Promise.resolve(jsonResponse(queueView([{ book: startedBook, position: 1 }])));
        }
        if (url.includes("/api/reading-queue")) {
          return Promise.resolve(jsonResponse(queueView([{ book: queuedBook, position: 1 }])));
        }
        return Promise.reject(new Error(`unexpected ${method} ${url}`));
      }),
    );

    renderWithProviders(<ReadingQueueView />);

    const article = await screen.findByRole("article");
    expect(within(article).queryByText(copy.item.readingNow)).not.toBeInTheDocument();

    await userEvent.click(within(article).getByRole("button", { name: copy.item.startReading }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: copy.start.removeLabel }));
    await userEvent.click(within(dialog).getByRole("button", { name: copy.start.confirm }));

    expect(await screen.findByText(copy.item.readingNow)).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getByText("Перша книга")).toBeInTheDocument();
  });
});
