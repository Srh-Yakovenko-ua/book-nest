import "@testing-library/jest-dom/vitest";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookDetailsView } from "@/features/books/components/book-details.fixtures";
import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeCharacterGlobalSummary } from "../model/characters.fixtures";
import { CharactersCatalogView } from "./characters-catalog-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const activeFiltersCopy = messages.books.library.activeFilters;
const characterChipsCopy = messages.characters.activeFilters;
const sheetCopy = messages.characters.catalog.filters;

const deepLinkIds = {
  book: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  species: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b",
  tag: "6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f",
};

const overview = {
  favoriteCount: 4,
  mostFrequent: {
    appearanceCount: 7,
    leaderCount: 1,
    leaders: [{ avatar: null, id: "c-1", name: "Ґеральт" }],
  },
  multipleBooksCount: 3,
  totalCount: 12,
  withPersonalImpressionCount: 2,
};

const fetchMock = vi.fn();

let respondToBooks: (url: string) => Response;
let respondToGroups: () => Response;
let respondToList: (url: string) => Response;
let respondToOverview: () => Response;
let respondToTags: () => Response;

const viewport = mockIntersectionObserver();

function catalogRequestUrls(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/characters?"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastCatalogRequest(): URLSearchParams {
  return new URL(catalogRequestUrls().at(-1) ?? "", "http://localhost").searchParams;
}

function nextPageRequestCount(): number {
  return catalogRequestUrls().filter((url) => url.includes("pageNumber=2")).length;
}

function page(items: ReturnType<typeof makeCharacterGlobalSummary>[], pagesCount = 1) {
  return { items, page: 1, pagesCount, pageSize: 24, totalCount: items.length };
}

function pagedList(url: string, pagesCount: number) {
  const pageNumber = Number(new URL(url, "http://localhost").searchParams.get("pageNumber") ?? 1);
  return jsonResponse({
    items: [makeCharacterGlobalSummary({ name: "Ґеральт" })],
    page: pageNumber,
    pagesCount,
    pageSize: 24,
    totalCount: pagesCount * 24,
  });
}

function removeFilterLabel(label: string): string {
  return activeFiltersCopy.remove.replace("{label}", label);
}

function renderCatalog(search = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} searchParams={search}>
      <CharactersCatalogView />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  respondToBooks = () => jsonResponse(page([]));
  respondToGroups = () => jsonResponse(page([]));
  respondToOverview = () => jsonResponse(overview);
  respondToTags = () => jsonResponse(page([]));
  respondToList = () =>
    jsonResponse(page([makeCharacterGlobalSummary({ appearanceCount: 7, name: "Ґеральт" })]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/characters/overview")) return Promise.resolve(respondToOverview());
    if (url.includes("/api/character-groups")) return Promise.resolve(respondToGroups());
    if (url.includes("/api/series")) return Promise.resolve(jsonResponse(page([])));
    if (url.includes("/api/books")) return Promise.resolve(respondToBooks(url));
    if (url.includes("/api/tags")) return Promise.resolve(respondToTags());
    if (url.includes("/api/species")) return Promise.resolve(jsonResponse({ items: [] }));
    if (url.includes("/api/characters")) return Promise.resolve(respondToList(url));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharactersCatalogView summary", () => {
  it("renders the four cards from the backend overview", async () => {
    renderCatalog();

    expect((await screen.findAllByText("Усього персонажів")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Найчастіше зʼявляється").length).toBeGreaterThan(0);
    expect(screen.getAllByText("З моїми враженнями").length).toBeGreaterThan(0);
    expect((await screen.findAllByText("12")).length).toBeGreaterThan(0);
  });

  it("says a lead is shared instead of naming one of the tied characters", async () => {
    respondToOverview = () =>
      jsonResponse({
        ...overview,
        mostFrequent: {
          appearanceCount: 7,
          leaderCount: 2,
          leaders: [
            { avatar: null, id: "c-1", name: "Ґеральт" },
            { avatar: null, id: "c-2", name: "Єнніфер" },
          ],
        },
      });

    renderCatalog();

    expect((await screen.findAllByText("Ділять перше місце: 2")).length).toBeGreaterThan(0);
  });

  it("admits an empty catalog has no leader", async () => {
    respondToOverview = () => jsonResponse({ ...overview, mostFrequent: null, totalCount: 0 });
    respondToList = () => jsonResponse(page([]));

    renderCatalog();

    expect((await screen.findAllByText("Поки немає")).length).toBeGreaterThan(0);
  });
});

describe("CharactersCatalogView quick filters", () => {
  it("shows the backend counts on the chips", async () => {
    renderCatalog();

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Улюблені/ })).toHaveTextContent("4"),
    );
    expect(screen.getByRole("radio", { name: /У кількох книгах/ })).toHaveTextContent("3");
  });

  it("puts the chosen chip in the url and asks the backend for it", async () => {
    renderCatalog();

    await screen.findByRole("radio", { name: /Улюблені/ });
    await userEvent.click(screen.getByRole("radio", { name: /У кількох книгах/ }));

    await waitFor(() =>
      expect(catalogRequestUrls().some((url) => url.includes("multipleBooks=true"))).toBe(true),
    );
  });
});

