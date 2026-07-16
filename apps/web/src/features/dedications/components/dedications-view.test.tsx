import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

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

let respondToList: () => Response;
let respondToSummary: () => Response;
let respondToUpdate: () => Response;

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
    .filter((url) => url.includes("/api/books/dedications") && !url.includes("/summary"));
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

function renderView(search = "") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <DedicationsView />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  respondToList = () => pageResponse({ items: [makeDedicationBook()] });
  respondToSummary = () => jsonResponse(makeDedicationsSummary());
  respondToUpdate = () => jsonResponse(makeDedicationBook());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH") return Promise.resolve(respondToUpdate());
    if (url.includes("/api/books/dedications/summary")) return Promise.resolve(respondToSummary());
    if (url.includes("/api/books/dedications")) return Promise.resolve(respondToList());
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

    expect(await screen.findByText("У вас ще немає присвят")).toBeInTheDocument();
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

    expect(await screen.findByText("Статистика")).toBeInTheDocument();
    expect(await screen.findByText("Усього присвят")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("falls back to a dash when the summary has no top author or genre", async () => {
    respondToSummary = () =>
      jsonResponse(makeDedicationsSummary({ topAuthor: null, topGenre: null }));
    renderView();

    await screen.findByText("Найчастіший жанр");
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("hides the pagination while a single page covers the results", async () => {
    renderView();

    await screen.findByText("Останнє бажання");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the pagination once the server reports several pages", async () => {
    respondToList = () =>
      pageResponse({ items: [makeDedicationBook()], pagesCount: 3, totalCount: 30 });
    renderView();

    expect(await screen.findByRole("navigation", { name: "Сторінки присвят" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сторінка 3" })).toBeInTheDocument();
  });

  it("marks the page from the url as current even while a previous page payload is shown", async () => {
    respondToList = () =>
      pageResponse({ items: [makeDedicationBook()], page: 1, pagesCount: 3, totalCount: 30 });
    renderView("?page=2");

    const nav = await screen.findByRole("navigation", { name: "Сторінки присвят" });
    expect(within(nav).getByRole("link", { name: "Сторінка 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Сторінка 1" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("offers a retry instead of an endless skeleton when the summary request fails", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    renderView();

    expect(
      await screen.findByText("Не вдалося завантажити статистику присвят."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Спробувати ще раз/ })).toBeInTheDocument();
    expect(await screen.findByText("Останнє бажання")).toBeInTheDocument();
  });

  it("refetches the summary when the stats retry is used", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    renderView();

    await screen.findByText("Не вдалося завантажити статистику присвят.");
    respondToSummary = () => jsonResponse(makeDedicationsSummary({ totalCount: 24 }));

    await userEvent.click(screen.getByRole("button", { name: /Спробувати ще раз/ }));

    expect(await screen.findByText("Усього присвят")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("still separates no-results from empty when the summary request fails", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    respondToList = () => pageResponse({ items: [], totalCount: 0 });
    renderView("?filter=favorites");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.queryByText("У вас ще немає присвят")).not.toBeInTheDocument();
  });

  it("still shows the empty state when the summary fails and no filter is active", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);
    respondToList = () => pageResponse({ items: [], totalCount: 0 });
    renderView();

    expect(await screen.findByText("У вас ще немає присвят")).toBeInTheDocument();
    expect(screen.queryByText("Нічого не знайдено")).not.toBeInTheDocument();
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
    expect(within(dialog).getByRole("button", { name: "Улюблена" })).toHaveAttribute(
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

    await userEvent.click(within(dialog).getByRole("button", { name: "Улюблена" }));

    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("Останнє бажання")).toBeInTheDocument();
  });
});
