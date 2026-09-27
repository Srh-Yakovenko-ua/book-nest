import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeEventsPage, makeTimelineEventView } from "../model/timeline.fixtures";
import { TimelineEventSingleSelectPicker } from "./timeline-event-single-select-picker";

const DEBOUNCE_SETTLE_MS = 450;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function defaultEvents() {
  return [
    makeTimelineEventView({
      chapter: "Розділ 1",
      id: "event-a",
      pageNumber: 12,
      title: "Геральт прибуває",
    }),
    makeTimelineEventView({ id: "event-b", title: "Йеннефер зникає" }),
  ];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function listCalls() {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/books/book-1/timeline-events");
}

function renderPicker(
  overrides: Partial<Parameters<typeof TimelineEventSingleSelectPicker>[0]> = {},
) {
  const onSelect = vi.fn();
  renderWithProviders(
    <TimelineEventSingleSelectPicker
      bookId="book-1"
      excludeIds={[]}
      onSelect={onSelect}
      searchLabel="Пошук події"
      selectedId={null}
      {...overrides}
    />,
  );
  return { onSelect };
}

function respondWithEvents(items = defaultEvents()) {
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/timeline-events")) {
      return Promise.resolve(jsonResponse(makeEventsPage(items)));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

function searchQueries() {
  return listCalls()
    .map((url) => url.searchParams.get("search"))
    .filter((search): search is string => search !== null);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TimelineEventSingleSelectPicker", () => {
  it("browses the book events before anything is typed", async () => {
    respondWithEvents();

    renderPicker();

    expect(await screen.findByRole("radio", { name: "Геральт прибуває" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Йеннефер зникає" })).toBeInTheDocument();
    expect(searchQueries()).toEqual([]);
  });

  it("shows the timeline, chapter and page of a row", async () => {
    respondWithEvents();

    renderPicker();

    expect(await screen.findByText("Розділ 1")).toBeInTheDocument();
    expect(screen.getAllByText("Основна лінія").length).toBeGreaterThan(0);
    expect(screen.getByText("стор. 12")).toBeInTheDocument();
  });

  it("keeps browsing for a single character and searches the server from two", async () => {
    respondWithEvents();

    renderPicker();
    await screen.findByRole("radio", { name: "Геральт прибуває" });
    const input = screen.getByLabelText("Пошук події");

    await userEvent.type(input, "Й");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));
    });
    expect(searchQueries()).toEqual([]);

    await userEvent.type(input, "е");

    await waitFor(() => expect(searchQueries()).toEqual(["Йе"]), { timeout: 3000 });
  });

  it("hides the excluded events", async () => {
    respondWithEvents();

    renderPicker({ excludeIds: ["event-b"] });

    expect(await screen.findByRole("radio", { name: "Геральт прибуває" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Йеннефер зникає" })).not.toBeInTheDocument();
  });

  it("reports the chosen event", async () => {
    respondWithEvents();
    const { onSelect } = renderPicker();

    await userEvent.click(await screen.findByRole("radio", { name: "Йеннефер зникає" }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "event-b" }));
  });

  it("tells the reader when nothing matches", async () => {
    respondWithEvents([]);

    renderPicker();

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
  });

  it("recovers from a failed load through retry", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));
    respondWithEvents();

    renderPicker();

    await userEvent.click(await screen.findByRole("button", { name: "Повторити" }));

    expect(await screen.findByRole("radio", { name: "Геральт прибуває" })).toBeInTheDocument();
  });
});
