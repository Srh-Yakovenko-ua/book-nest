import "@testing-library/jest-dom/vitest";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import {
  makeBookCharacterSummary,
  makeCharacterDetails,
  makeCharacterSummary,
  makeCharacterSummaryPage,
} from "../model/characters.fixtures";
import { BookCharactersTab } from "./book-characters-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type FavoriteGate = {
  fail: (reason: unknown) => void;
  promise: Promise<Response>;
};

const book = makeBookView({ id: "book-1" });
const geralt = makeCharacterSummary();
const yennefer = makeCharacterSummary({
  characterId: "char-2",
  id: "book-char-2",
  name: "Єнніфер",
});
const triss = makeCharacterSummary({ characterId: "char-3", id: "book-char-3", name: "Трісс" });
const favoriteYennefer = { ...yennefer, isFavorite: true };
const bookSummary = makeBookCharacterSummary({
  byImportance: { central: 1, episodic: 0, major: 4, mentioned: 0, supporting: 2 },
  favoritesCount: 3,
  povCount: 2,
  totalVisibleCharacters: 7,
});

const fetchMock = vi.fn();
const viewport = mockIntersectionObserver();

let respondToRoster: (url: string) => Promise<Response> | Response;
let respondToFavorite: () => Promise<Response> | Response;
let respondToUnlink: () => Response;
let holdRoster = false;

function cardFor(name: string): HTMLElement {
  const card = screen.getByRole("heading", { name }).closest("li");
  if (card === null) throw new Error(`no card for ${name}`);
  return card;
}

function favoriteGate(): FavoriteGate {
  const controls: { reject?: (reason: unknown) => void } = {};
  const promise = new Promise<Response>((_resolve, reject) => {
    controls.reject = reject;
  });
  return { fail: (reason) => controls.reject?.(reason), promise };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function nextPageRequestCount(): number {
  return rosterRequestUrls().filter((url) => url.includes("pageNumber=2")).length;
}

function renderTab(search = "", tabBook = book, onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <BookCharactersTab book={tabBook} />
    </NuqsTestingAdapter>,
  );
}

function rosterPage(
  items: ReturnType<typeof makeCharacterSummary>[],
  page: number,
  pagesCount = 1,
) {
  return jsonResponse(
    makeCharacterSummaryPage(items, { page, pagesCount, totalCount: pagesCount * 20 }),
  );
}

function rosterPageNumber(url: string): number {
  return Number(new URL(url, "http://localhost").searchParams.get("pageNumber") ?? 1);
}

function rosterQueryOf(url: string | undefined): Record<string, string> {
  if (url === undefined) return {};
  return Object.fromEntries(new URL(url, "http://localhost").searchParams);
}

function rosterRequestUrls(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => ((init as RequestInit | undefined)?.method ?? "GET") === "GET")
    .map(([input]) => String(input))
    .filter((url) => url.includes("/characters?"));
}

function twoPageRoster(url: string): Response {
  const pageNumber = rosterPageNumber(url);
  return rosterPage([pageNumber === 1 ? geralt : yennefer], pageNumber, 2);
}

function twoPageRosterWithFavoriteOnSecondPage(url: string): Response {
  const pageNumber = rosterPageNumber(url);
  return rosterPage([pageNumber === 1 ? geralt : favoriteYennefer], pageNumber, 2);
}

function unlinkRequestCount(): number {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "DELETE",
  ).length;
}

