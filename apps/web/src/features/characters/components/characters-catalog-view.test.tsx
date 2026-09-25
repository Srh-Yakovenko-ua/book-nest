import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

let respondToList: (url: string) => Response;
let respondToOverview: () => Response;

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

function renderCatalog(search = "") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <CharactersCatalogView />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  respondToOverview = () => jsonResponse(overview);
  respondToList = () =>
    jsonResponse(page([makeCharacterGlobalSummary({ appearanceCount: 7, name: "Ґеральт" })]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/characters/overview")) return Promise.resolve(respondToOverview());
    if (url.includes("/api/character-groups")) {
      return Promise.resolve(jsonResponse(page([])));
    }
    if (url.includes("/api/series")) return Promise.resolve(jsonResponse(page([])));
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
