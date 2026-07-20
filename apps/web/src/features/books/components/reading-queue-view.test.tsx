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
const filters = messages.books.library.filters;
const priority = messages.books.organization.priority;
const readingStatus = messages.books.readingStatus.options;

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

const emptyPage = { items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 };

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
      if (url.includes("/api/reading-queue")) return respond();
      if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(genresFixture));
      if (url.includes("/recent")) return Promise.resolve(jsonResponse([]));
      if (
        url.includes("/api/tags") ||
        url.includes("/api/authors") ||
        url.includes("/api/publishers")
      ) {
        return Promise.resolve(jsonResponse(emptyPage));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function queueItem(position: number, id: string, title: string): ReadingQueueItemView {
  return { book: makeBookView({ id, isInReadingQueue: true, title }), position };
}

function queueItemWith(
  position: number,
  overrides: Parameters<typeof makeBookView>[0],
): ReadingQueueItemView {
  return { book: makeBookView({ isInReadingQueue: true, ...overrides }), position };
}

function queueView(items: ReadingQueueItemView[]) {
  return {
    count: items.length,
    items,
    totalPagesCount: items.reduce((sum, item) => sum + (item.book.pagesCount ?? 0), 0),
  };
}

function twoPriorityItems() {
  return queueView([
    queueItemWith(1, { id: "book-1", queuePriority: "high", title: "Пріоритетна" }),
    queueItemWith(2, { id: "book-2", queuePriority: "low", title: "Звичайна" }),
  ]);
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

  it("narrows the queue to matching books when a priority filter is applied", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse(twoPriorityItems())));

    renderWithProviders(<ReadingQueueView />);
    await screen.findByText("Пріоритетна");
    expect(screen.getByText("Звичайна")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: filters.trigger }));
    await userEvent.click(await screen.findByRole("button", { name: priority.high.label }));
    await userEvent.click(screen.getByRole("button", { name: filters.apply }));

    expect(await screen.findByText("Пріоритетна")).toBeInTheDocument();
    expect(screen.queryByText("Звичайна")).not.toBeInTheDocument();
  });

  it("restores the full queue after the priority filter is cleared", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse(twoPriorityItems())));

    renderWithProviders(<ReadingQueueView />);
    await screen.findByText("Пріоритетна");

    await userEvent.click(screen.getByRole("button", { name: filters.trigger }));
    await userEvent.click(await screen.findByRole("button", { name: priority.high.label }));
    await userEvent.click(screen.getByRole("button", { name: filters.apply }));
    expect(screen.queryByText("Звичайна")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
    await userEvent.click(await screen.findByRole("button", { name: filters.clear }));
    await userEvent.click(screen.getByRole("button", { name: filters.apply }));

    expect(await screen.findByText("Звичайна")).toBeInTheDocument();
    expect(screen.getByText("Пріоритетна")).toBeInTheDocument();
  });

  it("omits reading statuses that cannot appear in the queue", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse(twoPriorityItems())));

    renderWithProviders(<ReadingQueueView />);
    await screen.findByText("Пріоритетна");

    await userEvent.click(screen.getByRole("button", { name: filters.trigger }));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: readingStatus.not_started }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: readingStatus.reading }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: readingStatus.finished }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: readingStatus.rereading }),
    ).not.toBeInTheDocument();
  });

  it("disables the drag handle and shows an info hint while filtering", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse(twoPriorityItems())));

    renderWithProviders(<ReadingQueueView />);
    await screen.findByText("Пріоритетна");
    expect(screen.getByText(copy.toolbar.dragHint)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: filters.trigger }));
    await userEvent.click(await screen.findByRole("button", { name: priority.high.label }));
    await userEvent.click(screen.getByRole("button", { name: filters.apply }));

    expect(await screen.findByText(copy.toolbar.dragDisabledHint)).toBeInTheDocument();
    expect(screen.queryByText(copy.toolbar.dragHint)).not.toBeInTheDocument();

    const handle = screen.getByRole("button", {
      name: copy.item.reorderAria.replace("{title}", "Пріоритетна"),
    });
    expect(handle).toBeDisabled();
  });
});
