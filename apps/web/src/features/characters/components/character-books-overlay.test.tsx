import "@testing-library/jest-dom/vitest";
import type { CharacterAppearanceBook, CharacterCatalogItemView } from "@app/shared";
import type { ReactNode } from "react";

import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import {
  makeCharacterAppearanceBook,
  makeCharacterCatalogItem,
} from "../model/characters.fixtures";
import { CatalogCharacterBooks } from "./catalog-character-books";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

type BooksRequest = { characterId: string; pageNumber: number };

const booksCopy = messages.characters.catalog.books;
const translateBooks = createTranslator({
  locale: "uk",
  messages,
  namespace: "characters.catalog.books",
});

const VIEWPORT_WIDTH = { desktop: 1280, mobile: 390 } as const;

const CHARACTER_IDS = {
  geralt: "7d1c5a2e-3f4b-4c6d-9e8f-0a1b2c3d4e5f",
  yennefer: "8e2d6b3f-4a5c-4d7e-8f90-1b2c3d4e5f60",
} as const;

const GRISHAVERSE = { id: "series-grisha", name: "Ґрішаверс" } as const;

const BOOKS = {
  alisa: makeCharacterAppearanceBook({ id: "book-alisa", title: "Аліса" }),
  dune: makeCharacterAppearanceBook({
    id: "book-dune",
    series: { id: "series-dune", name: "Дюна", partNumber: null },
    title: "Дюна",
  }),
  lady: makeCharacterAppearanceBook({ id: "book-lady", title: "Володарка озера" }),
  ruin: makeCharacterAppearanceBook({
    id: "book-ruin",
    series: { ...GRISHAVERSE, partNumber: 3 },
    title: "Руїна і піднесення",
  }),
  shadow: makeCharacterAppearanceBook({
    id: "book-shadow",
    series: { ...GRISHAVERSE, partNumber: 1 },
    title: "Тінь і кістка",
  }),
  siege: makeCharacterAppearanceBook({
    id: "book-siege",
    series: { ...GRISHAVERSE, partNumber: 2 },
    title: "Облога і буря",
  }),
  swallow: makeCharacterAppearanceBook({ id: "book-swallow", title: "Вежа ластівки" }),
  time: makeCharacterAppearanceBook({ id: "book-time", title: "Час презирства" }),
  vovk: makeCharacterAppearanceBook({ id: "book-vovk", title: "Вовк" }),
} as const;

const GERALT_BOOKS = [BOOKS.shadow, BOOKS.siege, BOOKS.ruin, BOOKS.dune, BOOKS.alisa, BOOKS.vovk];

const YENNEFER_BOOKS = [BOOKS.time, BOOKS.swallow, BOOKS.lady, BOOKS.alisa];

const GERALT = makeCharacterCatalogItem({
  appearanceCount: 5,
  booksPreview: [BOOKS.shadow, BOOKS.siege, BOOKS.ruin],
  id: CHARACTER_IDS.geralt,
  name: "Ґеральт",
});

const YENNEFER = makeCharacterCatalogItem({
  appearanceCount: 4,
  booksPreview: [BOOKS.time, BOOKS.swallow, BOOKS.lady],
  id: CHARACTER_IDS.yennefer,
  name: "Єнніфер",
});

const BOOKS_PATH = /^\/api\/characters\/([^/]+)\/books$/;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToBooks: (request: BooksRequest) => Response;

const viewport = mockIntersectionObserver();

function booksFor({ characterId }: BooksRequest): Response {
  return booksPage(characterId === CHARACTER_IDS.yennefer ? YENNEFER_BOOKS : GERALT_BOOKS);
}

function booksPage(
  items: CharacterAppearanceBook[],
  { page = 1, pagesCount = 1, totalCount = items.length } = {},
): Response {
  return jsonResponse({ items, page, pagesCount, pageSize: 20, totalCount });
}

function booksPath(characterId: string, pageNumber: number): string {
  return `/api/characters/${characterId}/books?pageNumber=${pageNumber}&pageSize=20`;
}

