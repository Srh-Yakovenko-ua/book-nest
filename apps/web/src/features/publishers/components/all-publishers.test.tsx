import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherListItem, LibraryPublishersQuickCounts } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
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

import {
  makePublisherListItem,
  makePublishersPage,
  makePublishersSummary,
} from "../model/publisher.fixtures";
import { AllPublishers } from "./all-publishers";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers",
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const fetchMock = vi.fn();

const viewport = mockIntersectionObserver();

let respondToList: (params: URLSearchParams) => Response;
let respondToQuickCounts: (params: URLSearchParams) => Promise<Response>;
let respondToSummary: () => Response;

const QUICK_COUNTS_PATH = "/api/publishers/library/quick-counts";

function chip(name: string): HTMLElement {
  const match = screen
    .getAllByRole("radio")
    .find((radio) => radio.firstChild?.textContent === name);
  if (match === undefined) throw new Error(`No quick filter chip ${name}`);
  return match;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function listRequests(): URL[] {
  return requestsTo("/api/publishers/library");
}

function publishers(count: number, prefix = "publisher"): LibraryPublisherListItem[] {
  return Array.from({ length: count }, (_, index) =>
    makePublisherListItem({ id: `${prefix}-${index}`, name: `${prefix} ${index}` }),
  );
}

function quickCounts(
  overrides: Partial<LibraryPublishersQuickCounts> = {},
): LibraryPublishersQuickCounts {
  return { all: 9, read: 4, reading: 2, series: 3, to_buy: 0, ...overrides };
}

function renderList(search = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <AllPublishers />
    </NuqsTestingAdapter>,
  );
}

function requestsTo(path: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === path);
}

function statCard(label: string): HTMLElement {
  for (const element of screen.getAllByText(label)) {
    const card = element.closest('[data-slot="stat-card"]');
    if (card instanceof HTMLElement) return card;
  }
  throw new Error(`Stat card not found: ${label}`);
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, lastParams: () => events.at(-1)?.searchParams, onUrlUpdate };
}

function visibleButton(text: string): HTMLElement {
  const match = screen
    .getAllByRole("button", { name: text })
    .find((button) => button.textContent?.includes(text));
  if (match === undefined) throw new Error(`Button with visible text not found: ${text}`);
  return match;
}

