import "@testing-library/jest-dom/vitest";

import type { CustomListDetail } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { listKeys } from "../api/list-keys";
import {
  makeCustomListDetail,
  makeListBookView,
  makeListOverviewView,
  makeRelatedListView,
} from "../model/lists.fixtures";
import { ListDetailsView } from "./list-details-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToRemove: () => Response;
let respondToOverview: () => Response;
let respondToRelated: () => Response;
let respondToMove: () => Response;

type RenderViewOptions = {
  hasMemory?: boolean;
  onUrlUpdate?: OnUrlUpdateFunction;
  overrides?: Partial<ViewProps>;
  searchParams?: Record<string, string>;
};

type ViewProps = Parameters<typeof ListDetailsView>[0];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastSearchParams(events: UrlUpdateEvent[]): URLSearchParams {
  const last = events.at(-1);
  if (last === undefined) throw new Error("no url update was recorded");
  return last.searchParams;
}

function renderPopulatedList(options: RenderViewOptions = {}) {
  return renderView(
    [
      makeCustomListDetail({
        bookCount: 20,
        books: {
          items: [makeListBookView({ id: "b1", position: 1, title: "Перша" })],
          totalCount: 20,
        },
        statusCounts: { all: 20, finished: 4, not_started: 13, reading: 3 },
      }),
    ],
    options,
  );
}

function renderTwoBookList(options: RenderViewOptions = {}) {
  return renderView(
    [
      makeCustomListDetail({
        bookCount: 2,
        books: {
          items: [
            makeListBookView({ id: "b1", position: 1, title: "Перша" }),
            makeListBookView({ id: "b2", position: 2, title: "Друга" }),
          ],
          totalCount: 2,
        },
        statusCounts: { all: 2, finished: 0, not_started: 2, reading: 0 },
      }),
    ],
    options,
  );
}

function renderView(pages: CustomListDetail[], options: RenderViewOptions = {}) {
  const props: ViewProps = {
    hasNextPage: false,
    id: "list-1",
    isFetching: false,
    isFetchingNextPage: false,
    onLoadMore: vi.fn(),
    pages,
    ...options.overrides,
  };
  return renderWithProviders(
    <NuqsTestingAdapter
      hasMemory={options.hasMemory}
      onUrlUpdate={options.onUrlUpdate}
      searchParams={options.searchParams}
    >
      <ListDetailsView {...props} />
    </NuqsTestingAdapter>,
  );
}