describe("CharactersCatalogView catalog", () => {
  it("links a row to the character page without a book context", async () => {
    renderCatalog();

    const link = await screen.findByRole("link", { name: /Ґеральт/ });
    expect(link).toHaveAttribute("href", "/characters/char-1");
  });

  it("tells a true empty catalog apart from an empty search", async () => {
    respondToList = () => jsonResponse(page([]));

    renderCatalog();
    expect(await screen.findByText("Персонажів ще немає")).toBeInTheDocument();

    renderCatalog("q=zzz");
    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
  });

  it("keeps the list still when the last page is already shown", async () => {
    renderCatalog();

    await screen.findByRole("link", { name: /Ґеральт/ });
    viewport.enterViewport();

    await waitFor(() => expect(nextPageRequestCount()).toBe(0));
  });
});

describe("CharactersCatalogView view toggle", () => {
  it("offers a grid and a list with the grid chosen by default", async () => {
    renderCatalog();

    const viewToggle = await screen.findByRole("radiogroup", { name: "Вигляд" });

    expect(within(viewToggle).getAllByRole("radio")).toHaveLength(2);
    expect(within(viewToggle).getByRole("radio", { name: "Сітка" })).toBeChecked();
    expect(within(viewToggle).getByRole("radio", { name: "Список" })).not.toBeChecked();
    expect(screen.queryByText("Плитка")).not.toBeInTheDocument();
  });

  it("switches to the list and records it in the url", async () => {
    const urlUpdates: UrlUpdateEvent[] = [];
    renderCatalog("", (event) => urlUpdates.push(event));

    const viewToggle = await screen.findByRole("radiogroup", { name: "Вигляд" });
    await userEvent.click(within(viewToggle).getByRole("radio", { name: "Список" }));

    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get("view")).toBe("list"));
    expect(within(viewToggle).getByRole("radio", { name: "Список" })).toBeChecked();
    expect(within(viewToggle).getByRole("radio", { name: "Сітка" })).not.toBeChecked();
  });

  it("opens on the list when the url already asks for it", async () => {
    renderCatalog("view=list");

    const viewToggle = await screen.findByRole("radiogroup", { name: "Вигляд" });

    expect(within(viewToggle).getByRole("radio", { name: "Список" })).toBeChecked();
    expect(within(viewToggle).getByRole("radio", { name: "Сітка" })).not.toBeChecked();
  });
});

describe("CharactersCatalogView sidebar", () => {
  it("renders the static card and asks for nothing", async () => {
    renderCatalog();

    expect(await screen.findByText("Нові можливості вже в дорозі")).toBeInTheDocument();
    expect(
      screen.getByText("Незабаром тут зʼявляться додаткові інструменти для роботи з персонажами."),
    ).toBeInTheDocument();
  });
});

