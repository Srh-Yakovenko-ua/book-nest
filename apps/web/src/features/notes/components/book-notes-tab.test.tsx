import "@testing-library/jest-dom/vitest";

import type { BookNotesFacetsView, BookView, NoteView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookTabScrollMemory } from "@/hooks/use-book-tab-scroll-anchor";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { createBookTabScrollMemory } from "@/hooks/use-book-tab-scroll-anchor";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeBookNote } from "../model/notes.fixtures";
import { BookNotesTab } from "./book-notes-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type ListReply = (url: URL) => Promise<Response>;

type PageMeta = { page: number; pagesCount: number; totalCount: number };

type TabRender = {
  book?: BookView;
  memory?: BookTabScrollMemory;
  onUrlUpdate?: OnUrlUpdateFunction;
  queryClient?: QueryClient;
  search?: string;
};

const BOOK = makeBookView({
  authors: [{ id: "author-1", name: "Френк Герберт" }],
  id: "book-1",
  title: "Дюна",
});

const OTHER_BOOK = makeBookView({ id: "book-2", title: "Месія Дюни" });

const FACETS: BookNotesFacetsView = {
  authors: [],
  books: [],
  categories: [],
  customCategories: [],
  quickCounts: { all: 1, favorite: 0, no_spoiler: 1, pinned: 0, with_spoiler: 0 },
};

const COPY = {
  addNote: "Додати нотатку",
  clearFilters: "Скинути фільтри",
  clearSearch: "Очистити пошук",
  emptyBook: "У цієї книги ще немає нотаток.",
  emptyFilters: "За цими фільтрами нотаток немає.",
  emptySearch: "Нічого не знайдено.",
  firstPageError: "Не вдалося завантажити нотатки.",
  loading: "Завантажуємо нотатки...",
  nextPageError: "Не вдалося завантажити наступні нотатки.",
  openSpoiler: "Показати нотатку",
  quickFilters: "Швидкі фільтри",
  refresh: "Оновити",
  retryNextPage: "Повторити",
  search: "Пошук у нотатках цієї книги",
  spoilerGate: "Ця нотатка містить спойлер",
  tabHeading: "Нотатки",
} as const;

const FORTY_ONE_NOTES = Array.from({ length: 41 }, (_, index) =>
  makeBookNote({ id: `note-${index + 1}`, text: `Нотатка номер ${index + 1}` }),
);

const LAYOUT = { cardHeight: 100, listTop: 200, resultsTop: 150 } as const;

const NETWORK_LATENCY_MS = 10;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const viewport = mockIntersectionObserver();

let respondToList: ListReply;

function cachingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: Infinity } },
  });
}

function filteredPageNumbers(filter: string): number[] {
  return listRequests()
    .filter((url) => url.searchParams.get("filter") === filter)
    .map(pageNumberOf);
}

async function findEmptyState(title: string): Promise<HTMLElement> {
  const container = (await screen.findByRole("heading", { name: title })).parentElement;
  if (container === null) throw new Error(`no empty state for ${title}`);
  return container;
}

function fortyOneNotesPage(url: URL): Promise<Response> {
  const page = pageNumberOf(url);
  return withNetworkLatency(
    json(
      notesPage(FORTY_ONE_NOTES.slice((page - 1) * 20, page * 20), {
        page,
        pagesCount: 3,
        totalCount: FORTY_ONE_NOTES.length,
      }),
    ),
  );
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function lastListRequest(): URLSearchParams {
  const request = listRequests().at(-1);
  if (request === undefined) throw new Error("no list request");
  return request.searchParams;
}

function lastUrl(events: UrlUpdateEvent[]): URLSearchParams {
  const event = events.at(-1);
  if (event === undefined) throw new Error("no url update");
  return event.searchParams;
}

function layOutNotesInOneColumn() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (!this.hasAttribute("data-note-id")) {
      return new DOMRect(0, LAYOUT.resultsTop - window.scrollY, 600, 0);
    }
    const row = Array.from(this.parentElement?.children ?? []).indexOf(this);
    return new DOMRect(
      0,
      LAYOUT.listTop + row * LAYOUT.cardHeight - window.scrollY,
      600,
      LAYOUT.cardHeight,
    );
  });
}