function sidebar() {
  return within(screen.getByRole("complementary", { name: "Більше про добірку" }));
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

beforeEach(() => {
  respondToRemove = () => new Response(null, { status: 204 });
  respondToMove = () => new Response(null, { status: 204 });
  respondToOverview = () => jsonResponse(makeListOverviewView());
  respondToRelated = () => jsonResponse({ lists: [] });
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/facets")) return Promise.resolve(jsonResponse({ authors: [], genres: [] }));
    if (url.includes("/overview")) return Promise.resolve(respondToOverview());
    if (url.includes("/related")) return Promise.resolve(respondToRelated());
    if (url.includes("/goal")) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes("/position") && method === "PATCH") return Promise.resolve(respondToMove());
    if (url.includes("/api/lists") && method === "DELETE")
      return Promise.resolve(respondToRemove());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ListDetailsView", () => {
  it("renders the list header and each book with its position", () => {
    renderView([
      makeCustomListDetail({
        books: {
          items: [
            makeListBookView({ id: "b1", position: 1, title: "Перша" }),
            makeListBookView({ id: "b2", position: 2, title: "Друга" }),
          ],
        },
        name: "Мій список",
      }),
    ]);

    expect(screen.getByRole("heading", { level: 1, name: "Мій список" })).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("shows the empty state when the list has no books", () => {
    renderView([makeCustomListDetail({ books: { items: [] }, name: "Порожній список" })]);

    expect(screen.getByText("У цьому списку ще немає книг")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Повернутися до списків" })).toBeInTheDocument();
  });

  it("removes a book and offers an undo action through a toast", async () => {
    renderView([
      makeCustomListDetail({
        books: { items: [makeListBookView({ id: "b1", position: 1, title: "Перша" })] },
      }),
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Дії з книгою: Перша" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Прибрати зі списку" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        "Книгу прибрано зі списку",
        expect.objectContaining({ action: expect.objectContaining({ label: "Скасувати" }) }),
      ),
    );
  });

  it("renders quick tab counts from statusCounts instead of the loaded books", () => {
    renderView([
      makeCustomListDetail({
        bookCount: 100,
        books: { items: [makeListBookView({ id: "b1", position: 1, title: "Перша" })] },
        statusCounts: { all: 100, finished: 28, not_started: 62, reading: 4 },
      }),
    ]);

    expect(screen.getByRole("button", { name: "Усі 100" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Не розпочаті 62" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Читаю 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Прочитані 28" })).toBeInTheDocument();
  });

  it("selects a quick tab and clears the explicit statuses", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderView(
      [
        makeCustomListDetail({
          bookCount: 100,
          books: { items: [makeListBookView({ id: "b1", position: 1, title: "Перша" })] },
          statusCounts: { all: 100, finished: 28, not_started: 62, reading: 4 },
        }),
      ],
      { onUrlUpdate, searchParams: { status: "reading" } },
    );

    const finishedTab = screen.getByRole("button", { name: "Прочитані 28" });
    expect(finishedTab).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(finishedTab);

    const params = lastSearchParams(events);
    expect(params.get("tab")).toBe("finished");
    expect(params.getAll("status")).toEqual([]);
  });

  it("returns the quick tab to all when explicit statuses are applied", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderView(
      [
        makeCustomListDetail({
          bookCount: 100,
          books: { items: [makeListBookView({ id: "b1", position: 1, title: "Перша" })] },
          statusCounts: { all: 100, finished: 28, not_started: 62, reading: 4 },
        }),
      ],
      { onUrlUpdate, searchParams: { tab: "reading" } },
    );

    await userEvent.click(screen.getByRole("button", { name: "Фільтри" }));
    await userEvent.click(screen.getByRole("button", { name: "Прочитано" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати" }));

    const params = lastSearchParams(events);
    expect(params.getAll("status")).toEqual(["finished"]);
    expect(params.get("tab")).toBeNull();
  });

  it("offers a filter reset instead of a search reset when filters emptied the page", () => {
    renderView(
      [
        makeCustomListDetail({
          bookCount: 12,
          books: { items: [], totalCount: 0 },
          statusCounts: { all: 12, finished: 3, not_started: 8, reading: 1 },
        }),
      ],
      { searchParams: { genre: "fantasy", q: "толкін" } },
    );

    expect(screen.getByRole("button", { name: "Скинути фільтри" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Очистити пошук" })).not.toBeInTheDocument();
  });

  it("offers a search reset when only the search emptied the page", () => {
    renderView(
      [
        makeCustomListDetail({
          bookCount: 12,
          books: { items: [], totalCount: 0 },
          statusCounts: { all: 12, finished: 3, not_started: 8, reading: 1 },
        }),
      ],
      { searchParams: { q: "толкін" } },
    );

    expect(screen.getByRole("button", { name: "Очистити пошук" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Скинути фільтри" })).not.toBeInTheDocument();
  });
});

describe("ListDetailsView statistics cards", () => {
  it("renders the four cards from the overview", async () => {
    renderPopulatedList();

    expect(await screen.findByText("Усього книг")).toBeInTheDocument();
    expect(screen.getByText("У черзі читання")).toBeInTheDocument();
    expect(screen.getByText("Є у власності")).toBeInTheDocument();

    expect(screen.getByText("Від 8 різних авторів")).toBeInTheDocument();
    expect(screen.getByText("20% усієї добірки")).toBeInTheDocument();
    expect(screen.getByText("17 книг ще не додано до черги")).toBeInTheDocument();
    expect(screen.getByText("8 книг ще не у власності")).toBeInTheDocument();
  });

  it("switches to the empty captions when nothing is finished, queued or owned", async () => {
    respondToOverview = () =>
      jsonResponse(makeListOverviewView({ finishedCount: 0, inQueueCount: 0, ownedCount: 0 }));
    renderPopulatedList();

    expect(await screen.findByText("Ще жодної прочитаної книги")).toBeInTheDocument();
    expect(screen.getByText("Жодної книги ще не заплановано")).toBeInTheDocument();
    expect(screen.getByText("Жодної книги ще немає у власності")).toBeInTheDocument();
  });

  it("switches to the full captions when the whole list is queued and owned", async () => {
    respondToOverview = () =>
      jsonResponse(makeListOverviewView({ inQueueCount: 20, ownedCount: 20 }));
    renderPopulatedList();

    expect(await screen.findByText("Уся добірка вже запланована")).toBeInTheDocument();
    expect(screen.getByText("Уся добірка у власності")).toBeInTheDocument();
  });

  it("renders no cards at all when the overview counts no books", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeListOverviewView({
          distinctAuthorsCount: 0,
          finishedCount: 0,
          genresCount: 0,
          inQueueCount: 0,
          ownedCount: 0,
          pagesKnownCount: 0,
          seriesCount: 0,
          soloCount: 0,
          topGenres: [],
          totalBooks: 0,
          totalPages: 0,
        }),
      );
    const { queryClient } = renderPopulatedList();

    await waitFor(() =>
      expect(queryClient.getQueryData(listKeys.overview("list-1"))).toBeDefined(),
    );

    expect(screen.queryByText("Усього книг")).not.toBeInTheDocument();
    expect(screen.queryByText("У черзі читання")).not.toBeInTheDocument();
    expect(screen.queryByText("Є у власності")).not.toBeInTheDocument();
    expect(screen.queryByText("Ще жодної прочитаної книги")).not.toBeInTheDocument();
  });
});

describe("ListDetailsView sidebar", () => {
  it("hides the currently reading block when nothing is being read", async () => {
    const { queryClient } = renderPopulatedList();

    await waitFor(() =>
      expect(queryClient.getQueryData(listKeys.overview("list-1"))).toBeDefined(),
    );

    expect(screen.queryByText("Зараз читаються")).not.toBeInTheDocument();
  });

  it("shows the reading position, a labelled progress bar and the other readers count", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeListOverviewView({
          currentlyReading: {
            book: makeListBookView({
              id: "b9",
              pagesCount: 320,
              readingProgress: {
                abandonedAt: null,
                currentPage: 128,
                finishedAt: null,
                impression: null,
                lastProgressUpdateAt: null,
                note: null,
                pausedAt: null,
                rating: null,
                startedAt: "2026-02-01",
              },
              title: "Час убивць",
            }),
            othersCount: 2,
          },
        }),
      );
    renderPopulatedList();

    expect(await sidebar().findByText("Час убивць")).toBeInTheDocument();
    expect(sidebar().getByText("стор. 128 з 320 · 40%")).toBeInTheDocument();
    expect(sidebar().getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(sidebar().getByText("Ще 2 книги читаються")).toBeInTheDocument();
  });

  it("omits the percent and the other readers count when the page total is unknown", async () => {
    respondToOverview = () =>
      jsonResponse(
        makeListOverviewView({
          currentlyReading: {
            book: makeListBookView({
              id: "b9",
              pagesCount: null,
              readingProgress: {
                abandonedAt: null,
                currentPage: 128,
                finishedAt: null,
                impression: null,
                lastProgressUpdateAt: null,
                note: null,
                pausedAt: null,
                rating: null,
                startedAt: "2026-02-01",
              },
              title: "Час убивць",
            }),
            othersCount: 0,
          },
        }),
      );
    renderPopulatedList();

    expect(await sidebar().findByText("стор. 128")).toBeInTheDocument();
    expect(sidebar().queryByText(/40%/)).not.toBeInTheDocument();
    expect(sidebar().queryByRole("progressbar")).not.toBeInTheDocument();
    expect(sidebar().queryByText(/Ще \d+ книг/)).not.toBeInTheDocument();
  });

  it("clarifies the page total only while some books have no page count", async () => {
    respondToOverview = () => jsonResponse(makeListOverviewView({ pagesKnownCount: 17 }));
    renderPopulatedList();

    expect(await sidebar().findByText("7 840 сторінок")).toBeInTheDocument();
    expect(sidebar().getByText("Для 17 із 20 книг")).toBeInTheDocument();
    expect(sidebar().getByText("6 жанрів")).toBeInTheDocument();
    expect(sidebar().getByText("2 серії · 18 окремих книг")).toBeInTheDocument();
  });

  it("drops the page clarification once every book has a page count", async () => {
    renderPopulatedList();

    expect(await sidebar().findByText("7 840 сторінок")).toBeInTheDocument();
    expect(sidebar().queryByText(/Для \d+ із/)).not.toBeInTheDocument();
  });

  it("hides the related lists block when nothing is shared", async () => {
    const { queryClient } = renderPopulatedList();

    await waitFor(() => expect(queryClient.getQueryData(listKeys.related("list-1"))).toBeDefined());

    expect(screen.queryByText("Спільні книги з іншими списками")).not.toBeInTheDocument();
  });

  it("expands the related lists inside the block instead of navigating away", async () => {
    respondToRelated = () =>
      jsonResponse({
        lists: [
          makeRelatedListView({ id: "33333333-3333-4333-8333-333333333331", name: "Осінь" }),
          makeRelatedListView({ id: "33333333-3333-4333-8333-333333333332", name: "Зима" }),
          makeRelatedListView({ id: "33333333-3333-4333-8333-333333333333", name: "Весна" }),
          makeRelatedListView({
            bookCount: 8,
            id: "33333333-3333-4333-8333-333333333334",
            name: "Літо",
            sharedCount: 6,
          }),
        ],
      });
    renderPopulatedList();

    expect(await sidebar().findByRole("link", { name: /Осінь/ })).toBeInTheDocument();
    expect(sidebar().queryByRole("link", { name: /Літо/ })).not.toBeInTheDocument();

    await userEvent.click(sidebar().getByRole("button", { name: "Показати всі (4)" }));

    const summerRow = sidebar().getByRole("link", { name: /Літо/ });
    expect(summerRow).toHaveAttribute("href", "/lists/33333333-3333-4333-8333-333333333334");
    expect(summerRow).toHaveTextContent("6 спільних книг з 8");
    expect(sidebar().getByRole("button", { name: "Згорнути" })).toBeInTheDocument();
  });
});

describe("ListDetailsView manual order", () => {
  async function openBookMenu(title: string) {
    await userEvent.click(screen.getByRole("button", { name: `Дії з книгою: ${title}` }));
  }

  function moveItems() {
    return {
      down: screen.getByRole("menuitem", { name: "Перемістити нижче" }),
      up: screen.getByRole("menuitem", { name: "Перемістити вище" }),
    };
  }

  it("keeps the handle and the move actions available under the default sort", async () => {
    renderTwoBookList();

    expect(
      screen.getByRole("button", { name: /^Змінити порядок книги «Друга»/u }),
    ).toBeInTheDocument();

    await openBookMenu("Друга");

    expect(moveItems().up).not.toHaveAttribute("aria-disabled", "true");
    expect(moveItems().down).toHaveAttribute("aria-disabled", "true");
  });

  it("locks reordering while a search is active", async () => {
    renderTwoBookList({ searchParams: { q: "толкін" } });

    expect(
      screen.queryByRole("button", { name: /^Змінити порядок книги «Друга»/u }),
    ).not.toBeInTheDocument();

    await openBookMenu("Друга");

    expect(moveItems().up).toHaveAttribute("aria-disabled", "true");
    expect(moveItems().down).toHaveAttribute("aria-disabled", "true");
  });

  it("locks reordering while a filter is active", async () => {
    renderTwoBookList({ searchParams: { genre: "fantasy" } });

    expect(
      screen.queryByRole("button", { name: /^Змінити порядок книги «Друга»/u }),
    ).not.toBeInTheDocument();

    await openBookMenu("Друга");

    expect(moveItems().up).toHaveAttribute("aria-disabled", "true");
    expect(moveItems().down).toHaveAttribute("aria-disabled", "true");
  });

  it("locks reordering under any sort other than the position", async () => {
    renderTwoBookList({ searchParams: { sort: "title_asc" } });

    expect(
      screen.queryByRole("button", { name: /^Змінити порядок книги «Друга»/u }),
    ).not.toBeInTheDocument();

    await openBookMenu("Друга");

    expect(moveItems().up).toHaveAttribute("aria-disabled", "true");
    expect(moveItems().down).toHaveAttribute("aria-disabled", "true");
  });

  it("announces the new position after a move", async () => {
    renderTwoBookList();

    await openBookMenu("Друга");
    await userEvent.click(screen.getByRole("menuitem", { name: "Перемістити вище" }));

    expect(
      await screen.findByText("Книгу «Друга» переміщено на позицію 1 з 2"),
    ).toBeInTheDocument();
  });
});

describe("ListDetailsView bulk selection", () => {
  async function enterSelection() {
    await userEvent.click(screen.getByRole("button", { name: "Вибрати" }));
  }

  it("selects only the loaded books and captions how many that is", async () => {
    renderView(
      [
        makeCustomListDetail({
          bookCount: 20,
          books: {
            items: [
              makeListBookView({ id: "b1", position: 1, title: "Перша" }),
              makeListBookView({ id: "b2", position: 2, title: "Друга" }),
            ],
            totalCount: 20,
          },
          statusCounts: { all: 20, finished: 0, not_started: 20, reading: 0 },
        }),
      ],
      { hasMemory: true },
    );

    await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Вибрати книгу «Перша»" }));

    expect(screen.getByText("Вибрано 1 із 2 завантажених")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Вибрати все" }));

    expect(screen.getByText("Вибрано 2 із 2 завантажених")).toBeInTheDocument();
  });

  it("drops the selection when the filtering conditions change", async () => {
    renderTwoBookList({ hasMemory: true });

    await enterSelection();
    await userEvent.click(screen.getByRole("checkbox", { name: "Вибрати книгу «Перша»" }));

    expect(screen.getByText("Вибрано 1 із 2 завантажених")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Прочитані 0" }));

    await waitFor(() =>
      expect(screen.queryByText("Вибрано 1 із 2 завантажених")).not.toBeInTheDocument(),
    );
  });
});
