import "@testing-library/jest-dom/vitest";
import type { CharacterAppearanceBook, CharacterDetailsView, CharacterFactView } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterDetailsPage } from "./character-details-page";

type FactsRequest = {
  bookId: string;
  query: Record<string, string>;
};

const push = vi.fn<(href: string) => void>();
const replace = vi.fn<(href: string) => void>();
const router = { push, replace };

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));

const viewport = mockIntersectionObserver();

const FACTS_PATH = /^\/api\/books\/(?<bookId>[^/]+)\/characters\/char-1\/facts$/;

const firstBook = bookOf("book-1", "Останнє бажання");
const secondBook = bookOf("book-2", "Меч призначення");

const silverSword = makeFact("fact-1", "Срібний меч");
const wolfMedallion = makeFact("fact-2", "Медальйон школи Вовка");
const roach = makeFact("fact-3", "Плотва");
const steelSword = makeFact("fact-4", "Сталевий меч");

const FACTS_BY_BOOK: Record<string, CharacterFactView[]> = {
  "book-1": [silverSword, wolfMedallion, roach],
  "book-2": [steelSword],
};

const fetchMock = vi.fn();

let character: CharacterDetailsView;
let factsRequests: FactsRequest[];
let respondToFacts: (request: FactsRequest) => Promise<Response>;

function appearanceIn(book: CharacterAppearanceBook) {
  return makeBookCharacterView({ book, bookId: book.id, id: `appearance-${book.id}` });
}

function bookOf(id: string, title: string): CharacterAppearanceBook {
  return { cover: null, id, series: null, title };
}

function deferredResponse() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function factsPage(
  items: CharacterFactView[],
  { page = 1, pagesCount = 1, totalCount = items.length } = {},
): Response {
  return jsonResponse({ items, page, pagesCount, pageSize: 20, totalCount });
}