function listPageNumbers(): number[] {
  return listRequests().map(pageNumberOf);
}

function listRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/notes/books");
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function notesPage(items: NoteView[], meta: Partial<PageMeta> = {}) {
  return {
    items,
    page: meta.page ?? 1,
    pagesCount: meta.pagesCount ?? (items.length === 0 ? 0 : 1),
    pageSize: 20,
    totalCount: meta.totalCount ?? items.length,
  };
}

function pageNumberOf(url: URL): number {
  return Number(url.searchParams.get("pageNumber") ?? 1);
}

function pending(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

function renderTab({ book = BOOK, memory, onUrlUpdate, queryClient, search = "" }: TabRender = {}) {
  return renderWithProviders(tab({ book, memory, onUrlUpdate, search }), { queryClient });
}

function resultsStatus(): HTMLElement {
  const status = screen
    .getAllByRole("status")
    .find((element) => !element.hasAttribute("aria-busy"));
  if (status === undefined) throw new Error("no results status");
  return status;
}

async function scrollWindowTo(top: number) {
  window.scrollTo({ top });
  window.dispatchEvent(new Event("scroll"));
  await nextFrame();
}

function sentinelStatus(): HTMLElement | undefined {
  return screen.queryAllByRole("status").find((element) => element.hasAttribute("aria-busy"));
}

function tab({
  book = BOOK,
  memory = createBookTabScrollMemory(),
  onUrlUpdate,
  search = "",
}: Omit<TabRender, "queryClient">) {
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <BookNotesTab book={book} key={book.id} scrollMemory={memory} />
    </NuqsTestingAdapter>
  );
}

function withNetworkLatency(reply: Promise<Response>): Promise<Response> {
  return new Promise((resolve) => setTimeout(() => resolve(reply), NETWORK_LATENCY_MS));
}

beforeEach(() => {
  respondToList = () => json(notesPage([makeBookNote()]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/api/notes/books/facets") return json(FACETS);
    if (method === "GET" && url.pathname === "/api/notes/books") return respondToList(url);
    if (method === "GET" && url.pathname === "/api/books/book-1/chapters") {
      return json({ chapters: [] });
    }
    if (method === "GET" && url.pathname === "/api/books/book-1") {
      return json({ ...BOOK, notesCount: 1, quotesCount: 0 });
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.scrollTo({ top: 0 });
});

describe("BookNotesTab cards", () => {
  it("renders embedded cards without repeating the book title, author or cover", async () => {
    renderTab();

    const card = (await screen.findByText(makeBookNote().text)).closest("article");
    if (card === null) throw new Error("no card");

    expect(within(card).queryByText(BOOK.title)).not.toBeInTheDocument();
    expect(within(card).queryByText("Френк Герберт")).not.toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("keeps the spoiler text out of the DOM until the gate is opened", async () => {
    const spoiler = "Пол стає імператором.";
    respondToList = () => json(notesPage([makeBookNote({ isSpoiler: true, text: spoiler })]));

    renderTab();

    expect(await screen.findByText(COPY.spoilerGate)).toBeInTheDocument();
    expect(screen.queryByText(spoiler)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: COPY.openSpoiler }));

    expect(within(await screen.findByRole("dialog")).getByText(spoiler)).toBeInTheDocument();
  });
});

describe("BookNotesTab announcements", () => {
  it("titles the notes list so the card headings do not skip a level", async () => {
    renderTab();

    await screen.findByText(makeBookNote().text);

    expect(screen.getByRole("heading", { level: 2, name: COPY.tabHeading })).toBeInTheDocument();
  });

  it("announces the server total of the current criteria and the new total after a filter", async () => {
    respondToList = (url) =>
      url.searchParams.get("filter") === "pinned"
        ? json(notesPage(FORTY_ONE_NOTES.slice(0, 2), { totalCount: 2 }))
        : fortyOneNotesPage(url);

    renderTab();

    await screen.findByText("Нотатка номер 20");
    expect(resultsStatus()).toHaveTextContent("Знайдено 41 нотатку");

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Закріплені/ }));

    await waitFor(() => expect(resultsStatus()).toHaveTextContent("Знайдено 2 нотатки"));
  });
});