describe("CharactersCatalogView pagination", () => {
  it("loads the next page when the sentinel reaches the viewport", async () => {
    respondToList = (url) => pagedList(url, 2);

    renderCatalog();

    await screen.findByRole("link", { name: /Ґеральт/ });
    viewport.enterViewport();

    await waitFor(() => expect(nextPageRequestCount()).toBe(1));
  });

  it("starts the list over when a quick filter changes", async () => {
    respondToList = (url) => pagedList(url, 2);

    renderCatalog();

    await screen.findByRole("link", { name: /Ґеральт/ });
    viewport.enterViewport();
    await waitFor(() => expect(nextPageRequestCount()).toBe(1));

    await userEvent.click(screen.getByRole("radio", { name: /Улюблені/ }));

    await waitFor(() =>
      expect(catalogRequestUrls().some((url) => url.includes("favorite=true"))).toBe(true),
    );
    const firstFavoriteRequest = catalogRequestUrls().find((url) => url.includes("favorite=true"));
    expect(firstFavoriteRequest).toContain("pageNumber=1");
  });

  it("offers a retry when the next page fails and asks for it again", async () => {
    let failNextPage = true;
    respondToList = (url) => {
      if (url.includes("pageNumber=2") && failNextPage) {
        failNextPage = false;
        return jsonResponse({ message: "boom" }, 500);
      }
      return pagedList(url, 2);
    };

    renderCatalog();

    await screen.findByRole("link", { name: /Ґеральт/ });
    viewport.enterViewport();

    await waitFor(() => expect(nextPageRequestCount()).toBe(1));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не вдалося завантажити ще персонажів");

    const retry = within(alert).getByRole("button", { name: "Повторити" });
    expect(retry).toHaveFocus();

    await userEvent.click(retry);

    await waitFor(() => expect(nextPageRequestCount()).toBe(2));
  });
});

describe("CharactersCatalogView results counter", () => {
  it("shows how many characters are loaded out of the backend total", async () => {
    respondToList = () =>
      jsonResponse({
        items: [
          makeCharacterGlobalSummary({ id: "char-1", name: "Ґеральт" }),
          makeCharacterGlobalSummary({ id: "char-2", name: "Єнніфер" }),
        ],
        page: 1,
        pagesCount: 3,
        pageSize: 2,
        totalCount: 5,
      });

    renderCatalog();

    expect(await screen.findByText("Показано 2 із 5 персонажів")).toBeInTheDocument();
  });

  it("uses the singular form for a total of one", async () => {
    respondToList = () => jsonResponse(page([makeCharacterGlobalSummary({ name: "Ґеральт" })]));

    renderCatalog();

    expect(await screen.findByText("Показано 1 із 1 персонажа")).toBeInTheDocument();
  });

  it("counts the favorites response once that chip is chosen", async () => {
    respondToList = (url) =>
      url.includes("favorite=true")
        ? jsonResponse({
            items: [makeCharacterGlobalSummary({ id: "char-3", name: "Цірі" })],
            page: 1,
            pagesCount: 4,
            pageSize: 1,
            totalCount: 4,
          })
        : jsonResponse({
            items: [
              makeCharacterGlobalSummary({ id: "char-1", name: "Ґеральт" }),
              makeCharacterGlobalSummary({ id: "char-2", name: "Єнніфер" }),
            ],
            page: 1,
            pagesCount: 3,
            pageSize: 2,
            totalCount: 5,
          });

    renderCatalog();

    await screen.findByText("Показано 2 із 5 персонажів");
    await userEvent.click(screen.getByRole("radio", { name: /Улюблені/ }));

    expect(await screen.findByText("Показано 1 із 4 персонажів")).toBeInTheDocument();
    expect(screen.queryByText("Показано 2 із 5 персонажів")).not.toBeInTheDocument();
  });

  it("grows the shown count when the next page arrives", async () => {
    respondToList = (url) => pagedList(url, 2);

    renderCatalog();

    await screen.findByText("Показано 1 із 48 персонажів");
    viewport.enterViewport();

    expect(await screen.findByText("Показано 2 із 48 персонажів")).toBeInTheDocument();
  });

  it("drops the line when the catalog fails to load", async () => {
    respondToList = () => jsonResponse({ message: "boom" }, 500);

    renderCatalog();

    await screen.findByRole("alert");
    expect(screen.queryByText(/Показано/)).not.toBeInTheDocument();
  });
});

