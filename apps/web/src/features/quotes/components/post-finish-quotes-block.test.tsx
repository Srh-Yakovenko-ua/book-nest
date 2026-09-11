import "@testing-library/jest-dom/vitest";

import type { MediaView, PostFinishQuotesView, QuotesOverviewView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { PostFinishQuotesBlock } from "./post-finish-quotes-block";

const CTA_TIMINGS = {
  navigationDeadlineMs: 1500,
  urlFlushMs: 100,
} as const;

const CYCLE_ID = "8f1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const STALE_CYCLE_ID = "1b2c3d4e-5f60-4712-8934-56789abcdef0";

const COVER: MediaView = {
  contentType: "image/webp",
  createdAt: "2026-01-05T10:00:00.000Z",
  height: 400,
  id: "media-1",
  kind: "book_cover",
  name: null,
  sizeBytes: 1024,
  urls: {
    card: "https://cdn.test/card.webp",
    full: "https://cdn.test/full.webp",
    thumb: "https://cdn.test/thumb.webp",
  },
  width: 300,
};

const reviewBodies: string[] = [];
const overviewRequests: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
  reviewBodies.length = 0;
  overviewRequests.length = 0;
});

describe("PostFinishQuotesBlock rendering", () => {
  it("shows the finished book the backend picked", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ book: { cover: COVER } })));

    renderBlock();

    expect(
      await screen.findByRole("heading", { level: 2, name: "Після завершення" }),
    ).toBeVisible();
    expect(screen.getByText("Безрозсудна")).toBeVisible();
    expect(screen.getByText("Лорен Робертс")).toBeVisible();
    expect(screen.getByRole("img", { name: "Обкладинка книги «Безрозсудна»" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Переглянути цитати/ })).toBeVisible();
  });

  it("renders nothing while the overview is still loading", () => {
    mockOverview(overview(postFinish()), { pending: true });

    renderBlock();

    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("stays out of the way when the overview request fails", async () => {
    mockOverview(overview(postFinish()), { overviewStatus: 500 });

    renderBlock();

    await waitFor(() => expect(overviewRequests).toHaveLength(1));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders nothing when no reading cycle qualifies", async () => {
    mockOverview({ memoryQuote: null, postFinish: null });

    renderBlock();

    await waitFor(() => expect(overviewRequests).toHaveLength(1));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("names an unknown author when the book has none", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ book: { firstAuthorName: "" } })));

    renderBlock();

    expect(await screen.findByText("Автор невідомий")).toBeVisible();
  });
});

describe("PostFinishQuotesBlock finished day", () => {
  it("calls a book finished on the current local day today", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ finishedAt: "2026-09-10" })));

    renderBlock();

    expect(await screen.findByText("Завершено сьогодні")).toBeVisible();
  });

  it("calls the previous local day yesterday", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ finishedAt: "2026-09-09" })));

    renderBlock();

    expect(await screen.findByText("Завершено учора")).toBeVisible();
  });

  it("counts whole days back for anything older", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ finishedAt: "2026-09-04" })));

    renderBlock();

    expect(await screen.findByText("Завершено 6 днів тому")).toBeVisible();
  });
});

describe("PostFinishQuotesBlock recap", () => {
  it.each([
    [1, "1 цитата"],
    [2, "2 цитати"],
    [5, "5 цитат"],
  ])("declines the quote count for %i", async (quotesCount, expected) => {
    freezeToday();
    mockOverview(overview(postFinish({ quotesCount })));

    renderBlock();

    expect(await screen.findByText(expected)).toBeVisible();
  });

  it("joins favorites and comments when the backend counted both", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ favoritesCount: 4, withCommentCount: 5 })));

    renderBlock();

    expect(await screen.findByText("4 улюблені")).toBeVisible();
    expect(screen.getByText("5 з коментарем")).toBeVisible();
  });

  it("keeps the separator away from the reader that listens", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ favoritesCount: 4, withCommentCount: 5 })));

    renderBlock();

    await screen.findByText("4 улюблені");
    expect(screen.getByText("·")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the line to favorites alone", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ favoritesCount: 4, withCommentCount: 0 })));

    renderBlock();

    expect(await screen.findByText("4 улюблені")).toBeVisible();
  });

  it("keeps the line to comments alone", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ favoritesCount: 0, withCommentCount: 5 })));

    renderBlock();

    expect(await screen.findByText("5 з коментарем")).toBeVisible();
  });

  it("drops the secondary line rather than showing zeros", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ favoritesCount: 0, withCommentCount: 0 })));

    renderBlock();

    expect(await screen.findByText("12 цитат")).toBeVisible();
    expect(screen.queryByText(/улюблен/)).not.toBeInTheDocument();
    expect(screen.queryByText(/з коментарем/)).not.toBeInTheDocument();
  });
});