describe("BookNotesTab states", () => {
  it("shows the skeleton, never the empty state, before the first page arrives", () => {
    respondToList = pending;

    renderTab();

    expect(screen.getByLabelText(COPY.loading)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: COPY.emptyBook })).not.toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent(COPY.loading);
  });

  it("offers to add the first note to this book when it has none", async () => {
    respondToList = () => json(notesPage([]));

    renderTab();

    const empty = await findEmptyState(COPY.emptyBook);
    expect(screen.queryByLabelText(COPY.search)).not.toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent(COPY.emptyBook);

    await userEvent.click(within(empty).getByRole("button", { name: COPY.addNote }));

    const dialog = await screen.findByRole("dialog", { name: COPY.addNote });
    expect(within(dialog).getByText(BOOK.title)).toBeInTheDocument();
  });

  it("clears only the search when a search finds nothing", async () => {
    const events: UrlUpdateEvent[] = [];
    respondToList = () => json(notesPage([]));

    renderTab({
      onUrlUpdate: (event) => events.push(event),
      search: "?noteQ=дракон&noteSort=newest",
    });

    const empty = await findEmptyState(COPY.emptySearch);
    expect(resultsStatus()).toHaveTextContent(COPY.emptySearch);
    await userEvent.click(within(empty).getByRole("button", { name: COPY.clearSearch }));

    await waitFor(() => expect(lastUrl(events).get("noteQ")).toBeNull());
    expect(lastUrl(events).get("noteSort")).toBe("newest");
  });

  it("resets only the filters when the filters match nothing", async () => {
    const events: UrlUpdateEvent[] = [];
    respondToList = () => json(notesPage([]));

    renderTab({
      onUrlUpdate: (event) => events.push(event),
      search: "?noteFilter=favorite&noteSort=newest",
    });

    const empty = await findEmptyState(COPY.emptyFilters);
    expect(within(empty).queryByRole("button", { name: COPY.addNote })).not.toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent(COPY.emptyFilters);

    await userEvent.click(within(empty).getByRole("button", { name: COPY.clearFilters }));

    await waitFor(() => expect(lastUrl(events).get("noteFilter")).toBeNull());
    expect(lastUrl(events).get("noteSort")).toBe("newest");
  });

  it("retries the first page after it fails", async () => {
    respondToList = () => json({ message: "boom" }, 500);

    renderTab();

    expect(await screen.findByText(COPY.firstPageError)).toBeInTheDocument();
    respondToList = () => json(notesPage([makeBookNote()]));

    await userEvent.click(screen.getByRole("button", { name: COPY.refresh }));

    expect(await screen.findByText(makeBookNote().text)).toBeInTheDocument();
  });
});

