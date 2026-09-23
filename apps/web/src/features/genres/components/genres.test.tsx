import "@testing-library/jest-dom/vitest";

import type { GenreFacetsView, GenreStatsView, Paginator } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeGenresOverview,
  makeGenreStats,
  makeGenreSummary,
  makeSummaryGenre,
} from "../model/genres.fixtures";
import { Genres } from "./genres";

const routerPush = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/genres",
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

type RecordedRequest = { path: string; searchParams: URLSearchParams };

type Replies = {
  facets?: Reply;
  overview?: Reply;
  stats?: Reply;
  summary?: Reply;
};

type Reply = (request: RecordedRequest) => Promise<Response>;

const PATHS = {
  facets: "/api/genres/facets",
  overview: "/api/genres/overview",
  stats: "/api/genres/stats",
  summary: "/api/genres/summary",
} as const;

const FANTASY = makeGenreStats({
  averageRating: 8.64,
  booksCount: 66,
  coverUrls: ["/c1.jpg", "/c2.jpg", "/c3.jpg", "/c4.jpg"],
  ratedBooksCount: 7,
  readCount: 18,
  readingQueueCount: 3,
});
const ROMANCE = makeGenreStats({ booksCount: 4, key: "romance", label: "Романтика", readCount: 4 });
const MYSTERY = makeGenreStats({ booksCount: 2, key: "mystery", label: "Детектив" });

const FACETS: GenreFacetsView = {
  groups: [
    { key: "fiction", label: "Художня література" },
    { key: "nonfiction", label: "Нехудожня література" },
  ],
  quickCounts: { all: 3, finished: 2, in_queue: 1, unread: 2, want_to_buy: 0 },
};

const OVERVIEW = makeGenresOverview({
  dormantGenres: [
    {
      booksCount: 12,
      key: "mystery",
      label: "Детектив",
      lastReadingActivityAt: "2026-02-01T10:00:00.000Z",
      readCount: 6,
    },
  ],
  unratedFinishedGenres: [
    {
      key: "romance",
      label: "Романтика",
      latestUnratedFinishedAt: "2026-09-01T10:00:00.000Z",
      unratedFinishedCount: 4,
    },
  ],
});

const SUMMARY_LABELS = [
  "Жанрів у бібліотеці",
  "Найчастіший жанр",
  "Найвище оцінюєте",
  "Найбільше прочитано",
  "Найбільше в черзі",
  "Найбільше хочете придбати",
] as const;

const requests: RecordedRequest[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
  routerPush.mockClear();
});