beforeEach(() => {
  holdRoster = false;
  respondToRoster = () => rosterPage([geralt], 1);
  respondToFavorite = () => jsonResponse(makeCharacterDetails());
  respondToUnlink = () => new Response(null, { status: 204 });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/character-summary")) return Promise.resolve(jsonResponse(bookSummary));
    if (method === "GET" && url.includes("/characters?")) {
      if (holdRoster) return new Promise<Response>(() => {});
      return Promise.resolve(respondToRoster(url));
    }
    if (method === "PATCH" && url.includes("/api/characters/")) {
      return Promise.resolve(respondToFavorite());
    }
    if (method === "DELETE" && url.includes("/api/books/book-1/characters/")) {
      return Promise.resolve(respondToUnlink());
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookCharactersTab roster", () => {
  it("shows loading skeletons while the roster is pending, then the character cards", async () => {
    renderTab();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("shows the empty state with an add affordance when there are no characters", async () => {
    respondToRoster = () => rosterPage([], 1);

    renderTab();

    expect(await screen.findByText("Тут поки немає персонажів")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Додати персонажа" }).length).toBeGreaterThan(0);
  });

  it("shows an error state when the roster request fails", async () => {
    respondToRoster = () => jsonResponse({ message: "boom" }, 500);

    renderTab();

    expect(await screen.findByText("Помилка завантаження")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Спробувати ще раз/ })).toBeInTheDocument();
  });

  it("refetches the roster when the retry button is used", async () => {
    respondToRoster = () => jsonResponse({ message: "boom" }, 500);

    renderTab();

    const retry = await screen.findByRole("button", { name: /Спробувати ще раз/ });
    respondToRoster = () => rosterPage([geralt], 1);

    await userEvent.click(retry);

    expect(await screen.findByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });
});

describe("BookCharactersTab contextual roster", () => {
  it("asks the backend to sort and names a book in progress as the only spoiler context", async () => {
    renderTab(
      "",
      makeBookView({
        id: "book-1",
        readingProgress: {
          abandonedAt: null,
          currentPage: 42,
          finishedAt: null,
          impression: null,
          lastProgressUpdateAt: null,
          note: null,
          pausedAt: null,
          rating: null,
          startedAt: null,
        },
        readingStatus: "reading",
      }),
    );

    await screen.findByRole("heading", { name: "Ґеральт" });

    expect(rosterQueryOf(rosterRequestUrls()[0])).toEqual({
      contextBookId: "book-1",
      pageNumber: "1",
      pageSize: "20",
      sort: "importance",
    });
  });

  it("sends no spoiler context for a finished book", async () => {
    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });

    expect(rosterQueryOf(rosterRequestUrls()[0])).not.toHaveProperty("contextBookId");
  });

  it("hides the toolbar for an empty book", async () => {
    respondToRoster = () => rosterPage([], 1);

    renderTab();

    await screen.findByText("Тут поки немає персонажів");

    expect(screen.queryByPlaceholderText("Пошук у цій книзі...")).not.toBeInTheDocument();
  });

  it("keeps the toolbar and offers a search reset when a search finds nothing", async () => {
    respondToRoster = () => rosterPage([], 1);

    renderTab("characterSearch=zzz");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук у цій книзі...")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Очистити пошук/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Додати персонажа" })).toHaveLength(1);
  });
});