describe("BookNotesTab endless scroll", () => {
  it("loads 41 notes as pages 1, 2 and 3 only while the sentinel is in view", async () => {
    respondToList = fortyOneNotesPage;

    renderTab();

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(sentinelStatus()).toHaveAttribute("aria-live", "polite");
    expect(listPageNumbers()).toEqual([1]);

    viewport.enterViewport();

    expect(await screen.findByText("Нотатка номер 41")).toBeInTheDocument();
    expect(listPageNumbers()).toEqual([1, 2, 3]);
    expect(screen.getAllByRole("article")).toHaveLength(41);

    viewport.enterViewport();

    await waitFor(() => expect(sentinelStatus()).toBeUndefined());
    expect(listPageNumbers()).toEqual([1, 2, 3]);
  });

  it("does not move focus when the observer appends a page", async () => {
    respondToList = fortyOneNotesPage;

    renderTab();

    await screen.findByText("Нотатка номер 20");
    const addButton = screen.getByRole("button", { name: COPY.addNote });
    addButton.focus();

    viewport.enterViewport();

    expect(await screen.findByText("Нотатка номер 41")).toBeInTheDocument();
    expect(addButton).toHaveFocus();
  });

  it("keeps the loaded cards when the next page fails and retries only that page", async () => {
    let failSecondPage = true;
    respondToList = (url) => {
      const page = pageNumberOf(url);
      if (page === 2 && failSecondPage) {
        failSecondPage = false;
        return json({ message: "boom" }, 500);
      }
      return json(
        notesPage([makeBookNote({ id: `note-${page}`, text: `Сторінка ${page}` })], {
          page,
          pagesCount: 2,
          totalCount: 2,
        }),
      );
    };

    renderTab();

    await screen.findByText("Сторінка 1");
    viewport.enterViewport();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(COPY.nextPageError);
    expect(screen.getByText("Сторінка 1")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: COPY.retryNextPage }));

    expect(await screen.findByText("Сторінка 2")).toBeInTheDocument();
    expect(screen.getByText("Сторінка 1")).toBeInTheDocument();
    expect(listPageNumbers()).toEqual([1, 2, 2]);
  });

  it("drops the error and its retry button while the retried next page is in flight", async () => {
    let replyToSecondPage: ListReply = () => json({ message: "boom" }, 500);
    respondToList = (url) =>
      pageNumberOf(url) === 2
        ? replyToSecondPage(url)
        : json(
            notesPage([makeBookNote({ id: "note-1", text: "Сторінка 1" })], {
              pagesCount: 2,
              totalCount: 2,
            }),
          );

    renderTab();

    await screen.findByText("Сторінка 1");
    viewport.enterViewport();
    const alert = await screen.findByRole("alert");
    replyToSecondPage = pending;

    await userEvent.click(within(alert).getByRole("button", { name: COPY.retryNextPage }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: COPY.retryNextPage })).not.toBeInTheDocument();
    expect(sentinelStatus()).toHaveAttribute("aria-busy", "true");
    expect(listPageNumbers()).toEqual([1, 2, 2]);
  });
});

describe("BookNotesTab cache", () => {
  it("shows the cached cards at once when the tab is opened again while it refetches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: 0 } },
    });
    const { rerender } = renderTab({ queryClient });

    await screen.findByText(makeBookNote().text);
    rerender(<NuqsTestingAdapter hasMemory>{null}</NuqsTestingAdapter>);
    expect(screen.queryByText(makeBookNote().text)).not.toBeInTheDocument();

    respondToList = pending;
    rerender(tab({}));

    expect(screen.getByText(makeBookNote().text)).toBeInTheDocument();
    expect(screen.queryByLabelText(COPY.loading)).not.toBeInTheDocument();
    await waitFor(() => expect(listPageNumbers()).toEqual([1, 1]));
  });

  it("shows the skeleton instead of the previous cards while new criteria load", async () => {
    respondToList = (url) =>
      url.searchParams.get("filter") === "pinned"
        ? pending()
        : json(notesPage([makeBookNote({ text: "Звичайна нотатка" })]));

    renderTab();

    await screen.findByText("Звичайна нотатка");
    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Закріплені/ }));

    expect(await screen.findByLabelText(COPY.loading)).toBeInTheDocument();
    expect(screen.queryByText("Звичайна нотатка")).not.toBeInTheDocument();
  });

  it("never renders the previous book's cards for another book", async () => {
    respondToList = (url) =>
      url.searchParams.get("book") === OTHER_BOOK.id
        ? pending()
        : json(notesPage([makeBookNote({ text: "Нотатка першої книги" })]));

    const { rerender } = renderTab();

    await screen.findByText("Нотатка першої книги");
    rerender(tab({ book: OTHER_BOOK }));

    expect(screen.queryByText("Нотатка першої книги")).not.toBeInTheDocument();
    expect(screen.getByLabelText(COPY.loading)).toBeInTheDocument();
  });
});