beforeEach(() => {
  respondToList = () => jsonResponse(makePublishersPage([makePublisherListItem()]));
  respondToQuickCounts = () => Promise.resolve(jsonResponse(quickCounts()));
  respondToSummary = () => jsonResponse(makePublishersSummary());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/publishers/library/summary") {
      return Promise.resolve(respondToSummary());
    }
    if (url.pathname === QUICK_COUNTS_PATH) return respondToQuickCounts(url.searchParams);
    if (url.pathname === "/api/publishers/library") {
      return Promise.resolve(respondToList(url.searchParams));
    }
    return Promise.reject(new Error(`unexpected ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AllPublishers header and summary", () => {
  it("offers only the add-book action in the header", async () => {
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: "Додати книгу" }));

    expect(pushMock).toHaveBeenCalledWith("/books/new");
    expect(screen.queryByText("Додати видавництво")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Переглядай видавництва своєї бібліотеки, їхні книги, рейтинги та список бажань",
      ),
    ).toBeInTheDocument();
  });

  it("renders the four whole-library cards from the localized summary", async () => {
    respondToSummary = () =>
      jsonResponse(
        makePublishersSummary({
          booksToBuyWithPublisherCount: 7,
          mostReadPublisher: { id: "ranok", name: "Ранок", readCount: 21 },
          mostRepresentedPublisher: { booksCount: 48, id: "vivat", name: "Vivat" },
          publishersCount: 12,
          publishersInPlansCount: 3,
          topFiveBooksCoveragePercent: 0.4,
        }),
      );

    renderList();

    await screen.findByText("Топ-5 охоплюють <1% книг");
    expect(statCard("Видавництв")).toHaveTextContent("12");
    expect(statCard("Найбільше в бібліотеці")).toHaveTextContent("Vivat");
    expect(statCard("Найбільше в бібліотеці")).toHaveTextContent("48 книг у бібліотеці");
    expect(statCard("Видавництва у планах")).toHaveTextContent("7 книг у списку бажань");
    expect(statCard("Найбільше прочитано")).toHaveTextContent("21 прочитана книга");
    expect(requestsTo("/api/publishers/library/summary")[0]?.searchParams.get("locale")).toBe("uk");
  });

  it("shows the empty fallbacks when nothing is represented", async () => {
    respondToSummary = () =>
      jsonResponse(
        makePublishersSummary({
          mostReadPublisher: null,
          mostRepresentedPublisher: null,
          publishersCount: 3,
          publishersInPlansCount: 0,
        }),
      );

    renderList();

    await screen.findByText("Усі 3 охоплюють 100% книг");
    expect(statCard("Найбільше в бібліотеці")).toHaveTextContent("—");
    expect(statCard("Видавництва у планах")).toHaveTextContent(
      "Немає книг у списку бажань із видавництвом",
    );
    expect(statCard("Найбільше прочитано")).toHaveTextContent("Ще немає прочитаних книг");
  });

  it("does not refetch the summary when the archive query changes", async () => {
    const url = trackUrl();
    renderList("", url.onUrlUpdate);

    await userEvent.click(await screen.findByText("Є серії"));

    await waitFor(() => expect(listRequests()).toHaveLength(2));
    expect(requestsTo("/api/publishers/library/summary")).toHaveLength(1);
  });
});

describe("AllPublishers quick filter counts", () => {
  it("shows the quick-counts numbers on every chip and keeps the summary cards", async () => {
    respondToSummary = () => jsonResponse(makePublishersSummary({ publishersCount: 12 }));

    renderList();

    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());
    expect(within(chip("Читаю зараз")).getByText("2")).toBeInTheDocument();
    expect(within(chip("Є прочитані книги")).getByText("4")).toBeInTheDocument();
    expect(within(chip("Є серії")).getByText("3")).toBeInTheDocument();
    expect(statCard("Видавництв")).toHaveTextContent("12");
    expect(requestsTo("/api/publishers/library/summary")).toHaveLength(1);
  });

  it("keeps a zero chip enabled and selectable", async () => {
    const url = trackUrl();
    renderList("", url.onUrlUpdate);

    const toBuy = await waitFor(() => {
      const found = chip("Є книги у списку бажань");
      expect(within(found).getByText("0")).toBeInTheDocument();
      return found;
    });
    expect(toBuy).toBeEnabled();

    await userEvent.click(toBuy);

    await waitFor(() => expect(url.lastParams()?.get("filter")).toBe("to_buy"));
  });

  it("renders chips without numbers until the first counts arrive", async () => {
    respondToQuickCounts = () => new Promise<Response>(() => undefined);

    renderList();

    await screen.findByRole("link", { name: "Vivat" });
    await waitFor(() => expect(requestsTo(QUICK_COUNTS_PATH)).toHaveLength(1));
    expect(chip("Усі")).toHaveTextContent(/^Усі$/);
    expect(chip("Читаю зараз")).toHaveTextContent(/^Читаю зараз$/);
  });

  it("sends the search to quick-counts and shows the counts it returns", async () => {
    respondToQuickCounts = (params) =>
      Promise.resolve(
        jsonResponse(
          params.get("search") === "віват" ? quickCounts({ all: 1, reading: 0 }) : quickCounts(),
        ),
      );

    renderList();
    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук видавництв" }), "віват");

    await waitFor(() => expect(within(chip("Усі")).getByText("1")).toBeInTheDocument());
    expect(within(chip("Читаю зараз")).getByText("0")).toBeInTheDocument();
    expect(requestsTo(QUICK_COUNTS_PATH).at(-1)?.searchParams.get("search")).toBe("віват");
  });

  it("keeps the previous numbers on screen while the next counts load", async () => {
    let releaseSearchCounts: () => void = () => undefined;
    respondToQuickCounts = (params) => {
      if (params.get("search") === null) return Promise.resolve(jsonResponse(quickCounts()));
      return new Promise<Response>((resolve) => {
        releaseSearchCounts = () => resolve(jsonResponse(quickCounts({ all: 1 })));
      });
    };

    renderList();
    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук видавництв" }), "vi");
    await waitFor(() =>
      expect(requestsTo(QUICK_COUNTS_PATH).at(-1)?.searchParams.get("search")).toBe("vi"),
    );
    expect(within(chip("Усі")).getByText("9")).toBeInTheDocument();

    releaseSearchCounts();

    await waitFor(() => expect(within(chip("Усі")).getByText("1")).toBeInTheDocument());
  });

  it("sends the geography, source and boolean filters from the URL", async () => {
    renderList("?geography=foreign&source=custom&hasQueue=true&sort=name_asc");

    await waitFor(() => expect(requestsTo(QUICK_COUNTS_PATH)).toHaveLength(1));
    const params = requestsTo(QUICK_COUNTS_PATH)[0]?.searchParams;
    expect(params?.get("geography")).toBe("foreign");
    expect(params?.get("source")).toBe("custom");
    expect(params?.get("hasQueue")).toBe("true");
    for (const key of ["filter", "sort", "order", "locale", "pageSize", "pageNumber"]) {
      expect(params?.has(key)).toBe(false);
    }
  });

  it("sends an applied advanced filter to quick-counts", async () => {
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    await userEvent.click(await screen.findByText("Українські"));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати" }));

    await waitFor(() =>
      expect(requestsTo(QUICK_COUNTS_PATH).at(-1)?.searchParams.get("geography")).toBe("ua"),
    );
  });

  it("does not send the selected quick filter or refetch counts when a chip changes", async () => {
    renderList("?filter=read");
    await waitFor(() => expect(within(chip("Усі")).getByText("9")).toBeInTheDocument());

    for (const name of ["Читаю зараз", "Є серії", "Є книги у списку бажань"]) {
      await userEvent.click(chip(name));
      await waitFor(() => expect(chip(name)).toHaveAttribute("data-state", "on"));
    }

    await waitFor(() => expect(listRequests().at(-1)?.searchParams.get("filter")).toBe("to_buy"));
    const requests = requestsTo(QUICK_COUNTS_PATH);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.has("filter")).toBe(false);
  });
});

describe("AllPublishers results", () => {
  it("renders cards with the default query mapped for the server", async () => {
    respondToList = () =>
      jsonResponse(
        makePublishersPage([
          makePublisherListItem({ id: "vivat", name: "Vivat" }),
          makePublisherListItem({ id: "ranok", name: "Ранок" }),
        ]),
      );

    renderList("?view=list&sort=name_asc");

    expect(await screen.findByRole("link", { name: "Vivat" })).toBeInTheDocument();
    const params = listRequests()[0]?.searchParams;
    expect(params?.get("sort")).toBe("name");
    expect(params?.get("order")).toBe("asc");
    expect(params?.get("locale")).toBe("uk");
    expect(params?.get("pageNumber")).toBe("1");
    expect(params?.get("pageSize")).toBe("24");
    expect(params?.has("view")).toBe(false);
  });

  it("renders the list rows when the list view is selected", async () => {
    renderList("?view=list");

    const results = await screen.findByRole("list", { name: "Список видавництв" });
    expect(within(results).getByText("Список бажань")).toBeInTheDocument();
    expect(within(results).queryByText("у бібліотеці")).not.toBeInTheDocument();
  });

  it("counts shown against the server total", async () => {
    respondToList = () =>
      jsonResponse(makePublishersPage(publishers(2), { pagesCount: 2, totalCount: 30 }));

    renderList();

    expect(await screen.findByText("Показано 2 із 30 видавництв")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("appends the next page when the list end scrolls into view and dedupes by id", async () => {
    const firstPage = publishers(2);
    respondToList = (params) =>
      params.get("pageNumber") === "2"
        ? jsonResponse(
            makePublishersPage([...publishers(2).slice(1), ...publishers(1, "next")], {
              page: 2,
              pagesCount: 2,
              totalCount: 3,
            }),
          )
        : jsonResponse(makePublishersPage(firstPage, { pagesCount: 2, totalCount: 3 }));

    renderList();

    await screen.findByRole("link", { name: "publisher 0" });
    viewport.enterViewport();

    expect(await screen.findByRole("link", { name: "next 0" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "publisher 1" })).toHaveLength(1);
    expect(screen.getByText("Показано 3 із 3 видавництв")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    viewport.enterViewport();

    expect(listRequests().map((url) => url.searchParams.get("pageNumber"))).toEqual(["1", "2"]);
  });

  it("keeps loaded cards when the next page fails and retries only that page", async () => {
    let failNextPage = true;
    respondToList = (params) => {
      if (params.get("pageNumber") !== "2") {
        return jsonResponse(makePublishersPage(publishers(2), { pagesCount: 2, totalCount: 3 }));
      }
      if (failNextPage) return jsonResponse({ message: "boom" }, 500);
      return jsonResponse(
        makePublishersPage(publishers(1, "next"), { page: 2, pagesCount: 2, totalCount: 3 }),
      );
    };

    renderList();

    await screen.findByRole("link", { name: "publisher 0" });
    viewport.enterViewport();

    expect(await screen.findByText("Не вдалося завантажити ще видавництва")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "publisher 0" })).toBeInTheDocument();
    expect(screen.getByText("Показано 2 із 3 видавництв")).toBeInTheDocument();

    failNextPage = false;
    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(await screen.findByRole("link", { name: "next 0" })).toBeInTheDocument();
    expect(listRequests().map((url) => url.searchParams.get("pageNumber"))).toEqual([
      "1",
      "2",
      "2",
    ]);
  });
});

describe("AllPublishers load more focus", () => {
  it("ignores repeat viewport entries while fetching and moves focus to the first appended card on the last page", async () => {
    let releaseNextPage: () => void = () => undefined;
    respondToList = (params) =>
      jsonResponse(
        params.get("pageNumber") === "2"
          ? makePublishersPage(publishers(1, "next"), { page: 2, pagesCount: 2, totalCount: 3 })
          : makePublishersPage(publishers(2), { pagesCount: 2, totalCount: 3 }),
      );
    const respondImmediately = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.searchParams.get("pageNumber") !== "2") return respondImmediately?.(input);
      return new Promise<Response>((resolve) => {
        releaseNextPage = () => resolve(respondToList(url.searchParams));
      });
    });

    renderList();

    await screen.findByRole("link", { name: "publisher 0" });
    viewport.enterViewport();

    expect(await screen.findByText("Завантажуємо ще...")).toBeInTheDocument();
    viewport.enterViewport();
    viewport.enterViewport();
    expect(listRequests().filter((url) => url.searchParams.get("pageNumber") === "2")).toHaveLength(
      1,
    );

    releaseNextPage();

    await waitFor(() => expect(screen.getByRole("link", { name: "next 0" })).toHaveFocus());
  });

  it("moves focus to the retry button when the next page fails", async () => {
    respondToList = (params) =>
      params.get("pageNumber") === "2"
        ? jsonResponse({ message: "boom" }, 500)
        : jsonResponse(makePublishersPage(publishers(2), { pagesCount: 2, totalCount: 3 }));

    renderList();

    await screen.findByRole("link", { name: "publisher 0" });
    viewport.enterViewport();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Спробувати ще раз" })).toHaveFocus(),
    );
  });
});

describe("AllPublishers controls", () => {
  it("writes the search to q", async () => {
    const url = trackUrl();
    renderList("", url.onUrlUpdate);

    await userEvent.type(await screen.findByRole("textbox", { name: "Пошук видавництв" }), "видав");

    await waitFor(() => expect(url.lastParams()?.get("q")).toBe("видав"));
    expect(url.lastParams()?.has("search")).toBe(false);
  });

  it("writes a semantic sort without an order key", async () => {
    const url = trackUrl();
    renderList("", url.onUrlUpdate);

    await userEvent.click(await screen.findByRole("combobox", { name: "Сортування" }));
    await userEvent.click(await screen.findByRole("option", { name: "Назва: Я–А" }));

    await waitFor(() => expect(url.lastParams()?.get("sort")).toBe("name_desc"));
    expect(url.lastParams()?.has("order")).toBe(false);
  });

  it("applies a quick filter without adding a removable chip", async () => {
    const url = trackUrl();
    renderList("", url.onUrlUpdate);

    await userEvent.click(await screen.findByText("Читаю зараз"));

    await waitFor(() => expect(url.lastParams()?.get("filter")).toBe("reading"));
    await waitFor(() => expect(listRequests().at(-1)?.searchParams.get("filter")).toBe("reading"));
    expect(screen.queryByRole("group", { name: "Активні фільтри" })).not.toBeInTheDocument();
  });

  it("keeps Advanced edits local until they are applied", async () => {
    const url = trackUrl();
    renderList("", url.onUrlUpdate);

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    await userEvent.click(await screen.findByText("Українські"));
    await userEvent.click(screen.getByText("Є книги в черзі"));

    expect(url.events).toHaveLength(0);
    expect(listRequests()).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Застосувати" }));

    await waitFor(() => expect(url.lastParams()?.get("geography")).toBe("ua"));
    expect(url.lastParams()?.get("hasQueue")).toBe("true");
    expect(await screen.findByRole("button", { name: /^Фільтри\s*2$/ })).toBeInTheDocument();
  });

  it("shows chips for q and Advanced, removes one at a time and clears all", async () => {
    const url = trackUrl();
    renderList(
      "?q=vi&geography=foreign&hasRatedBooks=true&filter=read&sort=name_asc",
      url.onUrlUpdate,
    );

    const chips = await screen.findByRole("group", { name: "Активні фільтри" });
    expect(within(chips).getByText("Пошук: vi")).toBeInTheDocument();
    expect(within(chips).getByText("Географія: Іноземні")).toBeInTheDocument();
    expect(within(chips).getByText("Є оцінені книги")).toBeInTheDocument();

    await userEvent.click(
      within(chips).getByRole("button", { name: "Прибрати фільтр Географія: Іноземні" }),
    );
    await waitFor(() => expect(url.lastParams()?.has("geography")).toBe(false));
    expect(url.lastParams()?.get("q")).toBe("vi");

    await userEvent.click(within(chips).getByRole("button", { name: "Очистити все" }));
    await waitFor(() => expect(url.lastParams()?.has("q")).toBe(false));
    expect(url.lastParams()?.has("filter")).toBe(false);
    expect(url.lastParams()?.has("hasRatedBooks")).toBe(false);
    expect(url.lastParams()?.get("sort")).toBe("name_asc");
  });
});

describe("AllPublishers states", () => {
  it("announces a failed first load and retries the list only", async () => {
    respondToList = () => jsonResponse({ message: "boom" }, 500);

    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не вдалося завантажити видавництва");
    respondToList = () => jsonResponse(makePublishersPage([makePublisherListItem()]));
    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    expect(await screen.findByRole("link", { name: "Vivat" })).toBeInTheDocument();
    expect(requestsTo("/api/publishers/library/summary")).toHaveLength(1);
  });

  it("shows the true empty state without insights when the library has no publishers", async () => {
    respondToList = () => jsonResponse(makePublishersPage([]));
    respondToSummary = () =>
      jsonResponse(makePublishersSummary({ booksWithoutPublisherCount: 4, publishersCount: 0 }));

    renderList();

    expect(await screen.findByText("Видавництв поки немає")).toBeInTheDocument();
    expect(screen.queryByText("Потребують уваги")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Показано/)).not.toBeInTheDocument();
  });

  it("offers to clear only the search on a search-only zero", async () => {
    const url = trackUrl();
    respondToList = () => jsonResponse(makePublishersPage([]));

    renderList("?q=невідоме&sort=name_asc", url.onUrlUpdate);

    expect(await screen.findByText("Видавництв не знайдено")).toBeInTheDocument();
    expect(screen.getByText("За цим запитом видавництв не знайдено")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    await userEvent.click(visibleButton("Очистити пошук"));

    await waitFor(() => expect(url.lastParams()?.has("q")).toBe(false));
    expect(url.lastParams()?.get("sort")).toBe("name_asc");
  });

  it("resets filters but keeps q on a filtered zero, and keeps insights visible", async () => {
    const url = trackUrl();
    respondToList = () => jsonResponse(makePublishersPage([]));
    respondToSummary = () => jsonResponse(makePublishersSummary({ booksWithoutPublisherCount: 2 }));

    renderList("?q=vi&filter=series&hasQueue=true", url.onUrlUpdate);

    expect(await screen.findByText("Немає видавництв за цими умовами")).toBeInTheDocument();
    expect(screen.getByText("Жодне видавництво не відповідає цим умовам")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByText("Потребують уваги")).toBeInTheDocument();
    expect(screen.queryByText(/^Показано/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    await waitFor(() => expect(url.lastParams()?.has("filter")).toBe(false));
    expect(url.lastParams()?.has("hasQueue")).toBe(false);
    expect(url.lastParams()?.get("q")).toBe("vi");
  });

  it("keeps a healthy list when the summary fails", async () => {
    respondToSummary = () => jsonResponse({ message: "boom" }, 500);

    renderList();

    expect(await screen.findByRole("link", { name: "Vivat" })).toBeInTheDocument();
    expect(await screen.findByText("Не вдалося завантажити зведення")).toBeInTheDocument();
  });
});

describe("AllPublishers insights", () => {
  it("links books without a publisher to the Books deep link", async () => {
    respondToSummary = () => jsonResponse(makePublishersSummary({ booksWithoutPublisherCount: 3 }));

    renderList();

    const sidebar = await screen.findByRole("complementary", { name: "Інсайти видавництв" });
    expect(within(sidebar).getByText("3 книги без видавництва")).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Переглянути книги" })).toHaveAttribute(
      "href",
      "/books?publisherPresence=missing",
    );
  });

  it("orders the blocks and links unread and best-rated rows to the publisher", async () => {
    respondToSummary = () =>
      jsonResponse(
        makePublishersSummary({
          bestRatedPublishers: [
            { averageRating: 4.8, id: "a-ba-ba", name: "А-ба-ба-га-ла-ма-га", ratedBooksCount: 5 },
          ],
          booksWithoutPublisherCount: 1,
          unreadPublishers: [{ id: "ranok", name: "Ранок", unreadCount: 6 }],
        }),
      );

    renderList();

    const sidebar = await screen.findByRole("complementary", { name: "Інсайти видавництв" });
    expect(
      within(sidebar)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(["Потребують уваги", "Ще не прочитано", "Найкраще оцінено"]);
    expect(within(sidebar).getByRole("link", { name: /Ранок/ })).toHaveAttribute(
      "href",
      "/publishers/ranok",
    );
    expect(within(sidebar).getByText("6 книг")).toBeInTheDocument();
    expect(within(sidebar).queryByText(/залишилось/)).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /А-ба-ба-га-ла-ма-га/ })).toHaveAttribute(
      "href",
      "/publishers/a-ba-ba",
    );
    const bestRated = within(sidebar).getByRole("link", { name: /А-ба-ба-га-ла-ма-га/ });
    expect(within(bestRated).getByText("4,8")).toBeInTheDocument();
    expect(within(bestRated).getByText("5 оцінок")).toBeInTheDocument();
  });

  it("renders no sidebar when no insight is eligible", async () => {
    renderList();

    await screen.findByRole("link", { name: "Vivat" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