describe("BookCharactersTab infinite roster", () => {
  it("renders the first page without any numbered pagination control", async () => {
    respondToRoster = twoPageRoster;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });

    expect(screen.queryByText("1 / 2")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Зменшити" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Збільшити" })).not.toBeInTheDocument();
  });

  it("appends the next page instead of replacing the first one", async () => {
    respondToRoster = twoPageRoster;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();

    await waitFor(() => expect(nextPageRequestCount()).toBe(1));

    expect(await screen.findByRole("heading", { name: "Єнніфер" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("asks for nothing more and offers no load-more affordance on the last page", async () => {
    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();

    await waitFor(() => expect(nextPageRequestCount()).toBe(0));
    expect(
      screen.queryAllByRole("status").filter((status) => status.hasAttribute("aria-busy")),
    ).toHaveLength(0);
  });

  it("keeps the first page and offers a retry when the next page fails", async () => {
    let failNextPage = true;
    respondToRoster = (url) => {
      if (url.includes("pageNumber=2") && failNextPage) {
        failNextPage = false;
        return jsonResponse({ message: "boom" }, 500);
      }
      return twoPageRoster(url);
    };

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();

    await waitFor(() => expect(nextPageRequestCount()).toBe(1));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не вдалося завантажити ще персонажів");
    expect(screen.getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Повторити" }));

    await waitFor(() => expect(nextPageRequestCount()).toBe(2));
    expect(await screen.findByRole("heading", { name: "Єнніфер" })).toBeInTheDocument();
  });

  it("starts a fresh query when the search changes", async () => {
    respondToRoster = (url) =>
      url.includes("search=") ? rosterPage([triss], 1) : twoPageRoster(url);

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук персонажів" }), "Трісс");

    expect(
      await screen.findByRole("heading", { name: "Трісс" }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ґеральт" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Єнніфер" })).not.toBeInTheDocument();
    expect(rosterRequestUrls().find((url) => url.includes("search="))).toContain("pageNumber=1");
  });

  it("starts a fresh query when the sort changes", async () => {
    respondToRoster = (url) =>
      url.includes("sort=name") ? rosterPage([triss], 1) : twoPageRoster(url);

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });

    await userEvent.click(screen.getByRole("combobox", { name: "Сортування" }));
    await userEvent.click(await screen.findByRole("option", { name: "За іменем: А–Я" }));

    expect(
      await screen.findByRole("heading", { name: "Трісс" }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ґеральт" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Єнніфер" })).not.toBeInTheDocument();
    expect(rosterRequestUrls().find((url) => url.includes("sort=name"))).toContain("pageNumber=1");
  });
});