describe("PostFinishQuotesBlock call to action", () => {
  it("reviews the exact reading cycle the backend rendered", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ readingCycleId: STALE_CYCLE_ID })));

    renderBlock();
    await clickCta();

    await waitFor(() => expect(reviewBodies).toHaveLength(1));
    expect(JSON.parse(reviewBodies[0] ?? "")).toEqual({ readingCycleId: STALE_CYCLE_ID });
  });

  it("replaces every dataset filter with the recapped book and keeps the presentation", async () => {
    freezeToday();
    mockOverview(overview(postFinish()));
    const { events, onUrlUpdate } = trackUrl();

    renderBlock(
      "?book=book-9&bookId=book-8&q=дюна&filter=favorites&author=author-1&createdFrom=2026-01-01&createdTo=2026-08-31&sort=oldest&view=list",
      onUrlUpdate,
    );
    await clickCta();

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBe("book-1"));
    const last = events.at(-1)?.searchParams;
    expect(last?.get("bookId")).toBeNull();
    expect(last?.get("q")).toBeNull();
    expect(last?.get("filter")).toBeNull();
    expect(last?.get("author")).toBeNull();
    expect(last?.get("createdFrom")).toBeNull();
    expect(last?.get("createdTo")).toBeNull();
    expect(last?.get("sort")).toBe("oldest");
    expect(last?.get("view")).toBe("list");
  });

  it("hands the navigation to the caller so a drawer can close first", async () => {
    freezeToday();
    mockOverview(overview(postFinish()));
    const { events, onUrlUpdate } = trackUrl();
    const deferred: (() => void)[] = [];

    renderBlock("", onUrlUpdate, (action) => deferred.push(action));
    await clickCta();

    expect(deferred).toHaveLength(1);
    expect(reviewBodies).toHaveLength(0);
    expect(events).toHaveLength(0);

    deferred[0]?.();

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBe("book-1"));
  });
});

describe("PostFinishQuotesBlock failure and races", () => {
  it("still opens the quotes when the review request fails", async () => {
    freezeToday();
    mockOverview(overview(postFinish()), { reviewStatus: 500 });
    const { events, onUrlUpdate } = trackUrl();

    renderBlock("", onUrlUpdate);
    await clickCta();

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBe("book-1"));
    expect(reviewBodies).toHaveLength(1);
  });

  it("never remembers a review of its own", async () => {
    freezeToday();
    mockOverview(overview(postFinish()), { reviewStatus: 500 });

    renderBlock();
    await clickCta();

    await waitFor(() => expect(reviewBodies).toHaveLength(1));
    expect(window.localStorage.length).toBe(0);
  });

  it("opens the quotes once the deadline passes on a review that never answers", async () => {
    freezeToday({ withTimers: true });
    mockOverview(overview(postFinish()), { reviewPending: true });
    const { events, onUrlUpdate } = trackUrl();

    renderBlock("", onUrlUpdate);
    await settle();
    await clickCtaUnderFakeTimers();

    expect(events).toHaveLength(0);
    expect(reviewBodies).toHaveLength(1);

    await settle(CTA_TIMINGS.navigationDeadlineMs + CTA_TIMINGS.urlFlushMs);

    expect(events).toHaveLength(1);
    expect(events.at(-1)?.searchParams.get("book")).toBe("book-1");
  });

  it("opens the quotes exactly once when the review answers in time", async () => {
    freezeToday({ withTimers: true });
    mockOverview(overview(postFinish()));
    const { events, onUrlUpdate } = trackUrl();

    renderBlock("", onUrlUpdate);
    await settle();
    await clickCtaUnderFakeTimers();
    await settle(CTA_TIMINGS.urlFlushMs);

    expect(events).toHaveLength(1);
    expect(events.at(-1)?.searchParams.get("book")).toBe("book-1");

    await settle(CTA_TIMINGS.navigationDeadlineMs * 2);

    expect(events).toHaveLength(1);
  });

  it("asks the overview again once the review lands", async () => {
    freezeToday();
    mockOverview(overview(postFinish()));

    renderBlock();
    await clickCta();

    await waitFor(() => expect(overviewRequests.length).toBeGreaterThan(1));
  });
});