describe("CharactersCatalogView active filters", () => {
  it("shows no active filters row while nothing narrows the catalog", async () => {
    renderCatalog();

    await screen.findByText("Показано 1 із 1 персонажа");
    expect(screen.queryByRole("group", { name: activeFiltersCopy.label })).not.toBeInTheDocument();
  });

  it("lists a chosen quick filter as a chip next to a clear all action", async () => {
    renderCatalog();

    await userEvent.click(await screen.findByRole("radio", { name: /Улюблені/ }));

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    expect(within(activeFilters).getByText("Улюблені")).toBeInTheDocument();
    expect(
      within(activeFilters).getByRole("button", { name: removeFilterLabel("Улюблені") }),
    ).toBeInTheDocument();
    expect(
      within(activeFilters).getByRole("button", { name: activeFiltersCopy.clearAll }),
    ).toBeInTheDocument();
  });

  it("returns to all characters when the quick filter chip is removed", async () => {
    const urlUpdates: UrlUpdateEvent[] = [];
    renderCatalog("", (event) => urlUpdates.push(event));

    await userEvent.click(await screen.findByRole("radio", { name: /Улюблені/ }));
    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get("filter")).toBe("favorites"));

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    await userEvent.click(
      within(activeFilters).getByRole("button", { name: removeFilterLabel("Улюблені") }),
    );

    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.has("filter")).toBe(false));
    expect(screen.getByRole("radio", { name: /Усі/ })).toBeChecked();
    expect(screen.queryByRole("group", { name: activeFiltersCopy.label })).not.toBeInTheDocument();
  });

  it("shows one chip per value from a deep link", async () => {
    renderCatalog("importance=central,major&gender=female");

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });

    expect(within(activeFilters).getByText("Важливість: Центральний")).toBeInTheDocument();
    expect(within(activeFilters).getByText("Важливість: Головний")).toBeInTheDocument();
    expect(within(activeFilters).getByText("Гендер: Жіноча")).toBeInTheDocument();
    expect(
      within(activeFilters).getAllByRole("button", { name: /^Прибрати фільтр / }),
    ).toHaveLength(3);
  });

  it("drops only the removed value and asks the backend without it", async () => {
    renderCatalog("importance=central,major&gender=female");

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    await userEvent.click(
      within(activeFilters).getByRole("button", {
        name: removeFilterLabel("Важливість: Центральний"),
      }),
    );

    await waitFor(() => {
      const lastRequest = new URL(catalogRequestUrls().at(-1) ?? "", "http://localhost");
      expect(lastRequest.searchParams.getAll("importance")).toEqual(["major"]);
      expect(lastRequest.searchParams.getAll("gender")).toEqual(["female"]);
    });
    const remaining = screen.getByRole("group", { name: activeFiltersCopy.label });
    expect(within(remaining).queryByText("Важливість: Центральний")).not.toBeInTheDocument();
    expect(within(remaining).getByText("Важливість: Головний")).toBeInTheDocument();
    expect(within(remaining).getByText("Гендер: Жіноча")).toBeInTheDocument();
  });

  it("names a group chip after the group it filters by", async () => {
    const groupId = "6f1c2a9e-4b7d-4e3a-9c5f-0d8b7a6e5f41";
    respondToGroups = () =>
      jsonResponse({
        items: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            customType: null,
            description: null,
            hiddenFields: [],
            id: groupId,
            isSpoiler: false,
            memberCount: 3,
            name: "Відьмаки",
            seriesId: null,
            type: "clan",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        page: 1,
        pagesCount: 1,
        pageSize: 50,
        totalCount: 1,
      });

    renderCatalog(`groupId=${groupId}`);

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    expect(await within(activeFilters).findByText("Група: Відьмаки")).toBeInTheDocument();
  });

  it("clears search, quick filter and advanced filters at once", async () => {
    renderCatalog("q=Ґер&filter=favorites&attitude=like");

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    const search = screen.getByRole("textbox", { name: messages.characters.catalog.searchLabel });
    expect(search).toHaveValue("Ґер");
    expect(within(activeFilters).getByText("Пошук: Ґер")).toBeInTheDocument();
    expect(within(activeFilters).getByText("Улюблені")).toBeInTheDocument();
    expect(within(activeFilters).getByText("Моє ставлення: Подобається")).toBeInTheDocument();

    await userEvent.click(
      within(activeFilters).getByRole("button", { name: activeFiltersCopy.clearAll }),
    );

    await waitFor(() => expect(search).toHaveValue(""));
    expect(screen.getByRole("radio", { name: /Усі/ })).toBeChecked();
    expect(screen.queryByRole("group", { name: activeFiltersCopy.label })).not.toBeInTheDocument();
  });

  it("shows a spoiler chip from a deep link and asks for characters with spoilers", async () => {
    renderCatalog("spoilers=with");

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });

    expect(within(activeFilters).getByText(characterChipsCopy.withSpoilers)).toBeInTheDocument();
    await waitFor(() => expect(lastCatalogRequest().get("hasSpoilers")).toBe("true"));
  });

  it("names a tag chip after the tag it filters by", async () => {
    respondToTags = () =>
      jsonResponse({
        items: [{ color: "sage", id: deepLinkIds.tag, name: "повільне кохання" }],
        page: 1,
        pagesCount: 1,
        pageSize: 1,
        totalCount: 1,
      });

    renderCatalog(`tagId=${deepLinkIds.tag}`);

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    expect(
      await within(activeFilters).findByText(
        characterChipsCopy.tag.replace("{name}", "повільне кохання"),
      ),
    ).toBeInTheDocument();
  });

  it("names a book chip after the book it filters by", async () => {
    respondToBooks = (url) =>
      url.includes(`/api/books/${deepLinkIds.book}`)
        ? jsonResponse(makeBookDetailsView({ id: deepLinkIds.book, title: "Меч призначення" }))
        : jsonResponse({ message: "not found" }, 404);

    renderCatalog(`bookId=${deepLinkIds.book}`);

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    expect(
      await within(activeFilters).findByText(
        characterChipsCopy.book.replace("{name}", "Меч призначення"),
      ),
    ).toBeInTheDocument();
  });

  it("drops only the removed spoiler chip and keeps the book filter", async () => {
    const urlUpdates: UrlUpdateEvent[] = [];
    renderCatalog(`spoilers=with&bookId=${deepLinkIds.book}`, (event) => urlUpdates.push(event));

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    await userEvent.click(
      within(activeFilters).getByRole("button", {
        name: removeFilterLabel(characterChipsCopy.withSpoilers),
      }),
    );

    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.has("spoilers")).toBe(false));
    expect(urlUpdates.at(-1)?.searchParams.get("bookId")).toBe(deepLinkIds.book);
    await waitFor(() => expect(lastCatalogRequest().has("hasSpoilers")).toBe(false));
    expect(lastCatalogRequest().get("bookId")).toBe(deepLinkIds.book);
  });

  it("clears the book, species, tag and spoiler filters with the rest", async () => {
    const urlUpdates: UrlUpdateEvent[] = [];
    renderCatalog(
      `bookId=${deepLinkIds.book}&speciesId=${deepLinkIds.species}&tagId=${deepLinkIds.tag}&spoilers=without`,
      (event) => urlUpdates.push(event),
    );

    const activeFilters = await screen.findByRole("group", { name: activeFiltersCopy.label });
    expect(within(activeFilters).getByText(characterChipsCopy.withoutSpoilers)).toBeInTheDocument();

    await userEvent.click(
      within(activeFilters).getByRole("button", { name: activeFiltersCopy.clearAll }),
    );

    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.toString()).toBe(""));
    await waitFor(() => expect(lastCatalogRequest().has("hasSpoilers")).toBe(false));
    expect(lastCatalogRequest().has("bookId")).toBe(false);
    expect(lastCatalogRequest().has("speciesId")).toBe(false);
    expect(lastCatalogRequest().has("tagId")).toBe(false);
    expect(screen.queryByRole("group", { name: activeFiltersCopy.label })).not.toBeInTheDocument();
  });
});

describe("CharactersCatalogView filters sheet", () => {
  it("puts the applied spoiler choice in the url and asks the backend for it", async () => {
    const urlUpdates: UrlUpdateEvent[] = [];
    renderCatalog("", (event) => urlUpdates.push(event));

    await screen.findByText("Показано 1 із 1 персонажа");
    await userEvent.click(screen.getByRole("button", { name: sheetCopy.trigger }));
    const sheet = within(await screen.findByRole("dialog", { name: sheetCopy.title }));
    await userEvent.click(sheet.getByRole("combobox", { name: sheetCopy.spoilers }));
    await userEvent.click(
      await screen.findByRole("option", { name: sheetCopy.spoilerOptions.with }),
    );
    await userEvent.click(sheet.getByRole("button", { name: sheetCopy.apply }));

    await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get("spoilers")).toBe("with"));
    await waitFor(() => expect(lastCatalogRequest().get("hasSpoilers")).toBe("true"));
  });
});
