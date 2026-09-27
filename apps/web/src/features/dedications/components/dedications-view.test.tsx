import "@testing-library/jest-dom/vitest";

import type { DedicationsQuickCounts } from "@app/shared";
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

import { makeDedicationBook, makeDedicationsSummary } from "../model/dedications.fixtures";
import { DedicationsView } from "./dedications-view";

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

type PageBody = {
  items: ReturnType<typeof makeDedicationBook>[];
  page?: number;
  pagesCount?: number;
  totalCount?: number;
};

let respondToList: (url: string) => Response;
let respondToQuickCounts: (url: URL) => Promise<Response>;
let respondToSummary: () => Response;
let respondToUpdate: () => Response;

function chip(name: string): HTMLElement {
  const match = screen
    .getAllByRole("radio")
    .find((radio) => radio.firstChild?.textContent === name);
  if (match === undefined) throw new Error(`No quick filter chip ${name}`);
  return match;
}

const viewport = mockIntersectionObserver();

function firstListUrl(): string {
  const url = listUrls()[0];
  if (url === undefined) throw new Error("no dedications list request was made");
  return url;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function listUrls(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter(
      (url) =>
        url.includes("/api/books/dedications") &&
        !url.includes("/summary") &&
        !url.includes("/quick-counts"),
    );
}

function pageResponse({ items, page = 1, pagesCount = 1, totalCount }: PageBody): Response {
  return jsonResponse({
    items,
    page,
    pagesCount,
    pageSize: 12,
    totalCount: totalCount ?? items.length,
  });
}

function quickCountRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/books/dedications/quick-counts");
}

function quickCounts(overrides: Partial<DedicationsQuickCounts> = {}): DedicationsQuickCounts {
  return { all: 9, favorites: 3, finished: 4, unfinished: 5, ...overrides };
}

function renderView(search = "") {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams={search}>
      <DedicationsView />
    </NuqsTestingAdapter>,
  );
}

function requestedPageNumber(url: string): number {
  return Number(new URL(url, "http://localhost").searchParams.get("pageNumber") ?? 1);
}