describe("PostFinishQuotesBlock accessibility", () => {
  it("offers the recap as one heading and one action", async () => {
    freezeToday();
    mockOverview(overview(postFinish({ book: { cover: COVER } })));

    renderBlock();

    const heading = await screen.findByRole("heading", { level: 2, name: "Після завершення" });
    const block = heading.closest("section");
    expect(block).not.toBeNull();
    if (block === null) return;

    expect(within(block).getAllByRole("button")).toHaveLength(1);
    expect(within(block).queryAllByRole("link")).toHaveLength(0);
    expect(within(block).getByText("12 цитат")).not.toHaveAttribute("aria-hidden");
  });
});

async function clickCta() {
  await userEvent.click(await screen.findByRole("button", { name: /Переглянути цитати/ }));
}

async function clickCtaUnderFakeTimers() {
  const cta = screen.getByRole("button", { name: /Переглянути цитати/ });
  await act(async () => {
    cta.click();
    await vi.advanceTimersByTimeAsync(0);
  });
}

function freezeToday({ withTimers = false }: { withTimers?: boolean } = {}) {
  vi.useFakeTimers({ toFake: withTimers ? ["Date", "setTimeout", "clearTimeout"] : ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 10, 14, 30));
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockOverview(
  view: QuotesOverviewView,
  options: {
    overviewStatus?: number;
    pending?: boolean;
    reviewPending?: boolean;
    reviewStatus?: number;
  } = {},
) {
  const {
    overviewStatus = 200,
    pending = false,
    reviewPending = false,
    reviewStatus = 204,
  } = options;

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/quotes/post-finish/review")) {
        reviewBodies.push(String(init?.body ?? ""));
        if (reviewPending) return new Promise<Response>(() => undefined);
        return Promise.resolve(
          reviewStatus === 204
            ? new Response(null, { status: 204 })
            : jsonResponse({ message: "review failed" }, reviewStatus),
        );
      }

      if (url.includes("/api/quotes/overview")) {
        overviewRequests.push(url);
        if (pending) return new Promise<Response>(() => undefined);
        return Promise.resolve(
          jsonResponse(overviewStatus === 200 ? view : { message: "boom" }, overviewStatus),
        );
      }

      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function overview(view: PostFinishQuotesView): QuotesOverviewView {
  return { memoryQuote: null, postFinish: view };
}

function postFinish(
  overrides: Partial<Omit<PostFinishQuotesView, "book">> & {
    book?: Partial<PostFinishQuotesView["book"]>;
  } = {},
): PostFinishQuotesView {
  const { book, ...rest } = overrides;

  return {
    book: {
      cover: null,
      firstAuthorName: "Лорен Робертс",
      id: "book-1",
      title: "Безрозсудна",
      ...book,
    },
    favoritesCount: 4,
    finishedAt: "2026-09-04",
    quotesCount: 12,
    readingCycleId: CYCLE_ID,
    withCommentCount: 5,
    ...rest,
  };
}

function renderBlock(
  searchParams = "",
  onUrlUpdate?: OnUrlUpdateFunction,
  runAction?: (action: () => void) => void,
) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <PostFinishQuotesBlock runAction={runAction} />
    </NuqsTestingAdapter>,
  );
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}
