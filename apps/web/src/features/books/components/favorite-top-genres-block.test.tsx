import "@testing-library/jest-dom/vitest";
import type { FavoritesSummaryView, GenreView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { FavoriteTopGenresBlock } from "./favorite-top-genres-block";

const tg = messages.favorites.topGenres;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let handleSummary: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeGenres(entries: { key: string; name: string }[]): GenreView[] {
  return entries.map((entry) => ({
    groupKey: "fiction",
    groupName: "Художня література",
    id: `genre-${entry.key}`,
    isDefault: false,
    key: entry.key,
    name: entry.name,
  }));
}

function makeSummary(topGenres: { count: number; genre: string }[]): FavoritesSummaryView {
  return {
    averageRating: 4.2,
    finished: 10,
    reading: 3,
    series: 2,
    solo: 8,
    topGenres,
    topTags: [],
    total: 12,
    unrated: 0,
    wantToRead: 1,
  };
}

function summaryGetCount(): number {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).includes("/api/books/favorites-summary"),
  ).length;
}

function withSummary(topGenres: { count: number; genre: string }[]) {
  handleSummary = () => Promise.resolve(jsonResponse(makeSummary(topGenres)));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  handleSummary = () => Promise.resolve(jsonResponse(makeSummary([])));
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/books/favorites-summary")) return handleSummary();
    if (url.includes("/api/genres")) {
      return Promise.resolve(
        jsonResponse(
          makeGenres([
            { key: "fantasy", name: "Фентезі" },
            { key: "scifi", name: "Наукова фантастика" },
            { key: "thriller", name: "Трилер" },
            { key: "romance", name: "Романтика" },
          ]),
        ),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FavoriteTopGenresBlock", () => {
  it("shows the loading skeleton while the summary request is pending", () => {
    handleSummary = () => new Promise<Response>(() => {});
    renderWithProviders(<FavoriteTopGenresBlock />);

    expect(document.querySelector("[aria-busy]")).not.toBeNull();
  });

  it("shows an error and retries loading the summary", async () => {
    handleSummary = () => Promise.resolve(jsonResponse(makeSummary([]), 500));
    renderWithProviders(<FavoriteTopGenresBlock />);

    expect(await screen.findByText(tg.error)).toBeInTheDocument();
    const callsBeforeRetry = summaryGetCount();

    withSummary([{ count: 4, genre: "fantasy" }]);
    await userEvent.click(screen.getByRole("button", { name: tg.retry }));

    expect(await screen.findByText("Фентезі")).toBeInTheDocument();
    await waitFor(() => expect(summaryGetCount()).toBeGreaterThan(callsBeforeRetry));
  });

  it("shows the empty state when there are no top genres", async () => {
    withSummary([]);
    renderWithProviders(<FavoriteTopGenresBlock />);

    expect(await screen.findByText(tg.empty)).toBeInTheDocument();
    expect(screen.queryByLabelText(tg.chartLabel)).not.toBeInTheDocument();
  });

  it("renders the top genre names, percentages, and the chart", async () => {
    withSummary([
      { count: 5, genre: "fantasy" },
      { count: 3, genre: "scifi" },
      { count: 2, genre: "thriller" },
    ]);
    renderWithProviders(<FavoriteTopGenresBlock />);

    expect(await screen.findByText("Фентезі")).toBeInTheDocument();
    expect(screen.getByText("Наукова фантастика")).toBeInTheDocument();
    expect(screen.getByText("Трилер")).toBeInTheDocument();

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();

    expect(screen.getByLabelText(tg.chartLabel)).toBeInTheDocument();
  });

  it("caps the legend at three genres", async () => {
    withSummary([
      { count: 5, genre: "fantasy" },
      { count: 3, genre: "scifi" },
      { count: 2, genre: "thriller" },
      { count: 1, genre: "romance" },
    ]);
    renderWithProviders(<FavoriteTopGenresBlock />);

    await screen.findByText("Фентезі");

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Романтика")).not.toBeInTheDocument();
  });
});