beforeEach(() => {
  respondToList = () => pageResponse({ items: [makeDedicationBook()] });
  respondToQuickCounts = () => Promise.resolve(jsonResponse(quickCounts()));
  respondToSummary = () => jsonResponse(makeDedicationsSummary());
  respondToUpdate = () => jsonResponse(makeDedicationBook());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH") return Promise.resolve(respondToUpdate());
    if (url.includes("/api/books/dedications/summary")) return Promise.resolve(respondToSummary());
    if (url.includes("/api/books/dedications/quick-counts")) {
      return respondToQuickCounts(new URL(url, "http://localhost"));
    }
    if (url.includes("/api/books/dedications")) return Promise.resolve(respondToList(url));
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DedicationsView", () => {
  it("renders the page heading and subtitle", async () => {
    renderView();

    expect(await screen.findByRole("heading", { level: 1, name: "Присвяти" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Авторські присвяти з книг, які ви додали до своєї бібліотеки. Маленькі слова, з яких починається велика історія.",
      ),
    ).toBeInTheDocument();
  });

  it("asks the server for the defaults on first load", async () => {
    renderView();

    await waitFor(() => expect(listUrls()).toHaveLength(1));

    const url = firstListUrl();
    expect(url).toContain("filter=all");
    expect(url).toContain("sort=newest");
    expect(url).toContain("pageNumber=1");
    expect(url).toContain("pageSize=12");
  });

  it("pushes the favorites filter from the URL to the server", async () => {
    renderView("?filter=favorites");

    await waitFor(() => expect(listUrls()).toHaveLength(1));
    expect(listUrls()[0]).toContain("filter=favorites");
  });

  it("pushes the search, genre and sort from the URL to the server", async () => {
    renderView("?search=%D0%BC%D1%80%D1%96%D1%8F&genre=romance&sort=author_asc");

    await waitFor(() => expect(listUrls()).toHaveLength(1));

    const url = firstListUrl();
    expect(url).toContain("genre=romance");
    expect(url).toContain("sort=author_asc");
    expect(decodeURIComponent(url)).toContain("q=мрія");
  });

  it("shows the empty state when the user has no dedications at all", async () => {
    respondToList = () => pageResponse({ items: [] });
    respondToSummary = () =>
      jsonResponse(
        makeDedicationsSummary({
          availableGenres: [],
          favoriteCount: 0,
          finishedCount: 0,
          topAuthor: null,
          topGenre: null,
          totalCount: 0,
          unfinishedCount: 0,
        }),
      );
    renderView();

    expect(await screen.findByText("Додайте першу присвяту")).toBeInTheDocument();
  });

  it("shows the no-results state when filters exclude everything", async () => {
    respondToList = () => pageResponse({ items: [], totalCount: 0 });
    renderView("?filter=favorites");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Очистити фільтри/ })).toBeInTheDocument();
  });

  it("shows the error state when the list request fails", async () => {
    respondToList = () => jsonResponse({ message: "boom" }, 500);
    renderView();

    expect(await screen.findByText("Не вдалося завантажити присвяти")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Спробувати ще раз/ })).toBeInTheDocument();
  });

  it("renders the statistics from the summary, not from the current page", async () => {
    respondToSummary = () =>
      jsonResponse(makeDedicationsSummary({ favoriteCount: 5, totalCount: 24 }));
    renderView();

    const totalCard = (await screen.findByText("Усього присвят")).closest(
      '[data-slot="stat-card"]',
    );
    if (!(totalCard instanceof HTMLElement)) throw new Error("total dedications card not found");
    expect(within(totalCard).getByText("24")).toBeInTheDocument();
  });

  it("falls back to a dash when the summary has no top author or genre", async () => {
    respondToSummary = () =>
      jsonResponse(makeDedicationsSummary({ topAuthor: null, topGenre: null }));
    renderView();

    await screen.findByText("Топ жанр");
    expect(screen.getByText("Топ автор")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("shows the all-shown label without a sentinel while a single page covers the results", async () => {
    renderView();

    await screen.findByText("Останнє бажання");
    expect(screen.getByText("Усі присвяти показано")).toBeInTheDocument();

    viewport.enterViewport();
    await waitFor(() => expect(listUrls()).toHaveLength(1));
  });

  it("shows how many dedications are visible out of the filtered total", async () => {
    respondToList = () =>
      pageResponse({ items: [makeDedicationBook()], pagesCount: 3, totalCount: 30 });
    renderView();

    expect(await screen.findByText("Показано 1 з 30 присвят")).toBeInTheDocument();
  });

  it("drops the all-shown label once the server reports several pages", async () => {
    respondToList = () =>
      pageResponse({ items: [makeDedicationBook()], pagesCount: 3, totalCount: 30 });
    renderView();

    await screen.findByText("Останнє бажання");
    expect(screen.queryByText("Усі присвяти показано")).not.toBeInTheDocument();
  });

  it("requests the next page when the sentinel reaches the viewport", async () => {
    respondToList = (url) =>
      pageResponse({
        items: [makeDedicationBook()],
        page: requestedPageNumber(url),
        pagesCount: 2,
        totalCount: 30,
      });
    renderView();

    await screen.findByText("Останнє бажання");
    viewport.enterViewport();

    await waitFor(() => expect(listUrls().length).toBeGreaterThan(1));
    expect(listUrls().some((url) => url.includes("pageNumber=2"))).toBe(true);
  });

  it("still renders the summary cards with fallback values when the summary request fails", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    renderView();

    expect(await screen.findByText("Останнє бажання")).toBeInTheDocument();
    expect(screen.getByText("Усього присвят")).toBeInTheDocument();
    expect(screen.getByText("Топ жанр")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("still separates no-results from empty when the summary request fails", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    respondToList = () => pageResponse({ items: [], totalCount: 0 });
    renderView("?filter=favorites");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.queryByText("Додайте першу присвяту")).not.toBeInTheDocument();
  });

  it("still shows the empty state when the summary fails and no filter is active", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    respondToList = () => pageResponse({ items: [], totalCount: 0 });
    renderView();

    expect(await screen.findByText("Додайте першу присвяту")).toBeInTheDocument();
    expect(screen.queryByText("Нічого не знайдено")).not.toBeInTheDocument();
  });

  it("renders dedications as rows once the list view is chosen", async () => {
    renderView();

    await screen.findByText("Останнє бажання");
    await userEvent.click(screen.getByRole("radio", { name: "Список" }));

    expect(screen.getByText("Моїй мамі, яка навчила мене мріяти.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Останнє бажання" })).toHaveAttribute(
      "href",
      "/books/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });

  it("moves focus into the reading modal when it opens", async () => {
    renderView();

    await userEvent.click(await screen.findByRole("button", { name: /Читати присвяту/ }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it("returns focus to the card trigger once the modal closes", async () => {
    renderView();

    const trigger = await screen.findByRole("button", { name: /Читати присвяту/ });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("names the modal favorite button with its visible label", async () => {
    renderView();

    await userEvent.click(await screen.findByRole("button", { name: /Читати присвяту/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Додати в улюблені" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps the reading modal mounted when the book leaves the filtered list", async () => {
    const favorite = makeDedicationBook({ isFavoriteDedication: true });
    let listCalls = 0;
    respondToList = () => {
      listCalls += 1;
      return listCalls === 1
        ? pageResponse({ items: [favorite] })
        : pageResponse({ items: [], totalCount: 0 });
    };
    respondToUpdate = () =>
      jsonResponse(makeDedicationBook({ id: favorite.id, isFavoriteDedication: false }));
    renderView("?filter=favorites");

    await userEvent.click(await screen.findByRole("button", { name: /Читати присвяту/ }));
    const dialog = await screen.findByRole("dialog");

    await userEvent.click(within(dialog).getByRole("button", { name: "Прибрати з улюблених" }));

    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("Останнє бажання")).toBeInTheDocument();
  });
});

describe("DedicationsView quick filter counts", () => {
  it("shows the chip counts from quick-counts and keeps the summary cards on the summary", async () => {
    respondToSummary = () =>
      jsonResponse(makeDedicationsSummary({ favoriteCount: 11, totalCount: 24 }));
    renderView();

    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());
    expect(within(chip("Улюблені")).getByText("3")).toBeInTheDocument();
    expect(within(chip("Із прочитаних книг")).getByText("4")).toBeInTheDocument();
    expect(within(chip("Із непрочитаних книг")).getByText("5")).toBeInTheDocument();

    const totalCard = screen.getByText("Усього присвят").closest('[data-slot="stat-card"]');
    if (!(totalCard instanceof HTMLElement)) throw new Error("total dedications card not found");
    expect(within(totalCard).getByText("24")).toBeInTheDocument();
    expect(within(chip("Усі")).queryByText("24")).not.toBeInTheDocument();
  });

  it("renders chips without numbers until the first counts arrive", async () => {
    respondToQuickCounts = () => new Promise<Response>(() => {});
    renderView();

    await screen.findByText("Останнє бажання");
    await waitFor(() => expect(quickCountRequests()).not.toHaveLength(0));
    expect(chip("Усі")).toHaveTextContent(/^Усі$/);
    expect(chip("Улюблені")).toHaveTextContent(/^Улюблені$/);
  });

  it("keeps a chip at zero enabled and shows the zero", async () => {
    respondToQuickCounts = () => Promise.resolve(jsonResponse(quickCounts({ favorites: 0 })));
    renderView();

    await waitFor(() => expect(within(chip("Улюблені")).getByText("0")).toBeInTheDocument());
    expect(chip("Улюблені")).toBeEnabled();
  });

  it("sends the search to quick-counts and shows the counts it returns", async () => {
    respondToQuickCounts = (url) =>
      Promise.resolve(
        jsonResponse(
          url.searchParams.get("q") === "мрія"
            ? quickCounts({ all: 2, favorites: 1 })
            : quickCounts(),
        ),
      );
    renderView();
    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук присвят" }), "мрія");

    await waitFor(() => expect(within(chip("Усі")).getByText("2")).toBeInTheDocument());
    expect(within(chip("Улюблені")).getByText("1")).toBeInTheDocument();
    expect(quickCountRequests().at(-1)?.searchParams.get("q")).toBe("мрія");
  });

  it("sends the genre filter to quick-counts", async () => {
    renderView("?genre=romance");

    await waitFor(() => expect(quickCountRequests()).not.toHaveLength(0));
    expect(quickCountRequests()[0]?.searchParams.get("genre")).toBe("romance");
  });

  it("never sends the selected quick filter, sort or paging to quick-counts", async () => {
    renderView("?sort=author_asc");
    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());

    for (const name of ["Улюблені", "Із прочитаних книг", "Із непрочитаних книг"]) {
      await userEvent.click(chip(name));
      await waitFor(() => expect(chip(name)).toHaveAttribute("data-state", "on"));
    }

    const requests = quickCountRequests();
    expect(requests.length).toBeGreaterThan(0);
    for (const url of requests) {
      for (const param of ["filter", "sort", "pageSize", "pageNumber"]) {
        expect(url.searchParams.has(param)).toBe(false);
      }
    }
  });
});