describe("BookNotesTab URL criteria", () => {
  it("follows the browser back and forward through the note search and sort", async () => {
    const { rerender } = renderTab({ search: "?noteQ=дракон&noteSort=newest" });
    await screen.findByText(makeBookNote().text);

    rerender(tab({ search: "?noteSort=oldest" }));

    await waitFor(() => expect(lastListRequest().get("sort")).toBe("oldest"));
    expect(lastListRequest().get("search")).toBeNull();
    expect(screen.getByLabelText(COPY.search)).toHaveValue("");

    rerender(tab({ search: "?noteQ=дракон&noteSort=newest" }));

    await waitFor(() => expect(lastListRequest().get("sort")).toBe("newest"));
    expect(lastListRequest().get("search")).toBe("дракон");
    expect(screen.getByLabelText(COPY.search)).toHaveValue("дракон");
  });

  it("opens another book on the default criteria when its URL carries no note params", async () => {
    const { rerender } = renderTab({
      search: "?noteQ=дракон&noteFilter=favorite&noteSort=newest&noteCategory=plot",
    });
    await screen.findByText(makeBookNote().text);

    rerender(tab({ book: OTHER_BOOK, search: "" }));

    await waitFor(() => expect(lastListRequest().get("book")).toBe(OTHER_BOOK.id));
    expect(lastListRequest().get("filter")).toBe("all");
    expect(lastListRequest().get("sort")).toBe("page");
    expect(lastListRequest().get("search")).toBeNull();
    expect(lastListRequest().getAll("category")).toEqual([]);
    const chips = within(await screen.findByRole("radiogroup", { name: COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Усі/ })).toBeChecked();
    expect(screen.getByLabelText(COPY.search)).toHaveValue("");
  });

  it("lets the note params on another book URL win over the defaults", async () => {
    const { rerender } = renderTab({ search: "?noteFilter=favorite" });
    await screen.findByText(makeBookNote().text);

    rerender(tab({ book: OTHER_BOOK, search: "?noteFilter=pinned&noteSort=oldest" }));

    await waitFor(() => expect(lastListRequest().get("book")).toBe(OTHER_BOOK.id));
    expect(lastListRequest().get("filter")).toBe("pinned");
    expect(lastListRequest().get("sort")).toBe("oldest");
    const chips = within(await screen.findByRole("radiogroup", { name: COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Закріплені/ })).toBeChecked();
  });

  it("neither reads nor writes the global archive keys", async () => {
    const events: UrlUpdateEvent[] = [];
    renderTab({
      onUrlUpdate: (event) => events.push(event),
      search: "?q=глобальний&filter=favorite&sort=oldest&book=book-9",
    });
    await screen.findByText(makeBookNote().text);

    expect(lastListRequest().get("book")).toBe(BOOK.id);
    expect(lastListRequest().get("filter")).toBe("all");
    expect(lastListRequest().get("sort")).toBe("page");
    expect(lastListRequest().get("search")).toBeNull();
    expect(screen.getByLabelText(COPY.search)).toHaveValue("");

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Закріплені/ }));

    await waitFor(() => expect(lastUrl(events).get("noteFilter")).toBe("pinned"));
    expect(lastUrl(events).get("q")).toBe("глобальний");
    expect(lastUrl(events).get("filter")).toBe("favorite");
    expect(lastUrl(events).get("sort")).toBe("oldest");
    expect(lastUrl(events).get("book")).toBe("book-9");
  });
});