describe("BookCharactersTab favorite", () => {
  it("flips a row on the second page and rolls it back when the request fails", async () => {
    respondToRoster = twoPageRoster;
    const gate = favoriteGate();
    respondToFavorite = () => gate.promise;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });

    holdRoster = true;
    await userEvent.click(
      within(cardFor("Єнніфер")).getByRole("button", { name: "Додати в улюблені" }),
    );

    await waitFor(() =>
      expect(
        within(cardFor("Єнніфер")).getByRole("button", { name: "Прибрати з улюблених" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
    ).toHaveAttribute("aria-pressed", "false");

    gate.fail(new Error("boom"));

    await waitFor(() =>
      expect(
        within(cardFor("Єнніфер")).getByRole("button", { name: "Додати в улюблені" }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
    expect(
      within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("flips a row on the first page once the second page is loaded and leaves the second page alone", async () => {
    respondToRoster = twoPageRoster;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });

    holdRoster = true;
    await userEvent.click(
      within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
    );

    await waitFor(() =>
      expect(
        within(cardFor("Ґеральт")).getByRole("button", { name: "Прибрати з улюблених" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      within(cardFor("Єнніфер")).getByRole("button", { name: "Додати в улюблені" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("restores each row to its own value when a first-page flip fails with both pages cached", async () => {
    respondToRoster = twoPageRosterWithFavoriteOnSecondPage;
    const gate = favoriteGate();
    respondToFavorite = () => gate.promise;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });

    holdRoster = true;
    await userEvent.click(
      within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
    );
    await waitFor(() =>
      expect(
        within(cardFor("Ґеральт")).getByRole("button", { name: "Прибрати з улюблених" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );

    gate.fail(new Error("boom"));

    await waitFor(() =>
      expect(
        within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
    expect(
      within(cardFor("Єнніфер")).getByRole("button", { name: "Прибрати з улюблених" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps one card per character on both pages after a failed flip rolls back", async () => {
    respondToRoster = twoPageRosterWithFavoriteOnSecondPage;
    const gate = favoriteGate();
    respondToFavorite = () => gate.promise;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });

    holdRoster = true;
    await userEvent.click(
      within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
    );
    await waitFor(() =>
      expect(
        within(cardFor("Ґеральт")).getByRole("button", { name: "Прибрати з улюблених" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );

    gate.fail(new Error("boom"));

    await waitFor(() =>
      expect(
        within(cardFor("Ґеральт")).getByRole("button", { name: "Додати в улюблені" }),
      ).toHaveAttribute("aria-pressed", "false"),
    );

    expect(screen.getAllByRole("heading", { name: "Ґеральт" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Єнніфер" })).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("BookCharactersTab invalidation", () => {
  it("keeps one card per character after an unlink refresh", async () => {
    respondToRoster = twoPageRoster;

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    viewport.enterViewport();
    await screen.findByRole("heading", { name: "Єнніфер" });
    const loadedRequests = rosterRequestUrls().length;

    await userEvent.click(
      within(cardFor("Ґеральт")).getByRole("button", { name: "Дії з персонажем" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Прибрати з цієї книги" }));
    await userEvent.click(await screen.findByRole("button", { name: "Прибрати" }));

    await waitFor(() => expect(unlinkRequestCount()).toBe(1));
    await waitFor(() => expect(rosterRequestUrls().length).toBeGreaterThan(loadedRequests));

    expect(screen.getAllByRole("heading", { name: "Ґеральт" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Єнніфер" })).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("BookCharactersTab unlink focus", () => {
  async function requestUnlinkOf(name: string): Promise<HTMLElement> {
    await screen.findByRole("heading", { name });
    const menuTrigger = within(cardFor(name)).getByRole("button", { name: "Дії з персонажем" });
    await userEvent.click(menuTrigger);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Прибрати з цієї книги" }));
    await screen.findByRole("alertdialog", { name: "Прибрати з цієї книги" });
    return menuTrigger;
  }

  it("returns focus to the row menu when the unlink is cancelled", async () => {
    renderTab();
    const menuTrigger = await requestUnlinkOf("Ґеральт");

    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    await waitFor(() => expect(menuTrigger).toHaveFocus());
  });

  it("moves focus to the add button once the character is unlinked", async () => {
    renderTab();
    await requestUnlinkOf("Ґеральт");

    await userEvent.click(await screen.findByRole("button", { name: "Прибрати" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Додати персонажа" })).toHaveFocus(),
    );
  });
});

describe("BookCharactersTab roster-wide signals", () => {
  it("shows no favorites, POV or total summary badges above a populated roster", async () => {
    respondToRoster = () => rosterPage([geralt, favoriteYennefer], 1);

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });

    expect(screen.getByRole("radio", { name: /^POV/ })).toBeVisible();
    expect(screen.queryByText(/Улюблених:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^POV:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Персонажів:/)).not.toBeInTheDocument();
  });

  it("leaves the hidden-content signal to the card lock instead of a roster-wide warning", async () => {
    respondToRoster = () =>
      rosterPage([{ ...geralt, hiddenFields: ["biography", "appearance"] }, yennefer], 1);

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    expect(within(cardFor("Ґеральт")).getByText("Приховані поля: 2")).toBeInTheDocument();
    expect(within(cardFor("Єнніфер")).queryByText(/Приховані поля/)).not.toBeInTheDocument();
    expect(screen.queryByText(/приховані записи/i)).not.toBeInTheDocument();
  });
});

describe("BookCharactersTab filters", () => {
  function activeFilters(): Promise<HTMLElement> {
    return screen.findByRole("group", { name: "Активні фільтри" });
  }

  function lastRosterQuery(): URLSearchParams {
    const url = rosterRequestUrls().at(-1);
    return new URL(url ?? "/", "http://localhost").searchParams;
  }

  async function openImportanceFacet(): Promise<HTMLElement> {
    await userEvent.click(screen.getByRole("button", { name: /^Важливість/ }));
    return screen.findByRole("listbox", { name: "Важливість" });
  }

  it("sends the URL filters to the backend and keeps the toolbar when nothing matches", async () => {
    respondToRoster = () => rosterPage([], 1);

    renderTab("characterImportance=not_specified,major&characterFilter=favorites");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.queryByText("Тут поки немає персонажів")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Улюблені/ })).toBeChecked();
    const query = lastRosterQuery();
    expect(query.getAll("importance")).toEqual(["major", "not_specified"]);
    expect(query.get("favoritesOnly")).toBe("true");
    expect(query.get("povOnly")).toBeNull();
  });

  it("sends a POV link from the URL to the backend as a POV-only request", async () => {
    renderTab("characterFilter=pov");
    await screen.findByRole("heading", { name: "Ґеральт" });

    const query = lastRosterQuery();
    expect(query.get("povOnly")).toBe("true");
    expect(query.get("favoritesOnly")).toBeNull();
    expect(screen.getByRole("radio", { name: /^POV/ })).toBeChecked();
  });

  it("shows each quick filter with its count from the book summary", async () => {
    renderTab();

    const quickFilters = await screen.findByRole("radiogroup", { name: "Швидкі фільтри" });

    expect(
      await within(quickFilters).findByRole("radio", { name: "Улюблені 3" }),
    ).not.toBeChecked();
    expect(within(quickFilters).getByRole("radio", { name: "POV 2" })).not.toBeChecked();
    expect(within(quickFilters).getByRole("radio", { name: "Усі 7" })).toBeChecked();
  });

  it("reloads from the first page when the favorites filter is switched on", async () => {
    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    await userEvent.click(screen.getByRole("radio", { name: /^Улюблені/ }));

    await waitFor(() => expect(lastRosterQuery().get("favoritesOnly")).toBe("true"));
    expect(lastRosterQuery().get("pageNumber")).toBe("1");
    expect(screen.getByRole("radio", { name: /^Улюблені/ })).toBeChecked();
  });

  it("keeps a single quick filter, so choosing POV deselects favorites", async () => {
    renderTab("characterFilter=favorites");
    await screen.findByRole("heading", { name: "Ґеральт" });

    await userEvent.click(screen.getByRole("radio", { name: /^POV/ }));

    await waitFor(() => expect(lastRosterQuery().get("povOnly")).toBe("true"));
    expect(lastRosterQuery().get("favoritesOnly")).toBeNull();
    expect(screen.getByRole("radio", { name: /^POV/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Улюблені/ })).not.toBeChecked();
  });

  it("keeps the quick filter in the URL and drops it once all characters are shown again", async () => {
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTab("", book, (event) => urlUpdates.push(event));
    await screen.findByRole("heading", { name: "Ґеральт" });

    await userEvent.click(screen.getByRole("radio", { name: /^POV/ }));
    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get("characterFilter")).toBe("pov"));

    await userEvent.click(screen.getByRole("radio", { name: /^Усі/ }));
    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.has("characterFilter")).toBe(false));
  });

  it("filters by importance, including unspecified, from the importance facet", async () => {
    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    const levels = await openImportanceFacet();
    await userEvent.click(within(levels).getByRole("option", { name: /^Не вказано/ }));

    await waitFor(() => expect(lastRosterQuery().getAll("importance")).toEqual(["not_specified"]));
  });

  it("lists every importance level with its count from the book summary", async () => {
    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    const levels = await openImportanceFacet();

    await waitFor(() =>
      expect(within(levels).getByRole("option", { name: /^Головний/ })).toHaveTextContent(
        /^Головний\s*4$/,
      ),
    );
    expect(within(levels).getByRole("option", { name: /^Центральний/ })).toHaveTextContent(
      /^Центральний\s*1$/,
    );
    expect(within(levels).getByRole("option", { name: /^Другорядний/ })).toHaveTextContent(
      /^Другорядний\s*2$/,
    );
    expect(within(levels).getAllByRole("option")).toHaveLength(6);
  });

  it("lists each chosen importance level as its own active filter", async () => {
    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    const levels = await openImportanceFacet();
    await userEvent.click(within(levels).getByRole("option", { name: /^Головний/ }));
    await userEvent.click(within(levels).getByRole("option", { name: /^Центральний/ }));

    const chips = await activeFilters();
    expect(await within(chips).findByText("Важливість: Центральний")).toBeInTheDocument();
    expect(within(chips).getByText("Важливість: Головний")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Важливість" })).not.toBeInTheDocument();
  });

  it("drops only the removed importance level and asks the backend without it", async () => {
    renderTab("characterImportance=central,major");

    const chips = await activeFilters();
    await userEvent.click(
      within(chips).getByRole("button", { name: "Прибрати фільтр Важливість: Центральний" }),
    );

    await waitFor(() => expect(lastRosterQuery().getAll("importance")).toEqual(["major"]));
    const remaining = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(remaining).queryByText("Важливість: Центральний")).not.toBeInTheDocument();
    expect(within(remaining).getByText("Важливість: Головний")).toBeInTheDocument();
  });

  it("removes the POV filter chip and keeps the search and the sort", async () => {
    renderTab("characterSearch=Ге&characterFilter=pov&characterSort=name");
    await screen.findByRole("heading", { name: "Ґеральт" });

    const chips = await activeFilters();
    await userEvent.click(within(chips).getByRole("button", { name: "Прибрати фільтр POV" }));

    await waitFor(() => expect(lastRosterQuery().get("povOnly")).toBeNull());
    expect(lastRosterQuery().get("search")).toBe("Ге");
    expect(lastRosterQuery().get("sort")).toBe("name");
    const remaining = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(remaining).queryByText("POV")).not.toBeInTheDocument();
    expect(within(remaining).getByText("Пошук: Ге")).toBeInTheDocument();
  });

  it("clears the search and every filter at once from the active filters but keeps the sort", async () => {
    renderTab(
      "characterSearch=Ге&characterFilter=pov&characterImportance=major&characterSort=name",
    );
    await screen.findByRole("heading", { name: "Ґеральт" });

    const chips = await activeFilters();
    expect(within(chips).getByText("Пошук: Ге")).toBeInTheDocument();
    expect(within(chips).getByText("POV")).toBeInTheDocument();
    expect(within(chips).getByText("Важливість: Головний")).toBeInTheDocument();

    await userEvent.click(within(chips).getByRole("button", { name: "Очистити все" }));

    await waitFor(() => expect(lastRosterQuery().get("search")).toBeNull());
    const query = lastRosterQuery();
    expect(query.get("povOnly")).toBeNull();
    expect(query.getAll("importance")).toEqual([]);
    expect(query.get("sort")).toBe("name");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Пошук персонажів" })).toHaveValue(""),
    );
    expect(screen.getByRole("radio", { name: /^Усі/ })).toBeChecked();
    expect(screen.queryByRole("group", { name: "Активні фільтри" })).not.toBeInTheDocument();
  });

  it("clears search and filters from the no-results state but keeps the sort", async () => {
    respondToRoster = (url) => rosterPage(url.includes("search=") ? [] : [geralt], 1);

    renderTab("characterSearch=zzz&characterImportance=major&characterSort=name");
    await screen.findByText("Нічого не знайдено");

    await userEvent.click(screen.getByRole("button", { name: "Скинути пошук і фільтри" }));

    expect(await screen.findByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    const query = lastRosterQuery();
    expect(query.get("search")).toBeNull();
    expect(query.getAll("importance")).toEqual([]);
    expect(query.get("sort")).toBe("name");
  });
});

describe("BookCharactersTab favorite guard", () => {
  it("sends one request when the heart is pressed again while the first is pending", async () => {
    const gate = favoriteGate();
    respondToFavorite = () => gate.promise;

    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    const card = cardFor("Ґеральт");
    await userEvent.click(within(card).getByRole("button", { name: "Додати в улюблені" }));
    await userEvent.click(within(card).getByRole("button", { name: "Прибрати з улюблених" }));

    const patches = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patches).toHaveLength(1);
    gate.fail(new Error("stop"));
  });
});
