import "@testing-library/jest-dom/vitest";

import type { BookView } from "@app/shared";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

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
  book: BookView = makeBookView({ id: "book-1", pagesCount: 320 }),
) {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <BookTimelineBlock book={book} />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  timelinesResponder = () => jsonResponse(makeTimelineListView());
  summaryResponder = () => jsonResponse(makeTimelineSummary());
  overviewResponder = () => jsonResponse(makeTimelineOverview());
  eventsResponder = () => jsonResponse(makeEventsPage([makeTimelineEventView()]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
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

  it("shows a single line without the all-lines switcher", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    expect(screen.queryByRole("button", { name: /Усі лінії/ })).not.toBeInTheDocument();
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

    const allLines = await screen.findByRole("button", { name: /Усі лінії/ });
    expect(allLines).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Лінія А/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Лінія Б/ })).toBeInTheDocument();
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

    renderBlock();

    await userEvent.click(await screen.findByRole("button", { name: /Лінія Б/ }));

    await waitFor(() => expect(lastEventsParams().get("timelineId")).toBe("line-2"));
  });

  it("switches from the stream to the list view", async () => {
    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await userEvent.click(screen.getByRole("button", { name: "Список" }));

    expect(screen.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Стрічка" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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

  it("shows the filtered-empty state and clears it on reset", async () => {
    eventsResponder = (params) =>
      jsonResponse(makeEventsPage(params.get("search") === null ? [makeTimelineEventView()] : []));

    renderBlock();

    await screen.findByRole("button", { name: "Геральт прибуває до Визими" });
    await userEvent.type(screen.getByLabelText("Пошук подій"), "zzz");

    expect(
      await screen.findByText("За вибраними фільтрами нічого не знайдено"),
    ).toBeInTheDocument();

    const [reset] = screen.getAllByRole("button", { name: "Скинути фільтри" });
    if (reset === undefined) throw new Error("reset button not found");
    await userEvent.click(reset);

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

    expect(await screen.findByText("Ти зараз тут")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Що вже сталося" })).toBeInTheDocument();
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

    expect(await screen.findByText("Подія попереду позиції читання")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Таємне вбивство" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати" }));

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

    renderBlock("?view=overview");

    expect(await screen.findByText("За типом подій")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Смерть персонажа/ }));

    await waitFor(() => expect(lastEventsParams().get("eventType")).toBe("death"));
    expect(screen.getByRole("button", { name: "Стрічка" })).toHaveAttribute("aria-pressed", "true");
  });
});