describe("Genres page", () => {
  it("renders the page heading, six summary cards and the genre grid", async () => {
    mockGenresApi();

    renderGenres();

    expect(screen.getByRole("heading", { level: 1, name: "Жанри" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Фентезі" })).toHaveAttribute(
      "href",
      "/books?genre=fantasy",
    );
    await waitFor(() => expect(summaryCards()).toHaveLength(6));
    expect(summaryCards().map(cardLabel)).toEqual(SUMMARY_LABELS);
    expect(screen.getByRole("button", { name: "Огляд жанрів" })).toBeInTheDocument();
  });

  it("shows six skeleton cards while the first page loads", () => {
    mockGenresApi({ stats: () => new Promise<Response>(() => undefined) });

    renderGenres();

    const loading = screen.getByRole("status", { name: "Завантажуємо жанри" });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading.querySelectorAll('[data-slot="genre-card-skeleton"]')).toHaveLength(6);
  });

  it("asks the backend for the first page of 24 genres in the default order", async () => {
    mockGenresApi();

    renderGenres();

    await screen.findByRole("link", { name: "Фентезі" });
    const params = lastRequest(PATHS.stats).searchParams;
    expect(params.get("pageNumber")).toBe("1");
    expect(params.get("pageSize")).toBe("24");
    expect(params.get("sort")).toBe("books_count_desc");
    expect(params.get("filter")).toBe("all");
    expect(params.has("q")).toBe(false);
  });
});

describe("Genres search", () => {
  it("commits a search only from two characters and keeps the other criteria", async () => {
    mockGenresApi();
    const url = trackUrl();

    renderGenres("?filter=unread&sort=name_asc", url.onUrlUpdate);
    const search = await screen.findByLabelText("Пошук жанру");

    await userEvent.type(search, "ф");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(requestsTo(PATHS.stats).some(({ searchParams }) => searchParams.has("q"))).toBe(false);

    await userEvent.type(search, "е");
    await waitFor(() => expect(lastUrl(url.events).get("q")).toBe("фе"));
    await waitFor(() => expect(lastRequest(PATHS.stats).searchParams.get("q")).toBe("фе"));
    expect(lastRequest(PATHS.stats).searchParams.get("filter")).toBe("unread");
    expect(lastRequest(PATHS.stats).searchParams.get("sort")).toBe("name_asc");
    expect(lastRequest(PATHS.facets).searchParams.get("q")).toBe("фе");
  });

  it("removes the search from the URL at once when cleared", async () => {
    mockGenresApi();
    const url = trackUrl();

    renderGenres("?q=фент", url.onUrlUpdate);

    await userEvent.click(await screen.findByRole("button", { name: "Очистити пошук" }));

    await waitFor(() => expect(lastUrl(url.events).has("q")).toBe(false));
  });
});

describe("Genres sort and filters", () => {
  it("sends the chosen quick filter to the list but not to the facets", async () => {
    mockGenresApi();
    const url = trackUrl();

    renderGenres("", url.onUrlUpdate);

    await userEvent.click(await screen.findByRole("radio", { name: /Є непрочитані/ }));

    await waitFor(() => expect(lastUrl(url.events).get("filter")).toBe("unread"));
    await waitFor(() => expect(lastRequest(PATHS.stats).searchParams.get("filter")).toBe("unread"));
    expect(requestsTo(PATHS.facets).every(({ searchParams }) => !searchParams.has("filter"))).toBe(
      true,
    );
  });

  it("shows the contextual quick-filter counts from the facets", async () => {
    mockGenresApi();

    renderGenres();

    expect(await screen.findByRole("radio", { name: "Є прочитані 2" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Є бажані 0" })).toBeInTheDocument();
  });

  it("applies group and books-count filters from the sheet in one step", async () => {
    mockGenresApi();
    const url = trackUrl();

    renderGenres("?sort=rating_desc", url.onUrlUpdate);

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const sheet = await screen.findByRole("dialog", { name: "Фільтри жанрів" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Художня література" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Нехудожня література" }));
    await userEvent.type(within(sheet).getByLabelText("Від"), "3");
    await userEvent.click(within(sheet).getByRole("button", { name: "Застосувати" }));

    await waitFor(() => expect(lastUrl(url.events).get("group")).toBe("fiction,nonfiction"));
    const params = await waitFor(() => {
      const last = lastRequest(PATHS.stats).searchParams;
      expect(last.getAll("group")).toEqual(["fiction", "nonfiction"]);
      return last;
    });
    expect(params.get("booksMin")).toBe("3");
    expect(params.get("sort")).toBe("rating_desc");
    expect(screen.getByRole("button", { name: "Фільтри (активних: 2)" })).toHaveTextContent("2");
  });

  it("groups the books range under its title with visible bounds", async () => {
    mockGenresApi();

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const sheet = await screen.findByRole("dialog", { name: "Фільтри жанрів" });
    const range = within(sheet).getByRole("group", { name: "Кількість книг" });
    expect(within(range).getByLabelText("Від")).toBeVisible();
    expect(within(range).getByLabelText("До")).toBeVisible();
  });

  it("formats the rating range for the locale", async () => {
    mockGenresApi();

    renderGenres("?ratingMin=6.5&ratingMax=9");

    await userEvent.click(await screen.findByRole("button", { name: /Фільтри/ }));
    const sheet = await screen.findByRole("dialog", { name: "Фільтри жанрів" });
    expect(within(sheet).getByText("6,5 – 9,0")).toBeInTheDocument();
  });

  it("refuses to apply a books range whose minimum exceeds the maximum", async () => {
    mockGenresApi();

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const sheet = await screen.findByRole("dialog", { name: "Фільтри жанрів" });
    await userEvent.type(within(sheet).getByLabelText("Від"), "9");
    await userEvent.type(within(sheet).getByLabelText("До"), "2");

    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      "Мінімум не може бути більшим за максимум",
    );
    expect(within(sheet).getByLabelText("Від")).toHaveAccessibleDescription(
      "Мінімум не може бути більшим за максимум",
    );
    expect(within(sheet).getByRole("button", { name: "Застосувати" })).toBeDisabled();
  });
});

describe("Genres list states", () => {
  it("appends the next page and moves focus to its first genre", async () => {
    mockGenresApi({
      stats: ({ searchParams }) =>
        json(
          searchParams.get("pageNumber") === "2"
            ? page([MYSTERY], { page: 2, pagesCount: 2, totalCount: 3 })
            : page([FANTASY, ROMANCE], { pagesCount: 2, totalCount: 3 }),
        ),
    });

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));

    const mystery = await screen.findByRole("link", { name: "Детектив" });
    await waitFor(() => expect(mystery).toHaveFocus());
    expect(screen.getByRole("link", { name: "Фентезі" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати ще" })).not.toBeInTheDocument();
  });

  it("keeps the current cards dimmed while new criteria load", async () => {
    mockGenresApi({
      stats: ({ searchParams }) =>
        searchParams.get("filter") === "unread"
          ? new Promise<Response>(() => undefined)
          : json(page([FANTASY, ROMANCE], { pagesCount: 2, totalCount: 3 })),
    });

    renderGenres();

    await userEvent.click(await screen.findByRole("radio", { name: /Є непрочитані/ }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Фентезі" }).closest("ul")).toHaveAttribute(
        "aria-busy",
        "true",
      ),
    );
    expect(screen.queryByRole("status", { name: "Завантажуємо жанри" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати ще" })).not.toBeInTheDocument();
  });

  it("keeps the loaded cards and offers an inline retry when the next page fails", async () => {
    mockGenresApi({
      stats: ({ searchParams }) =>
        searchParams.get("pageNumber") === "2"
          ? failure(500)()
          : json(page([FANTASY, ROMANCE], { pagesCount: 2, totalCount: 3 })),
    });

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));

    const alert = await screen.findByText("Не вдалося завантажити ще жанри.");
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "Фентезі" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Спробувати знову" })).toHaveFocus(),
    );
  });

  it("does not pull focus to a later list after a failed next page", async () => {
    mockGenresApi({
      stats: ({ searchParams }) => {
        if (searchParams.get("pageNumber") === "2") return failure(500)();
        if (searchParams.get("filter") === "unread") {
          return json(page([FANTASY, ROMANCE, MYSTERY], { totalCount: 3 }));
        }
        return json(page([FANTASY, ROMANCE], { pagesCount: 2, totalCount: 3 }));
      },
    });

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));
    await screen.findByText("Не вдалося завантажити ще жанри.");
    const quickFilter = screen.getByRole("radio", { name: /Є непрочитані/ });
    await userEvent.click(quickFilter);

    await screen.findByRole("link", { name: "Детектив" });
    expect(screen.getByRole("link", { name: "Детектив" })).not.toHaveFocus();
    expect(quickFilter).toHaveFocus();
  });

  it("forgets a pending next-page focus target when the list criteria change", async () => {
    mockGenresApi({
      stats: ({ searchParams }) => {
        if (searchParams.get("pageNumber") === "2") return new Promise<Response>(() => undefined);
        if (searchParams.get("filter") === "unread") {
          return json(page([FANTASY, ROMANCE, MYSTERY], { totalCount: 3 }));
        }
        return json(page([FANTASY, ROMANCE], { pagesCount: 2, totalCount: 3 }));
      },
    });

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));
    const quickFilter = screen.getByRole("radio", { name: /Є непрочитані/ });
    await userEvent.click(quickFilter);

    await screen.findByRole("link", { name: "Детектив" });
    expect(quickFilter).toHaveFocus();
  });

  it("announces how many genres are shown", async () => {
    mockGenresApi();

    renderGenres();

    await waitFor(() => expect(listAnnouncement()).toHaveTextContent("Показано 2 жанри"));
  });

  it("clears only the search when a search finds nothing", async () => {
    mockGenresApi({
      stats: ({ searchParams }) => json(page(searchParams.has("q") ? [] : [FANTASY])),
    });
    const url = trackUrl();

    renderGenres("?q=ццц&filter=finished&sort=name_asc", url.onUrlUpdate);

    expect(
      await screen.findByRole("heading", { name: "Жодного жанру за цим пошуком" }),
    ).toBeInTheDocument();
    expect(listAnnouncement()).toHaveTextContent("Жодного жанру за цим пошуком");
    await userEvent.click(emptyStateAction("Очистити пошук"));

    expect(screen.getByLabelText("Пошук жанру")).toHaveFocus();
    await waitFor(() => expect(lastUrl(url.events).has("q")).toBe(false));
    expect(lastUrl(url.events).get("filter")).toBe("finished");
    expect(lastUrl(url.events).get("sort")).toBe("name_asc");
  });

  it("resets quick and advanced filters but keeps the sort when filters find nothing", async () => {
    mockGenresApi({ stats: () => json(page([])) });
    const url = trackUrl();

    renderGenres("?filter=want_to_buy&group=fiction&sort=name_asc", url.onUrlUpdate);

    expect(
      await screen.findByRole("heading", { name: "Жодного жанру з такими умовами" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    expect(screen.getByRole("heading", { level: 2, name: "Список жанрів" })).toHaveFocus();
    await waitFor(() => expect(lastUrl(url.events).has("filter")).toBe(false));
    expect(lastUrl(url.events).has("group")).toBe(false);
    expect(lastUrl(url.events).get("sort")).toBe("name_asc");
  });

  it("hides the toolbar and sends the user to the Library when no book has a genre", async () => {
    mockGenresApi({ stats: () => json(page([])) });

    renderGenres();

    expect(
      await screen.findByRole("heading", { name: "У ваших книгах ще немає жанрів" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Пошук жанру")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Перейти до бібліотеки" }));
    expect(routerPush).toHaveBeenCalledWith("/books");
  });

  it("shows a retry in place of the list when the first page fails, keeping the insights", async () => {
    mockGenresApi({ stats: failure(500) });

    renderGenres();

    expect(await screen.findByRole("button", { name: "Спробувати ще раз" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити жанри");
    expect(screen.queryByLabelText("Пошук жанру")).not.toBeInTheDocument();
    expect(await screen.findByRole("complementary", { name: "Для вас" })).toBeInTheDocument();
  });
});

describe("Genres summary", () => {
  it("names the leading genres and the tie on the summary cards", async () => {
    const fantasy = makeSummaryGenre();
    const romance = makeSummaryGenre({ key: "romance", label: "Романтика" });
    mockGenresApi({
      summary: () =>
        json(
          makeGenreSummary({
            mostRead: { leaders: [fantasy, romance], leadersCount: 4 },
          }),
        ),
    });

    renderGenres();

    await waitFor(() => expect(summaryCards()).toHaveLength(6));
    expect(summaryCardText("Жанрів у бібліотеці")).toContain("у 124 книгах");
    expect(summaryCardText("Найчастіший жанр")).toContain("66 книг у цьому жанрі");
    expect(summaryCardText("Найвище оцінюєте")).toContain("Середня оцінка 8,9 · 7 оцінених книг");
    expect(summaryCardText("Найбільше прочитано")).toContain("Фентезі, Романтика");
    expect(summaryCardText("Найбільше прочитано")).toContain(
      "ще 2 жанри мають по 24 прочитані книги",
    );
    expect(summaryCardText("Найбільше в черзі")).toContain("12 із 66 книг жанру в черзі");
  });

  it("says the library is empty instead of inventing zeros for leaders", async () => {
    mockGenresApi({
      summary: () =>
        json(
          makeGenreSummary({
            booksWithGenresCount: 0,
            highestRated: null,
            libraryBooksCount: 0,
            mostFrequent: null,
            mostQueued: null,
            mostRead: null,
            mostWantedToBuy: null,
            usedGenresCount: 0,
          }),
        ),
    });

    renderGenres();

    await waitFor(() => expect(summaryCards()).toHaveLength(6));
    expect(summaryCardText("Найчастіший жанр")).toContain("—");
    expect(summaryCardText("Найчастіший жанр")).toContain("Бібліотека ще порожня");
  });

  it("hides the summary rather than showing zeros when it fails", async () => {
    mockGenresApi({ summary: failure(500) });

    renderGenres();

    await screen.findByRole("link", { name: "Фентезі" });
    await waitFor(() => expect(requestsTo(PATHS.summary)).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Огляд жанрів" })).not.toBeInTheDocument(),
    );
    expect(summaryCards()).toHaveLength(0);
  });
});

describe("Genres insights", () => {
  it("renders the available blocks in their fixed order in the sidebar", async () => {
    mockGenresApi();

    renderGenres();

    const sidebar = within(await screen.findByRole("complementary", { name: "Для вас" }));
    expect(
      sidebar.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Давно не повертались", "Є що оцінити"]);
    expect(sidebar.getByRole("link", { name: /Детектив/ })).toHaveAttribute(
      "href",
      "/books?genre=mystery",
    );
    const unrated = new URL(
      sidebar.getByRole("link", { name: /Романтика/ }).getAttribute("href") ?? "",
      "http://localhost",
    );
    expect(unrated.pathname).toBe("/books");
    expect(Object.fromEntries(unrated.searchParams)).toEqual({
      genre: "romance",
      hasRating: "false",
      status: "finished",
    });
    expect(sidebar.getByText("6 із 12 прочитано")).toBeInTheDocument();
    expect(sidebar.getByText("4 книги без оцінки")).toBeInTheDocument();
  });

  it("offers the phone trigger for the same insights", async () => {
    stubNarrowViewport();
    mockGenresApi();

    renderGenres();

    await userEvent.click(await screen.findByRole("button", { name: "Для вас" }));
    const panel = await screen.findByRole("dialog", { name: "Для вас" });
    expect(within(panel).getByRole("heading", { name: "Давно не повертались" })).toBeVisible();
    expect(requestsTo(PATHS.overview)).toHaveLength(1);
  });

  it("renders no insight surface when every block is empty", async () => {
    mockGenresApi({ overview: () => json(makeGenresOverview()) });

    renderGenres();

    await screen.findByRole("link", { name: "Фентезі" });
    await waitFor(() => expect(requestsTo(PATHS.overview)).toHaveLength(1));
    await waitFor(() =>
      expect(document.querySelector('[data-slot="genres-insights-placeholder"]')).toBeNull(),
    );
    expect(screen.queryByRole("complementary", { name: "Для вас" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Для вас" })).not.toBeInTheDocument();
  });

  it("hides the insights when the overview fails and keeps the list usable", async () => {
    mockGenresApi({ overview: failure(500) });

    renderGenres();

    expect(await screen.findByRole("link", { name: "Фентезі" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[data-slot="genres-insights-placeholder"]')).toBeNull(),
    );
    expect(screen.queryByRole("complementary", { name: "Для вас" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Пошук жанру")).toBeInTheDocument();
  });

  it("does not ask for the insights again when the list criteria change", async () => {
    mockGenresApi();

    renderGenres();

    await userEvent.click(await screen.findByRole("radio", { name: /Є в черзі/ }));
    await waitFor(() =>
      expect(lastRequest(PATHS.stats).searchParams.get("filter")).toBe("in_queue"),
    );
    expect(requestsTo(PATHS.overview)).toHaveLength(1);
    expect(requestsTo(PATHS.summary)).toHaveLength(1);
  });
});

function cardLabel(card: HTMLElement): string {
  return SUMMARY_LABELS.find((label) => within(card).queryByText(label) !== null) ?? "";
}

function emptyStateAction(name: string): HTMLElement {
  const action = screen
    .getAllByRole("button", { name })
    .find((button) => button.textContent?.includes(name) === true);
  if (action === undefined) throw new Error(`no empty-state action named ${name}`);
  return action;
}

function failure(status: number): () => Promise<Response> {
  return () => Promise.resolve(new Response("{}", { status }));
}

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function lastRequest(path: string): RecordedRequest {
  const request = requestsTo(path).at(-1);
  if (request === undefined) throw new Error(`no request to ${path}`);
  return request;
}

function lastUrl(events: UrlUpdateEvent[]): URLSearchParams {
  return events.at(-1)?.searchParams ?? new URLSearchParams();
}

function listAnnouncement(): HTMLElement {
  const region = screen
    .getAllByRole("status")
    .find((element) => element.getAttribute("aria-atomic") === "true");
  if (region === undefined) throw new Error("no list announcement region");
  return region;
}

function mockGenresApi(replies: Replies = {}) {
  const {
    facets = () => json(FACETS),
    overview = () => json(OVERVIEW),
    stats = () => json(page([FANTASY, ROMANCE])),
    summary = () => json(makeGenreSummary()),
  } = replies;
  const handlers: Record<string, Reply> = {
    [PATHS.facets]: facets,
    [PATHS.overview]: overview,
    [PATHS.stats]: stats,
    [PATHS.summary]: summary,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      const request = { path: url.pathname, searchParams: url.searchParams };
      requests.push(request);
      const handler = handlers[url.pathname];
      return handler === undefined ? failure(404)() : handler(request);
    }),
  );
}

function page(
  items: GenreStatsView[],
  overrides: Partial<Paginator<GenreStatsView>> = {},
): Paginator<GenreStatsView> {
  return {
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 24,
    totalCount: items.length,
    ...overrides,
  };
}

function renderGenres(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <Genres />
    </NuqsTestingAdapter>,
  );
}

function requestsTo(path: string): RecordedRequest[] {
  return requests.filter((request) => request.path === path);
}

function stubNarrowViewport() {
  vi.stubGlobal("matchMedia", (media: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media,
    removeEventListener: vi.fn(),
  }));
}

function summaryCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
}

function summaryCardText(label: string): string {
  const card = summaryCards().find((element) => cardLabel(element) === label);
  if (card === undefined) throw new Error(`no summary card labelled ${label}`);
  return card.textContent ?? "";
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}
