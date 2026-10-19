import "@testing-library/jest-dom/vitest";
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

const fetchMock = vi.fn();
const viewport = mockIntersectionObserver();

let respondToRoster: (url: string) => Promise<Response> | Response;
let respondToSummary: () => Response;
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

function renderTab(search = "", tabBook = book) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams={search}>
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
  respondToSummary = () => jsonResponse(makeBookCharacterSummary());
  respondToFavorite = () => jsonResponse(makeCharacterDetails());
  respondToUnlink = () => new Response(null, { status: 204 });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/character-summary")) return Promise.resolve(respondToSummary());
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

  it("hides the summary and the toolbar for an empty book", async () => {
    respondToRoster = () => rosterPage([], 1);

    renderTab();

    await screen.findByText("Тут поки немає персонажів");

    expect(screen.queryByPlaceholderText("Пошук у цій книзі...")).not.toBeInTheDocument();
    expect(screen.queryByText(/Персонажів:/)).not.toBeInTheDocument();
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
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole("option", { name: "За іменем" }));

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

describe("BookCharactersTab summary strip", () => {
  it("shows favorites and POV without a total characters chip", async () => {
    respondToSummary = () =>
      jsonResponse(
        makeBookCharacterSummary({
          favoritesCount: 1,
          povCount: 2,
          totalVisibleCharacters: 3,
        }),
      );

    renderTab();

    expect(await screen.findByText("Улюблених: 1")).toBeVisible();
    expect(screen.getByText("POV: 2")).toBeVisible();
    expect(screen.queryByText(/Персонажів:/)).not.toBeInTheDocument();
  });

  it("leaves the hidden-content signal to the card lock instead of a roster-wide warning", async () => {
    respondToSummary = () =>
      jsonResponse(makeBookCharacterSummary({ favoritesCount: 1, povCount: 2 }));
    respondToRoster = () =>
      rosterPage([{ ...geralt, hiddenFields: ["biography", "appearance"] }, yennefer], 1);

    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });
    expect(await screen.findByText("Улюблених: 1")).toBeVisible();
    expect(within(cardFor("Ґеральт")).getByText("Приховані поля: 2")).toBeInTheDocument();
    expect(within(cardFor("Єнніфер")).queryByText(/Приховані поля/)).not.toBeInTheDocument();
    expect(screen.queryByText(/приховані записи/i)).not.toBeInTheDocument();
  });
});

describe("BookCharactersTab filters", () => {
  function lastRosterQuery(): URLSearchParams {
    const url = rosterRequestUrls().at(-1);
    return new URL(url ?? "/", "http://localhost").searchParams;
  }

  it("sends the URL filters to the backend and keeps the toolbar when nothing matches", async () => {
    respondToRoster = () => rosterPage([], 1);

    renderTab(
      "characterImportance=not_specified,major&characterFavoritesOnly=true&characterPovOnly=true",
    );

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.queryByText("Тут поки немає персонажів")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Улюблені" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const query = lastRosterQuery();
    expect(query.getAll("importance")).toEqual(["major", "not_specified"]);
    expect(query.get("favoritesOnly")).toBe("true");
    expect(query.get("povOnly")).toBe("true");
  });

  it("reloads from the first page when the favorites filter is switched on", async () => {
    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    await userEvent.click(screen.getByRole("button", { name: "Улюблені" }));

    await waitFor(() => expect(lastRosterQuery().get("favoritesOnly")).toBe("true"));
    expect(lastRosterQuery().get("pageNumber")).toBe("1");
    expect(screen.getByRole("button", { name: "Улюблені" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("filters by importance, including unspecified, from the toolbar menu", async () => {
    renderTab();
    await screen.findByRole("heading", { name: "Ґеральт" });

    await userEvent.click(screen.getByRole("button", { name: /Важливість/ }));
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Не вказано" }));

    await waitFor(() => expect(lastRosterQuery().getAll("importance")).toEqual(["not_specified"]));
  });

  it("clears only the filters and keeps the search", async () => {
    renderTab("characterSearch=Ге&characterPovOnly=true&characterSort=name");
    await screen.findByRole("heading", { name: "Ґеральт" });

    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    await waitFor(() => expect(lastRosterQuery().get("povOnly")).toBeNull());
    expect(lastRosterQuery().get("search")).toBe("Ге");
    expect(lastRosterQuery().get("sort")).toBe("name");
    expect(screen.queryByRole("button", { name: "Скинути фільтри" })).not.toBeInTheDocument();
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
