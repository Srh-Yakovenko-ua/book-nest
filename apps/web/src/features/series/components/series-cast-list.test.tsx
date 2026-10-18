import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeCharacterPage,
  makeRosterCharacter,
  RELATIONSHIP_FIXTURE,
} from "@/features/character-relationships/model/relationships.fixtures";
import messages from "@/messages/uk.json";
import { mockIntersectionObserver, renderWithProviders, screen, waitFor } from "@/test-utils";

import { seriesKeys } from "../api/series-keys";
import { SeriesCastList } from "./series-cast-list";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const { geralt: GERALT } = RELATIONSHIP_FIXTURE;

const SERIES_ID = "5e5e5e5e-0000-4000-8000-000000000005";

const CONTEXT_BOOK_ID = RELATIONSHIP_FIXTURE.book.id;

const CAST_PATH = `/api/series/${SERIES_ID}/characters`;

const LOADING_MORE = messages.common.loadingMore;

const FIRST_OF_TWO_PAGES = {
  ...makeCharacterPage([makeRosterCharacter(GERALT)]),
  pagesCount: 2,
  pageSize: 1,
  totalCount: 2,
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const viewport = mockIntersectionObserver();

let isHoldingCast = false;

function castRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === CAST_PATH);
}

function renderCastList() {
  return renderWithProviders(
    <NuqsTestingAdapter>
      <SeriesCastList contextBookId={CONTEXT_BOOK_ID} seriesId={SERIES_ID} />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  isHoldingCast = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method !== "GET" || url.pathname !== CAST_PATH) {
      return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
    }
    if (isHoldingCast) return new Promise<Response>(() => undefined);
    return Promise.resolve(
      new Response(JSON.stringify(FIRST_OF_TWO_PAGES), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SeriesCastList load more", () => {
  it("shows no load-more spinner while the cast refreshes in the background", async () => {
    const { queryClient } = renderCastList();
    await screen.findByRole("heading", { name: GERALT.name });
    isHoldingCast = true;

    await act(async () => {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    });
    await waitFor(() => expect(castRequests()).toHaveLength(2));
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(screen.queryByText(LOADING_MORE)).not.toBeInTheDocument();
  });

  it("shows the load-more spinner while the next page loads", async () => {
    renderCastList();
    await screen.findByRole("heading", { name: GERALT.name });
    isHoldingCast = true;

    viewport.enterViewport();

    expect(await screen.findByText(LOADING_MORE)).toBeInTheDocument();
    expect(castRequests().at(-1)?.searchParams.get("pageNumber")).toBe("2");
  });
});