async function closeBooks() {
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

function hrefs(links: HTMLElement[]): (null | string)[] {
  return links.map((link) => link.getAttribute("href"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function moreButton(hiddenCount: number): HTMLElement {
  return screen.getByRole("button", { name: translateBooks("more", { count: hiddenCount }) });
}

async function openBooks(hiddenCount: number): Promise<HTMLElement> {
  await userEvent.click(moreButton(hiddenCount));
  return screen.findByRole("dialog", { name: booksCopy.title });
}

function profilePath(characterId: string): string {
  return `/characters/${characterId}?view=global`;
}

function renderBooks(characters: CharacterCatalogItemView[]) {
  return renderWithProviders(
    <>
      {characters.map((character) => (
        <CatalogCharacterBooks character={character} key={character.id} />
      ))}
    </>,
  );
}

function requestedPaths(): string[] {
  return fetchMock.mock.calls.map(([input]) => {
    const url = new URL(String(input), "http://localhost");
    return `${url.pathname}${url.search}`;
  });
}

beforeEach(() => {
  vi.stubGlobal("innerWidth", VIEWPORT_WIDTH.desktop);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  respondToBooks = booksFor;
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), "http://localhost");
    const match = BOOKS_PATH.exec(url.pathname);
    if (match === null) return Promise.reject(new Error(`unexpected ${url.pathname}`));
    return Promise.resolve(
      respondToBooks({
        characterId: match[1] ?? "",
        pageNumber: Number(url.searchParams.get("pageNumber")),
      }),
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterBooksOverlay loading", () => {
  it("asks for nothing while the covers are browsed and loads page one on the more button", async () => {
    renderBooks([GERALT]);

    await userEvent.tab();
    expect(requestedPaths()).toEqual([]);

    await userEvent.click(moreButton(2));

    await waitFor(() => expect(requestedPaths()).toEqual([booksPath(CHARACTER_IDS.geralt, 1)]));
  });

  it("offers a retry when the first page fails and shows the books once it succeeds", async () => {
    let attempts = 0;
    respondToBooks = (request) => {
      attempts += 1;
      return attempts === 1 ? jsonResponse({ message: "boom" }, 500) : booksFor(request);
    };
    renderBooks([GERALT]);

    const popover = await openBooks(2);
    const alert = await within(popover).findByRole("alert");
    expect(alert).toHaveTextContent(booksCopy.error);

    await userEvent.click(within(alert).getByRole("button", { name: messages.common.retry }));

    expect(await within(popover).findByRole("link", { name: /Вовк/ })).toHaveAttribute(
      "href",
      "/books/book-vovk",
    );
    expect(within(popover).queryByRole("alert")).not.toBeInTheDocument();
    expect(requestedPaths()).toEqual([
      booksPath(CHARACTER_IDS.geralt, 1),
      booksPath(CHARACTER_IDS.geralt, 1),
    ]);
  });

  it("keeps the loaded books and offers a retry when the next page fails", async () => {
    respondToBooks = ({ pageNumber }) =>
      pageNumber === 1
        ? booksPage([BOOKS.shadow, BOOKS.siege, BOOKS.ruin], { pagesCount: 2, totalCount: 6 })
        : jsonResponse({ message: "boom" }, 500);
    renderBooks([GERALT]);

    const popover = await openBooks(2);
    await within(popover).findByRole("link", { name: /Руїна і піднесення/ });
    viewport.enterViewport();

    const alert = await within(popover).findByRole("alert");
    expect(alert).toHaveTextContent(booksCopy.loadMoreError);
    expect(within(alert).getByRole("button", { name: messages.common.retry })).toBeInTheDocument();
    expect(hrefs(within(popover).getAllByRole("link"))).toEqual([
      "/books/book-shadow",
      "/books/book-siege",
      "/books/book-ruin",
      profilePath(CHARACTER_IDS.geralt),
    ]);
    expect(requestedPaths()).toEqual([
      booksPath(CHARACTER_IDS.geralt, 1),
      booksPath(CHARACTER_IDS.geralt, 2),
    ]);
  });
});

describe("CharacterBooksOverlay surface", () => {
  it("opens a popover on desktop that leaves the covers and the trigger reachable", async () => {
    renderBooks([GERALT]);

    const popover = await openBooks(2);
    await within(popover).findByRole("link", { name: /Вовк/ });

    expect(moreButton(2)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: BOOKS.shadow.title })).toHaveAttribute(
      "href",
      "/books/book-shadow",
    );
  });

  it("opens a modal drawer on mobile that hides the covers behind it", async () => {
    vi.stubGlobal("innerWidth", VIEWPORT_WIDTH.mobile);
    renderBooks([GERALT]);

    const drawer = await openBooks(2);
    await within(drawer).findByRole("link", { name: /Вовк/ });

    expect(
      screen.queryByRole("button", { name: translateBooks("more", { count: 2 }) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: BOOKS.shadow.title })).not.toBeInTheDocument();
  });
});

describe("CharacterBooksOverlay content", () => {
  it("lists every book in server order, the previewed ones included, under the loaded total", async () => {
    renderBooks([GERALT]);

    const popover = await openBooks(2);
    await within(popover).findByRole("link", { name: /Вовк/ });

    expect(hrefs(within(popover).getAllByRole("link"))).toEqual([
      "/books/book-shadow",
      "/books/book-siege",
      "/books/book-ruin",
      "/books/book-dune",
      "/books/book-alisa",
      "/books/book-vovk",
      profilePath(CHARACTER_IDS.geralt),
    ]);
    expect(within(popover).getByText("Ґрішаверс, частина 1")).toBeInTheDocument();
    expect(within(popover).getByText("Ґеральт")).toBeInTheDocument();
    expect(within(popover).getByText(translateBooks("total", { count: 6 }))).toBeInTheDocument();
    expect(within(popover).getByRole("link", { name: booksCopy.openProfile })).toHaveAttribute(
      "href",
      profilePath(CHARACTER_IDS.geralt),
    );
  });

  it("reopens the same character's books from the cache without asking again", async () => {
    renderBooks([GERALT]);

    const popover = await openBooks(2);
    await within(popover).findByRole("link", { name: /Вовк/ });
    await closeBooks();

    const reopened = await openBooks(2);

    expect(within(reopened).getByRole("link", { name: /Вовк/ })).toHaveAttribute(
      "href",
      "/books/book-vovk",
    );
    expect(requestedPaths()).toEqual([booksPath(CHARACTER_IDS.geralt, 1)]);
  });

  it("asks again for another character and never shows the first one's books", async () => {
    renderBooks([GERALT, YENNEFER]);

    const geraltBooks = await openBooks(2);
    await within(geraltBooks).findByRole("link", { name: /Вовк/ });
    await closeBooks();

    const yenneferBooks = await openBooks(1);

    expect(
      await within(yenneferBooks).findByRole("link", { name: /Володарка озера/ }),
    ).toHaveAttribute("href", "/books/book-lady");
    expect(within(yenneferBooks).getByText("Єнніфер")).toBeInTheDocument();
    expect(within(yenneferBooks).queryByRole("link", { name: /Вовк/ })).not.toBeInTheDocument();
    expect(requestedPaths()).toEqual([
      booksPath(CHARACTER_IDS.geralt, 1),
      booksPath(CHARACTER_IDS.yennefer, 1),
    ]);
  });
});