describe("BookNotesTab scroll position", () => {
  it("returns to the note captured on leaving, not to where a later scroll clamped the page", async () => {
    const memory = createBookTabScrollMemory();
    respondToList = fortyOneNotesPage;
    layOutNotesInOneColumn();

    const { rerender } = renderTab({ memory, queryClient: cachingQueryClient() });
    await screen.findByText("Нотатка номер 20");
    viewport.enterViewport();
    await screen.findByText("Нотатка номер 41");
    await scrollWindowTo(2530);
    expect(memory.anchorRef.current).toBeNull();

    memory.capture();
    await scrollWindowTo(541);
    expect(memory.anchorRef.current).toMatchObject({ cardId: "note-24", offset: -30 });

    rerender(<NuqsTestingAdapter hasMemory>{null}</NuqsTestingAdapter>);
    const scrollTo = vi.spyOn(window, "scrollTo");
    rerender(tab({ memory }));

    expect(screen.getAllByRole("article")).toHaveLength(41);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 2530 });
    expect(window.scrollY).toBe(2530);
    expect(memory.anchorRef.current).toBeNull();
  });

  it("keeps its own position when the criteria in the URL changed while the tab was away", async () => {
    const memory = createBookTabScrollMemory();
    const queryClient = cachingQueryClient();
    respondToList = fortyOneNotesPage;
    layOutNotesInOneColumn();

    const view = renderTab({ memory, queryClient });
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(1030);
    memory.capture();
    expect(memory.anchorRef.current?.cardId).toBe("note-9");
    view.unmount();

    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");
    renderTab({ memory, queryClient, search: "?noteSort=newest" });

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("brings the results start into view and restarts at page 1 when the criteria change below it", async () => {
    respondToList = fortyOneNotesPage;
    layOutNotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    renderTab();
    await screen.findByText("Нотатка номер 20");
    viewport.enterViewport();
    await screen.findByText("Нотатка номер 41");
    await scrollWindowTo(2530);
    const scrollTo = vi.spyOn(window, "scrollTo");

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Закріплені/ }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start" }));
    await waitFor(() => expect(filteredPageNumbers("pinned")).not.toHaveLength(0));
    expect(filteredPageNumbers("pinned")[0]).toBe(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("leaves the scroll alone when the criteria change while the results start is in view", async () => {
    layOutNotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    renderTab();
    await screen.findByText(makeBookNote().text);

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Закріплені/ }));

    await waitFor(() => expect(filteredPageNumbers("pinned")).toEqual([1]));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("brings the results start out from under the sticky header when the criteria change", async () => {
    layOutNotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    renderTab();
    await screen.findByText(makeBookNote().text);
    const resultsStart = screen.getByRole("heading", { level: 2, name: COPY.tabHeading });
    resultsStart.parentElement?.style.setProperty("scroll-margin-top", "80px");
    await scrollWindowTo(100);

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Закріплені/ }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start" }));
  });

  it("keeps the reader in place when an edit moves a card or a delete removes one", async () => {
    let pageNotes = FORTY_ONE_NOTES.slice(0, 20);
    respondToList = () => json(notesPage(pageNotes));
    layOutNotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    const { queryClient } = renderTab();
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(1030);
    const scrollTo = vi.spyOn(window, "scrollTo");

    const edited = makeBookNote({ id: "note-9", text: "Нотатка номер 9, змінена" });
    pageNotes = [
      edited,
      ...pageNotes.filter((note) => note.id !== "note-9" && note.id !== "note-10"),
    ];
    await act(() => queryClient.invalidateQueries());

    await waitFor(() => expect(screen.queryByText("Нотатка номер 10")).not.toBeInTheDocument());
    expect(screen.getAllByRole("article")[0]).toHaveTextContent(edited.text);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(1030);
  });
});
