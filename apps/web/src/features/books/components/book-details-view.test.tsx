import "@testing-library/jest-dom/vitest";

import type { NoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookNote } from "@/features/notes/model/notes.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { BookDetailsView } from "./book-details-view";
import { makeBookDetailsView } from "./book-details.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type DetailsRender = {
  bookId?: string;
  search?: string;
};

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const OTHER_BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const LAYOUT = { cardHeight: 100, listTop: 200, resultsTop: 150 } as const;

const NOTES_COPY = { quickFilters: "Швидкі фільтри" } as const;

const TWENTY_NOTES = Array.from({ length: 20 }, (_, index) =>
  makeBookNote({ id: `note-${index + 1}`, text: `Нотатка номер ${index + 1}` }),
);

const NOTES_PATHS = {
  bookNotes: `/api/books/${BOOK_ID}/notes`,
  facets: "/api/notes/books/facets",
  list: "/api/notes/books",
} as const;

const TABS = {
  characters: "Персонажі",
  history: "Повна історія читання",
  notes: "Нотатки",
  overview: "Огляд",
  timeline: /^Хронологія/,
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToList: (url: URL) => Promise<Response>;

function cachingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: Infinity } },
  });
}

function detailsView({ bookId = BOOK_ID, search = "?tab=notes" }: DetailsRender = {}) {
  return (
    <NuqsTestingAdapter hasMemory searchParams={search}>
      <BookDetailsView book={makeBookDetailsView({ id: bookId, notesCount: 20 })} />
    </NuqsTestingAdapter>
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

function listFilters(): (null | string)[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === NOTES_PATHS.list)
    .map((url) => url.searchParams.get("filter"));
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function notesPage(items: readonly NoteView[]): Promise<Response> {
  return json({ items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length });
}

function notesTab(): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(`^${TABS.notes}`) });
}

function renderView(notesCount = 0) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <BookDetailsView book={makeBookDetailsView({ id: BOOK_ID, notesCount })} />
    </NuqsTestingAdapter>,
  );
}

function requestedPaths(): string[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").pathname);
}

async function scrollWindowTo(top: number) {
  window.scrollTo({ top });
  window.dispatchEvent(new Event("scroll"));
  await nextFrame();
}

beforeEach(() => {
  respondToList = () => notesPage([]);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === NOTES_PATHS.list) return respondToList(url);
    return json({ message: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.scrollTo({ top: 0 });
});

describe("BookDetailsView tabs", () => {
  it("puts notes right after the overview", () => {
    renderView();

    const tabs = screen.getAllByRole("tab");

    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveTextContent(TABS.overview);
    expect(tabs[1]).toHaveTextContent(TABS.notes);
    expect(tabs[2]).toHaveTextContent(TABS.history);
    expect(tabs[3]).toHaveTextContent(TABS.characters);
    expect(tabs[4]).toHaveTextContent(TABS.timeline);
  });

  it("shows no notes badge for a book without notes", () => {
    renderView(0);

    expect(notesTab()).toHaveTextContent(new RegExp(`^${TABS.notes}$`));
  });

  it("shows the book notes count on the notes tab", () => {
    renderView(11);

    expect(within(notesTab()).getByText("11")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`^${TABS.notes}\\s*, 11$`) })).toBe(
      notesTab(),
    );
  });
});

describe("BookDetailsView overview", () => {
  it("drops the notes block and asks nothing about notes until the notes tab opens", async () => {
    renderView(11);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByText("Мої нотатки")).not.toBeInTheDocument();
    expect(requestedPaths()).not.toContain(NOTES_PATHS.list);
    expect(requestedPaths()).not.toContain(NOTES_PATHS.facets);
    expect(requestedPaths()).not.toContain(NOTES_PATHS.bookNotes);

    await userEvent.click(notesTab());

    await waitFor(() => expect(requestedPaths()).toContain(NOTES_PATHS.list));
    expect(requestedPaths()).toContain(NOTES_PATHS.facets);
    expect(requestedPaths()).not.toContain(NOTES_PATHS.bookNotes);
  });
});

describe("BookDetailsView notes URL", () => {
  it("opens the notes tab on the favourites chip straight from the URL", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);

    renderWithProviders(detailsView({ search: "?tab=notes&noteFilter=favorite" }));

    const chips = within(await screen.findByRole("radiogroup", { name: NOTES_COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Улюблені/ })).toBeChecked();
    expect(notesTab()).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(listFilters()).toEqual(["favorite"]));
  });
});

describe("BookDetailsView notes scroll position", () => {
  it("brings the reader back to the same note after a trip to another tab", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);
    layOutNotesInOneColumn();

    renderWithProviders(detailsView(), { queryClient: cachingQueryClient() });
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(1030);

    await userEvent.click(screen.getByRole("tab", { name: TABS.overview }));
    expect(screen.queryByText("Нотатка номер 20")).not.toBeInTheDocument();
    await scrollWindowTo(541);
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(notesTab());

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 1030 });
  });

  it("does not bring back the position of book A after the reader visits book B", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);
    layOutNotesInOneColumn();

    const { rerender } = renderWithProviders(detailsView(), {
      queryClient: cachingQueryClient(),
    });
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(1030);
    await userEvent.click(screen.getByRole("tab", { name: TABS.overview }));

    rerender(detailsView({ bookId: OTHER_BOOK_ID }));
    expect(screen.getByRole("tab", { name: TABS.overview })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    rerender(detailsView({ bookId: BOOK_ID }));
    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(notesTab());

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
