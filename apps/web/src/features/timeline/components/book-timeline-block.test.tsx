import "@testing-library/jest-dom/vitest";

import type { BookView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "../../books/components/book-details.fixtures";
import {
  makeEventsPage,
  makeReadingPosition,
  makeTimelineEventView,
  makeTimelineListView,
  makeTimelineOverview,
  makeTimelineSummary,
  makeTimelineView,
} from "../model/timeline.fixtures";
import { BookTimelineBlock } from "./book-timeline-block";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let timelinesResponder: () => Response;
let summaryResponder: () => Response;
let overviewResponder: () => Response;
let eventsResponder: (params: URLSearchParams) => Response;
let mutationResponder: (url: string, method: string) => Response;

function eventsCalls() {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).includes("/timeline-events") && (init?.method ?? "GET").toUpperCase() === "GET",
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastEventsParams(): URLSearchParams {
  const last = eventsCalls().at(-1);
  if (last === undefined) throw new Error("no events request captured");
  return new URL(String(last[0]), "http://localhost").searchParams;
}

function renderBlock(
  search = "",
  onUrlUpdate?: OnUrlUpdateFunction,
  book: BookView = makeBookView({ id: "book-1", pagesCount: 320 }),
) {
  return renderWithProviders(
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} searchParams={search}>
      <BookTimelineBlock book={book} />
    </NuqsTestingAdapter>,
  );
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

beforeEach(() => {
  window.localStorage.clear();
  timelinesResponder = () => jsonResponse(makeTimelineListView());
  summaryResponder = () => jsonResponse(makeTimelineSummary());
  overviewResponder = () => jsonResponse(makeTimelineOverview());
  eventsResponder = () => jsonResponse(makeEventsPage([makeTimelineEventView()]));
  mutationResponder = () => jsonResponse(makeTimelineView());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET") return Promise.resolve(mutationResponder(url, method));
    if (url.includes("/timeline/summary")) return Promise.resolve(summaryResponder());
    if (url.includes("/timeline/overview")) return Promise.resolve(overviewResponder());
    if (url.includes("/timeline-events")) {
      return Promise.resolve(eventsResponder(new URL(url, "http://localhost").searchParams));
    }
    if (url.includes("/timelines")) return Promise.resolve(timelinesResponder());
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookTimelineBlock", () => {
  it("renders the timeline heading with the total event count", async () => {
    summaryResponder = () => jsonResponse(makeTimelineSummary({ totalEvents: 5 }));

    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Хронологія подій"),
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("5");
  });

  it("keeps the all-lines chip next to a single line", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    expect(screen.getByRole("radio", { name: /Усі лінії/ })).toBeInTheDocument();
    expect(screen.getAllByText("Основна лінія").length).toBeGreaterThan(0);
  });

  it("shows the all-lines switcher across multiple lines", async () => {
    timelinesResponder = () =>
      jsonResponse(
        makeTimelineListView({
          timelines: [
            makeTimelineView({ eventsCount: 5, id: "line-1", name: "Лінія А" }),
            makeTimelineView({ eventsCount: 3, id: "line-2", isDefault: false, name: "Лінія Б" }),
          ],
        }),
      );
    summaryResponder = () => jsonResponse(makeTimelineSummary({ totalEvents: 8 }));

    renderBlock();

    const allLines = await screen.findByRole("radio", { name: /Усі лінії/ });
    expect(allLines).toBeChecked();
    expect(screen.getByRole("radio", { name: /Лінія А/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Лінія Б/ })).toBeInTheDocument();
  });

  it("requests events without a timeline id while in all-lines mode", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    expect(lastEventsParams().has("timelineId")).toBe(false);
  });

  it("filters events to a line when its chip is selected", async () => {
    timelinesResponder = () =>
      jsonResponse(
        makeTimelineListView({
          timelines: [
            makeTimelineView({ id: "line-1", name: "Лінія А" }),
            makeTimelineView({ id: "line-2", isDefault: false, name: "Лінія Б" }),
          ],
        }),
      );
    const { events, onUrlUpdate } = trackUrl();

    renderBlock("", onUrlUpdate);

    await userEvent.click(await screen.findByRole("radio", { name: /Лінія Б/ }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("timelineId")).toBe("line-2"));
  });

  it("switches from the stream to the list view", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await userEvent.click(screen.getByRole("radio", { name: "Список" }));

    expect(screen.getByRole("radio", { name: "Список" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Стрічка" })).not.toBeChecked();
  });

  it("hides the line navigation in the overview and keeps the view switch", async () => {
    renderBlock("?view=overview");

    expect(await screen.findByRole("radio", { name: "Огляд" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Усі лінії/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Керувати лініями" })).not.toBeInTheDocument();
  });

  it("shows a skeleton while the timeline is loading", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    renderBlock();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error with a retry that recovers", async () => {
    let call = 0;
    timelinesResponder = () =>
      call++ === 0 ? jsonResponse({ message: "boom" }, 500) : jsonResponse(makeTimelineListView());

    renderBlock();

    const alert = await screen.findByText(
      "Не вдалося завантажити хронологію. Перевір з’єднання та спробуй ще раз.",
    );
    expect(alert).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Повторити" }));

    expect(
      await screen.findByRole("button", { name: "Геральт прибуває до Визими" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when a book has no events", async () => {
    summaryResponder = () => jsonResponse(makeTimelineSummary({ timelines: [], totalEvents: 0 }));
    eventsResponder = () => jsonResponse(makeEventsPage([]));

    renderBlock();

    expect(await screen.findByText("Тут поки немає подій")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати першу подію" })).toBeInTheDocument();
  });

  it("shows the line-empty state for a selected empty line", async () => {
    timelinesResponder = () =>
      jsonResponse(
        makeTimelineListView({
          timelines: [
            makeTimelineView({ id: "line-1", name: "Лінія А" }),
            makeTimelineView({ id: "line-2", isDefault: false, name: "Лінія Б" }),
          ],
        }),
      );
    eventsResponder = () => jsonResponse(makeEventsPage([]));

    renderBlock("?timelineId=line-2");

    expect(await screen.findByText("У цій часовій лінії ще немає подій")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обрати іншу лінію" })).toBeInTheDocument();
  });

  it("shows the search-empty state and clears it on demand", async () => {
    eventsResponder = (params) =>
      jsonResponse(makeEventsPage(params.get("search") === null ? [makeTimelineEventView()] : []));

    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await userEvent.type(screen.getByLabelText("Пошук подій"), "zzz");

    expect(await screen.findByText("Нічого не знайдено за вашим запитом")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Очистити пошук" }));

    expect(
      await screen.findByRole("button", { name: "Геральт прибуває до Визими" }),
    ).toBeInTheDocument();
  });

  it("marks the current reading position on the stream", async () => {
    overviewResponder = () =>
      jsonResponse(
        makeTimelineOverview({
          readingPosition: makeReadingPosition({ currentPage: 25, positionKnown: true }),
        }),
      );
    eventsResponder = () =>
      jsonResponse(
        makeEventsPage([
          makeTimelineEventView({ id: "e1", pageNumber: 10, title: "Пролог" }),
          makeTimelineEventView({ id: "e2", pageNumber: 20, title: "Зав’язка" }),
          makeTimelineEventView({ id: "e3", pageNumber: 30, title: "Кульмінація" }),
        ]),
      );

    renderBlock();

    expect(await screen.findByText("Ви тут · стор. 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "До моєї позиції" })).toBeInTheDocument();
  });

  it("hides events beyond the reading position and reveals them on demand", async () => {
    overviewResponder = () =>
      jsonResponse(
        makeTimelineOverview({
          readingPosition: makeReadingPosition({
            currentPage: 25,
            guardDefault: true,
            positionKnown: true,
          }),
        }),
      );
    eventsResponder = () =>
      jsonResponse(
        makeEventsPage([
          makeTimelineEventView({ id: "read", pageNumber: 10, title: "Уже прочитане" }),
          makeTimelineEventView({ id: "ahead", pageNumber: 30, title: "Таємне вбивство" }),
        ]),
      );

    renderBlock();

    expect(
      await screen.findByText("Подія знаходиться далі вашої поточної позиції читання"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Таємне вбивство" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати подію" }));

    expect(screen.getByRole("button", { name: "Таємне вбивство" })).toBeInTheDocument();
  });

  it("keeps a revealed event visible while the filters change", async () => {
    overviewResponder = () =>
      jsonResponse(
        makeTimelineOverview({
          readingPosition: makeReadingPosition({
            currentPage: 25,
            guardDefault: true,
            positionKnown: true,
          }),
        }),
      );
    eventsResponder = () =>
      jsonResponse(
        makeEventsPage([
          makeTimelineEventView({ id: "read", pageNumber: 10, title: "Уже прочитане" }),
          makeTimelineEventView({ id: "ahead", pageNumber: 30, title: "Таємне вбивство" }),
        ]),
      );

    renderBlock();

    await screen.findByText("Подія знаходиться далі вашої поточної позиції читання");
    await userEvent.click(screen.getByRole("button", { name: "Показати подію" }));
    expect(screen.getByRole("button", { name: "Таємне вбивство" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Пошук подій"), "вбивство");

    await waitFor(() => expect(lastEventsParams().get("search")).toBe("вбивство"));
    expect(screen.getByRole("button", { name: "Таємне вбивство" })).toBeInTheDocument();
  });

  it("shows overview distributions and filters by a chosen type", async () => {
    overviewResponder = () =>
      jsonResponse(
        makeTimelineOverview({
          byType: [
            { count: 5, eventType: "main" },
            { count: 2, eventType: "death" },
          ],
          totalEvents: 7,
        }),
      );

    const { events, onUrlUpdate } = trackUrl();

    renderBlock("?view=overview", onUrlUpdate);

    expect(await screen.findByText("За типом подій")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Смерть персонажа/ }));

    await waitFor(() => expect(lastEventsParams().get("eventType")).toBe("death"));
    await waitFor(() => expect(events.at(-1)?.searchParams.get("view")).toBe("stream"));
  });

  it("drills down from the overview importance row to a single importance", async () => {
    overviewResponder = () =>
      jsonResponse(
        makeTimelineOverview({
          byImportance: [{ count: 2, importance: "key" }],
          totalEvents: 2,
        }),
      );

    renderBlock("?view=overview");

    await screen.findByText("За важливістю");
    await userEvent.click(screen.getByRole("button", { name: /Ключова/ }));

    await waitFor(() => expect(lastEventsParams().get("importance")).toBe("key"));
    expect(lastEventsParams().get("sort")).toBe("book_order");
    expect(lastEventsParams().has("timelineId")).toBe(false);
  });

  it("drills down from the overview timeline row into that line", async () => {
    renderBlock("?view=overview");

    await screen.findByText("Щільність подій за розділами");
    await userEvent.click(screen.getByRole("button", { name: /Основна лінія/ }));

    await waitFor(() => expect(lastEventsParams().get("timelineId")).toBe("line-1"));
    expect(lastEventsParams().get("sort")).toBe("timeline_order");
  });

  it("drills down from the chapterless footer", async () => {
    renderBlock("?view=overview");

    await userEvent.click(await screen.findByRole("button", { name: /Без зазначеного розділу/ }));

    await waitFor(() => expect(lastEventsParams().get("withoutChapter")).toBe("true"));
    expect(lastEventsParams().get("sort")).toBe("book_order");
    expect(lastEventsParams().has("eventType")).toBe(false);
  });

  it("sends the without-chapter facet from the filter sheet", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));

    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("switch", { name: "Без зазначеного розділу" }));

    await waitFor(() => expect(lastEventsParams().get("withoutChapter")).toBe("true"));
  });

  it("clears the active facets with the global reset", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));

    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("switch", { name: "Без зазначеного розділу" }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(lastEventsParams().get("withoutChapter")).toBe("true"));
    expect(
      await screen.findByRole("button", { name: "Прибрати «Без зазначеного розділу»" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Скинути все" }));

    await waitFor(() => expect(lastEventsParams().has("withoutChapter")).toBe(false));
  });
});

describe("BookTimelineBlock timeline management", () => {
  beforeEach(() => {
    timelinesResponder = () =>
      jsonResponse(
        makeTimelineListView({
          timelines: [
            makeTimelineView({ id: "line-1", name: "Лінія А", position: 0 }),
            makeTimelineView({
              id: "line-2",
              isDefault: false,
              name: "Лінія Б",
              position: 1,
            }),
          ],
        }),
      );
  });

  async function openManage() {
    await userEvent.click(await screen.findByRole("button", { name: "Керувати лініями" }));
    return screen.findByRole("dialog", { name: "Керування лініями" });
  }

  async function openRowMenu(name: string) {
    await userEvent.click(await screen.findByRole("button", { name: `Дії лінії «${name}»` }));
    return screen.findByRole("menu");
  }

  it("keeps exactly one management dialog mounted at a time", async () => {
    renderBlock();

    await openManage();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Нова часова лінія" }));

    expect(await screen.findByRole("dialog", { name: "Нова часова лінія" })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Керування лініями" })).not.toBeInTheDocument();
  });

  it("returns to Manage when the create form is cancelled", async () => {
    renderBlock();

    await openManage();
    await userEvent.click(screen.getByRole("button", { name: "Нова часова лінія" }));
    await screen.findByRole("dialog", { name: "Нова часова лінія" });
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(await screen.findByRole("dialog", { name: "Керування лініями" })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("returns to Manage after a successful create", async () => {
    renderBlock();

    await openManage();
    await userEvent.click(screen.getByRole("button", { name: "Нова часова лінія" }));
    await screen.findByRole("dialog", { name: "Нова часова лінія" });
    await userEvent.type(screen.getByLabelText(/Назва лінії/), "Спогади");
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    expect(await screen.findByRole("dialog", { name: "Керування лініями" })).toBeInTheDocument();
  });

  it("returns to Manage after editing a line", async () => {
    renderBlock();

    await openManage();
    await userEvent.click(
      within(await openRowMenu("Лінія Б")).getByRole("menuitem", { name: "Редагувати" }),
    );

    expect(await screen.findByRole("dialog", { name: "Редагувати лінію" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    expect(await screen.findByRole("dialog", { name: "Керування лініями" })).toBeInTheDocument();
  });

  it("closes the whole management flow from Готово", async () => {
    renderBlock();

    await openManage();
    await userEvent.click(screen.getByRole("button", { name: "Готово" }));

    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });

  it("falls back to all lines when the selected line is deleted, not to the move target", async () => {
    const { events, onUrlUpdate } = trackUrl();

    renderBlock("?timelineId=line-2", onUrlUpdate);

    await openManage();
    await userEvent.click(
      within(await openRowMenu("Лінія Б")).getByRole("menuitem", { name: "Видалити лінію" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Видалити часову лінію?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Перемістити події/ })).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("timelineId")).toBeNull());
    expect(await screen.findByRole("dialog", { name: "Керування лініями" })).toBeInTheDocument();
  });
});