function factsPanel(): HTMLElement {
  return screen.getByRole("tabpanel", { name: "Факти" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeFact(id: string, title: string): CharacterFactView {
  return {
    chapter: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    id,
    page: null,
    text: `Опис: ${title}.`,
    title,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function renderPage(search: string, onUrlUpdate?: OnUrlUpdateFunction) {
  const page = (searchParams: string) => (
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <CharacterDetailsPage characterId="char-1" />
    </NuqsTestingAdapter>
  );
  const view = renderWithProviders(page(search));
  return {
    navigate: (href: string) => view.rerender(page(new URL(href, "http://localhost").search)),
    queryClient: view.queryClient,
  };
}

function requestedPages(): string[] {
  return factsRequests.map(({ query }) => query.pageNumber ?? "");
}

function respondFromBooks({ bookId, query }: FactsRequest): Promise<Response> {
  const search = (query.q ?? "").toLowerCase();
  const items = (FACTS_BY_BOOK[bookId] ?? []).filter((fact) =>
    fact.title.toLowerCase().includes(search),
  );
  return Promise.resolve(factsPage(items));
}

function respondToFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const bookId = FACTS_PATH.exec(url.pathname)?.groups?.bookId;
  if (bookId !== undefined) {
    const request = { bookId, query: Object.fromEntries(url.searchParams) };
    factsRequests.push(request);
    return respondToFacts(request);
  }
  if (url.pathname === "/api/characters/char-1") return Promise.resolve(jsonResponse(character));
  return Promise.reject(new Error(`unexpected ${url.pathname}`));
}

function respondWithTwoPages(secondPage: () => Response) {
  respondToFacts = ({ query }) =>
    Promise.resolve(
      query.pageNumber === "1"
        ? factsPage([silverSword, wolfMedallion], { pagesCount: 2, totalCount: 3 })
        : secondPage(),
    );
}

async function switchToSecondBook() {
  await userEvent.click(await screen.findByRole("combobox", { name: "Контекст перегляду" }));
  await userEvent.click(await screen.findByRole("option", { name: "Меч призначення" }));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  character = makeCharacterDetails({
    appearances: [appearanceIn(firstBook), appearanceIn(secondBook)],
  });
  factsRequests = [];
  respondToFacts = respondFromBooks;

  fetchMock.mockReset();
  fetchMock.mockImplementation(respondToFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterDetailsPage tabs", () => {
  it("opens the overview when the URL names no tab and asks for no facts", async () => {
    renderPage("bookId=book-1");

    expect(await screen.findByRole("tab", { name: "Огляд" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Факти" })).toHaveAttribute("aria-selected", "false");
    expect(factsRequests).toHaveLength(0);
  });

  it("opens the facts tab directly from the URL", async () => {
    renderPage("bookId=book-1&tab=facts");

    expect(
      await screen.findByRole("heading", { level: 3, name: "Срібний меч" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Факти" })).toHaveAttribute("aria-selected", "true");
  });

  it("writes the facts tab into the URL when it is chosen", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage("bookId=book-1", onUrlUpdate);

    await userEvent.click(await screen.findByRole("tab", { name: "Факти" }));

    await waitFor(() =>
      expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("tab")).toBe("facts"),
    );
  });

  it("keeps the facts tab and the search when the only book is opened for the character", async () => {
    character = makeCharacterDetails({ appearances: [appearanceIn(firstBook)] });
    renderPage("tab=facts&q=silver");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/characters/char-1?bookId=book-1&tab=facts&q=silver"),
    );
  });

  it("keeps the facts tab when a conflicting view is dropped from the URL", async () => {
    renderPage("bookId=book-1&view=global&tab=facts");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/characters/char-1?bookId=book-1&tab=facts"),
    );
  });
});

describe("CharacterDetailsPage facts across books", () => {
  it("switches the book from the context select on the facts tab without the search", async () => {
    renderPage("bookId=book-1&tab=facts&q=меч");

    await switchToSecondBook();

    expect(push).toHaveBeenCalledWith("/characters/char-1?bookId=book-2&tab=facts");
  });

  it("never shows the facts of the previous book while the next book loads", async () => {
    const { navigate } = renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });
    const nextBook = deferredResponse();
    respondToFacts = (request) =>
      request.bookId === "book-2" ? nextBook.promise : respondFromBooks(request);

    await switchToSecondBook();
    navigate("/characters/char-1?bookId=book-2&tab=facts");

    expect(await screen.findByText("Завантаження фактів")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Срібний меч" })).not.toBeInTheDocument();

    nextBook.release(factsPage([steelSword]));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Сталевий меч" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Срібний меч" })).not.toBeInTheDocument();
  });
});

describe("CharacterDetailsPage facts without a book", () => {
  it("asks to choose a book on the general profile and requests no facts", async () => {
    renderPage("view=global&tab=facts");

    expect(
      await screen.findByRole("heading", { name: "Спершу оберіть книгу" }),
    ).toBeInTheDocument();
    expect(factsRequests).toHaveLength(0);
  });

  it("asks to choose a book for a character with several books and no context", async () => {
    renderPage("tab=facts");

    expect(
      await screen.findByRole("heading", { name: "Спершу оберіть книгу" }),
    ).toBeInTheDocument();
    expect(factsRequests).toHaveLength(0);
  });

  it("opens the book list of the context select from the prompt", async () => {
    renderPage("view=global&tab=facts");

    await userEvent.click(await screen.findByRole("button", { name: "Обрати книгу" }));

    expect(await screen.findByRole("option", { name: "Меч призначення" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Останнє бажання" })).toBeInTheDocument();
  });

  it("switches to the book picked from the prompt and stays on the facts tab", async () => {
    renderPage("view=global&tab=facts");

    await userEvent.click(await screen.findByRole("button", { name: "Обрати книгу" }));
    await userEvent.click(await screen.findByRole("option", { name: "Меч призначення" }));

    expect(push).toHaveBeenCalledWith("/characters/char-1?bookId=book-2&tab=facts");
  });

  it("explains that a character without books has no facts yet and offers no book choice", async () => {
    character = makeCharacterDetails({ appearances: [] });
    renderPage("tab=facts");

    expect(
      await screen.findByRole("heading", { name: "Персонаж ще не з’являється в жодній книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Обрати книгу" })).not.toBeInTheDocument();
    expect(factsRequests).toHaveLength(0);
  });
});

describe("CharacterDetailsPage facts search", () => {
  it("requests nothing for a single typed character", async () => {
    renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук фактів" }), "м");
    await pause(500);

    expect(factsRequests).toHaveLength(1);
  });

  it("requests the first page with a committed search", async () => {
    renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук фактів" }), "меч");

    await waitFor(() =>
      expect(factsRequests.at(-1)).toEqual({
        bookId: "book-1",
        query: { pageNumber: "1", pageSize: "20", q: "меч" },
      }),
    );
  });

  it("restores the full list when the search is cleared", async () => {
    renderPage("bookId=book-1&tab=facts&q=меч");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });
    expect(screen.queryByRole("heading", { name: "Плотва" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Очистити пошук" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Плотва" })).toBeInTheDocument();
  });

  it("keeps focus in the search after its clear button is pressed", async () => {
    renderPage("bookId=book-1&tab=facts&q=меч");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });

    await userEvent.click(screen.getByRole("button", { name: "Очистити пошук" }));

    expect(screen.getByRole("textbox", { name: "Пошук фактів" })).toHaveFocus();
  });

  it("ignores a search from the URL that is longer than the limit", async () => {
    renderPage(`bookId=book-1&tab=facts&q=${"м".repeat(101)}`);

    expect(await screen.findByRole("heading", { level: 3, name: "Плотва" })).toBeInTheDocument();
    expect(factsRequests.map(({ query }) => query)).toEqual([{ pageNumber: "1", pageSize: "20" }]);
  });

  it("sends a search from the URL that is exactly at the limit", async () => {
    const search = "м".repeat(100);
    renderPage(`bookId=book-1&tab=facts&q=${search}`);

    await waitFor(() => expect(factsRequests.map(({ query }) => query.q)).toEqual([search]));
  });
});

describe("CharacterDetailsPage facts list states", () => {
  it("shows busy placeholders while the first page loads", async () => {
    respondToFacts = () => new Promise<Response>(() => {});
    renderPage("bookId=book-1&tab=facts");

    await screen.findByText("Завантаження фактів");

    expect(within(factsPanel()).getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(within(factsPanel()).queryAllByRole("article")).toHaveLength(0);
  });

  it("retries a first page that failed", async () => {
    let failing = true;
    respondToFacts = (request) =>
      failing ? Promise.resolve(jsonResponse({ message: "boom" }, 500)) : respondFromBooks(request);
    renderPage("bookId=book-1&tab=facts");

    expect(
      await screen.findByText("Не вдалося завантажити факти. Спробуйте ще раз."),
    ).toBeInTheDocument();
    failing = false;
    await userEvent.click(within(factsPanel()).getByRole("button", { name: "Спробувати ще раз" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Срібний меч" }),
    ).toBeInTheDocument();
  });

  it("offers only adding the first fact for a book without facts", async () => {
    respondToFacts = () => Promise.resolve(factsPage([]));
    renderPage("bookId=book-1&tab=facts");

    expect(await screen.findByRole("heading", { name: "Фактів поки немає" })).toBeInTheDocument();
    expect(within(factsPanel()).getAllByRole("button")).toHaveLength(1);
    expect(within(factsPanel()).getByRole("button", { name: "Додати факт" })).toBeInTheDocument();
  });

  it("hides the search for a book without facts", async () => {
    respondToFacts = () => Promise.resolve(factsPage([]));
    renderPage("bookId=book-1&tab=facts");

    await screen.findByRole("heading", { name: "Фактів поки немає" });

    expect(screen.queryByRole("textbox", { name: "Пошук фактів" })).not.toBeInTheDocument();
  });

  it("offers to clear a search that finds nothing and then shows every fact", async () => {
    renderPage("bookId=book-1&tab=facts&q=дракон");
    await screen.findByRole("heading", { name: "Нічого не знайдено" });

    await userEvent.click(screen.getByText("Очистити пошук", { selector: "button" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Плотва" })).toBeInTheDocument();
  });

  it("moves focus to the search when a search that finds nothing is cleared", async () => {
    renderPage("bookId=book-1&tab=facts&q=дракон");
    await screen.findByRole("heading", { name: "Нічого не знайдено" });

    await userEvent.click(screen.getByText("Очистити пошук", { selector: "button" }));

    expect(screen.getByRole("textbox", { name: "Пошук фактів" })).toHaveFocus();
  });

  it("announces the count and an empty search in one lasting status region", async () => {
    renderPage("bookId=book-1&tab=facts");
    const status = await screen.findByText("3 факти");
    expect(status).toHaveAttribute("role", "status");

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук фактів" }), "дракон");
    await screen.findByRole("heading", { name: "Нічого не знайдено" });

    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("Нічого не знайдено");
  });

  it("focuses the toolbar add button after the first fact is saved from the empty state", async () => {
    let savedFacts: CharacterFactView[] = [];
    respondToFacts = () => Promise.resolve(factsPage(savedFacts));
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "POST") return respondToFetch(input);
      savedFacts = [roach];
      return Promise.resolve(jsonResponse(roach, 201));
    });
    renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { name: "Фактів поки немає" });
    await userEvent.click(within(factsPanel()).getByRole("button", { name: "Додати факт" }));
    const form = await screen.findByRole("dialog", { name: "Новий факт" });

    await userEvent.type(within(form).getByRole("textbox", { name: "Назва" }), "Плотва");
    await userEvent.type(within(form).getByRole("textbox", { name: "Текст" }), "Кобила.");
    await userEvent.click(within(form).getByRole("button", { name: "Додати факт" }));

    await waitFor(() =>
      expect(within(factsPanel()).getByRole("button", { name: "Додати факт" })).toHaveFocus(),
    );
    expect(within(factsPanel()).getByRole("heading", { level: 3, name: "Плотва" })).toBeVisible();
  });

  it("keeps the cards when a background refresh fails", async () => {
    const { queryClient } = renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });
    respondToFacts = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    await act(() => queryClient.refetchQueries());

    expect(factsRequests).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 3, name: "Срібний меч" })).toBeInTheDocument();
    expect(within(factsPanel()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("counts every fact of the book, not only the loaded page", async () => {
    respondWithTwoPages(() => factsPage([roach], { page: 2, pagesCount: 2, totalCount: 3 }));
    renderPage("bookId=book-1&tab=facts");

    expect(await screen.findByText("3 факти")).toBeInTheDocument();
  });

  it("keeps the loaded facts when the next page fails", async () => {
    respondWithTwoPages(() => jsonResponse({ message: "boom" }, 500));
    renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });

    viewport.enterViewport();

    expect(await screen.findByText("Не вдалося завантажити ще факти")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Срібний меч" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Медальйон школи Вовка" }),
    ).toBeInTheDocument();
  });

  it("retries only the page that failed", async () => {
    let nextPageFails = true;
    respondWithTwoPages(() =>
      nextPageFails
        ? jsonResponse({ message: "boom" }, 500)
        : factsPage([roach], { page: 2, pagesCount: 2, totalCount: 3 }),
    );
    renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });
    viewport.enterViewport();
    await screen.findByText("Не вдалося завантажити ще факти");
    nextPageFails = false;

    await userEvent.click(within(factsPanel()).getByRole("button", { name: "Повторити" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Плотва" })).toBeInTheDocument();
    expect(requestedPages()).toEqual(["1", "2", "2"]);
  });

  it("stops requesting once every page is loaded", async () => {
    respondWithTwoPages(() => factsPage([roach], { page: 2, pagesCount: 2, totalCount: 3 }));
    renderPage("bookId=book-1&tab=facts");
    await screen.findByRole("heading", { level: 3, name: "Срібний меч" });
    viewport.enterViewport();
    await screen.findByText("Усі факти показано");

    viewport.enterViewport();
    await pause(50);

    expect(requestedPages()).toEqual(["1", "2"]);
  });
});
