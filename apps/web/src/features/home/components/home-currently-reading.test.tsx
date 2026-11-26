import type { HomeActiveBook, HomeActiveBooksPage } from "@app/shared";
import type { ComponentProps } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookDetailsView } from "@/features/books/components/book-details.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { HomeReadingWidget } from "../model/home-reading";

import { HomeCurrentlyReading } from "./home-currently-reading";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const reading = messages.home.reading;
const progressDialogTitle = messages.books.details.reading.updateDialog.title;
const TODAY = "2026-11-24";
const SLIDE_WIDTH = 100;
const BOOK_IDS = [
  "aaaaaaaa-0000-4000-8000-000000000001",
  "aaaaaaaa-0000-4000-8000-000000000002",
  "aaaaaaaa-0000-4000-8000-000000000003",
] as const;

const fetchMock = vi.fn();
const viewport = { firstSlide: 0, slidesShown: 1 };
const slideObservers = new Set<SlideObserver>();
let activeBooksPage: HomeActiveBooksPage;

class SlideObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly slides: Element[] = [];
  readonly thresholds: readonly number[] = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    slideObservers.add(this);
  }

  disconnect() {
    slideObservers.delete(this);
  }

  observe(slide: Element) {
    this.slides.push(slide);
    this.report([slide]);
  }

  report(targets: readonly Element[]) {
    const entries = targets.map(
      (target) =>
        ({
          isIntersecting: isSlideShown(this.slides.indexOf(target)),
          target,
        }) as IntersectionObserverEntry,
    );
    this.callback(entries, this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(slide: Element) {
    const index = this.slides.indexOf(slide);
    if (index >= 0) this.slides.splice(index, 1);
  }
}

function activeBook(overrides: Partial<HomeActiveBook> = {}): HomeActiveBook {
  return {
    authors: [{ id: "author-1", name: "Террі Пратчетт" }],
    cover: null,
    currentPage: 120,
    cycleStartedAt: "2026-11-01",
    id: BOOK_IDS[0],
    lastProgressAt: "2026-11-23",
    pagesCount: 300,
    progressPercent: 40,
    readingStatus: "reading",
    series: null,
    title: "Варта! Варта!",
    ...overrides,
  };
}

function isSlideShown(index: number): boolean {
  return index >= viewport.firstSlide && index < viewport.firstSlide + viewport.slidesShown;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function page(items: HomeActiveBook[], total = items.length): HomeActiveBooksPage {
  return { items, nextCursor: null, total };
}

function showBooks(widget: HomeReadingWidget<HomeActiveBooksPage>, onRetry = vi.fn()) {
  if (widget.kind === "fresh" || widget.kind === "stale") activeBooksPage = widget.data;
  return renderWithProviders(
    <HomeCurrentlyReading
      isQueueConfirmedEmpty={false}
      isRetrying={false}
      onRetry={onRetry}
      today={TODAY}
      updatedAt={Date.now()}
      widget={widget}
    />,
  );
}

function slideIndex(slide: Element): number {
  for (const observer of slideObservers) {
    const index = observer.slides.indexOf(slide);
    if (index >= 0) return index;
  }
  return 0;
}

function threeBooks(): HomeActiveBook[] {
  return [
    activeBook({ id: BOOK_IDS[0], title: "Варта! Варта!" }),
    activeBook({ id: BOOK_IDS[1], title: "Мор" }),
    activeBook({ id: BOOK_IDS[2], title: "Морт" }),
  ];
}

beforeEach(() => {
  viewport.firstSlide = 0;
  viewport.slidesShown = 1;
  activeBooksPage = page([]);
  vi.stubGlobal("IntersectionObserver", SlideObserver);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function offsetLeft(
    this: HTMLElement,
  ) {
    return slideIndex(this) * SLIDE_WIDTH;
  });
  vi.spyOn(Element.prototype, "scrollTo").mockImplementation(
    (options?: number | ScrollToOptions) => {
      const left = typeof options === "object" ? (options.left ?? 0) : 0;
      viewport.firstSlide = left / SLIDE_WIDTH;
      for (const observer of slideObservers) observer.report(observer.slides);
    },
  );
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/home/reading/books"))
      return Promise.resolve(jsonResponse(activeBooksPage));
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    const bookId = BOOK_IDS.find((id) => url.endsWith(`/api/books/${id}`));
    if (bookId !== undefined && method === "GET")
      return Promise.resolve(jsonResponse(makeBookDetailsView({ id: bookId })));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  slideObservers.clear();
});

describe("HomeCurrentlyReading states", () => {
  it("shows a busy skeleton while the reading zone loads", () => {
    showBooks({ kind: "loading" });

    expect(screen.getByRole("status")).toHaveTextContent(messages.common.loading);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("offers a retry when the reading zone fails", async () => {
    const onRetry = vi.fn();
    showBooks({ kind: "error" }, onRetry);

    expect(screen.getByRole("alert")).toHaveTextContent(reading.error.title);
    await userEvent.click(screen.getByRole("button", { name: reading.error.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous books under a stale notice with a retry", async () => {
    const onRetry = vi.fn();
    showBooks({ data: page([activeBook()]), kind: "stale" }, onRetry);

    expect(screen.getByRole("link", { name: "Варта! Варта!" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(messages.home.stale.message);
    await userEvent.click(screen.getByRole("button", { name: messages.home.stale.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows no stale notice for fresh data", () => {
    showBooks({ data: page([activeBook()]), kind: "fresh" });

    expect(screen.queryByText(messages.home.stale.message)).not.toBeInTheDocument();
  });

  it("links the header to every active book with the total count", () => {
    showBooks({ data: page([activeBook()], 12), kind: "fresh" });

    expect(screen.getByRole("link", { name: "Усі (12)" })).toHaveAttribute(
      "href",
      "/books?status=reading,rereading",
    );
  });
});

describe("HomeCurrentlyReading single book", () => {
  it("shows the book with its page progress and no carousel controls", () => {
    showBooks({ data: page([activeBook()]), kind: "fresh" });

    expect(screen.getByRole("link", { name: "Варта! Варта!" })).toHaveAttribute(
      "href",
      `/books/${BOOK_IDS[0]}`,
    );
    expect(screen.getByText("120 з 300 с.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Прогрес читання: 40%" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: reading.carousel.next })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: reading.carousel.previous }),
    ).not.toBeInTheDocument();
  });

  it("marks a reread", () => {
    showBooks({ data: page([activeBook({ readingStatus: "rereading" })]), kind: "fresh" });

    expect(screen.getByText(reading.rereading)).toBeInTheDocument();
  });

  it("does not mark a first read as a reread", () => {
    showBooks({ data: page([activeBook()]), kind: "fresh" });

    expect(screen.queryByText(reading.rereading)).not.toBeInTheDocument();
  });

  it("shows no zero when neither the page nor the percent is known", () => {
    showBooks({
      data: page([
        activeBook({
          currentPage: null,
          lastProgressAt: null,
          pagesCount: null,
          progressPercent: null,
        }),
      ]),
      kind: "fresh",
    });

    const card = screen.getByRole("article");
    expect(within(card).queryByText(/0/)).not.toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the current page without a zero total when the book length is unknown", () => {
    showBooks({
      data: page([activeBook({ currentPage: 42, pagesCount: null, progressPercent: null })]),
      kind: "fresh",
    });

    expect(screen.getByText("Сторінка 42")).toBeInTheDocument();
    expect(screen.queryByText(/з 0/)).not.toBeInTheDocument();
  });
});

describe("HomeCurrentlyReading stale progress hint", () => {
  it("nudges a book whose last progress is 7 days old", () => {
    showBooks({ data: page([activeBook({ lastProgressAt: "2026-11-17" })]), kind: "fresh" });

    expect(screen.getByText(reading.staleHint)).toBeInTheDocument();
  });

  it("does not nudge a book whose last progress is 6 days old", () => {
    showBooks({ data: page([activeBook({ lastProgressAt: "2026-11-18" })]), kind: "fresh" });

    expect(screen.queryByText(reading.staleHint)).not.toBeInTheDocument();
  });

  it("does not nudge a book with no recorded progress", () => {
    showBooks({ data: page([activeBook({ lastProgressAt: null })]), kind: "fresh" });

    expect(screen.queryByText(reading.staleHint)).not.toBeInTheDocument();
  });
});

describe("HomeCurrentlyReading carousel", () => {
  it("names its controls and starts on the first book", () => {
    showBooks({ data: page(threeBooks()), kind: "fresh" });

    expect(screen.getByRole("group", { name: reading.carousel.label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: reading.carousel.previous })).toBeDisabled();
    expect(screen.getByRole("button", { name: reading.carousel.next })).toBeEnabled();
    expect(screen.getByText("1 з 3")).toBeInTheDocument();
  });

  it("shows the visible range when two books fit", () => {
    viewport.slidesShown = 2;
    showBooks({ data: page(threeBooks()), kind: "fresh" });

    expect(screen.getByText("1–2 з 3")).toBeInTheDocument();
  });

  it("moves to the next book with the next button", async () => {
    showBooks({ data: page(threeBooks()), kind: "fresh" });

    await userEvent.click(screen.getByRole("button", { name: reading.carousel.next }));

    expect(screen.getByText("2 з 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: reading.carousel.previous })).toBeEnabled();
  });

  it("moves with ArrowRight and ArrowLeft from the carousel controls", async () => {
    showBooks({ data: page(threeBooks()), kind: "fresh" });
    act(() => screen.getByRole("button", { name: reading.carousel.next }).focus());

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("2 з 3")).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText("1 з 3")).toBeInTheDocument();
  });

  it("does not wrap past the first book", async () => {
    showBooks({ data: page(threeBooks()), kind: "fresh" });
    act(() => screen.getByRole("button", { name: reading.carousel.next }).focus());

    await userEvent.keyboard("{ArrowLeft}");

    expect(screen.getByText("1 з 3")).toBeInTheDocument();
  });

  it("does not wrap past the last book", async () => {
    showBooks({ data: page(threeBooks()), kind: "fresh" });
    act(() => screen.getByRole("button", { name: reading.carousel.next }).focus());

    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByText("3 з 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: reading.carousel.next })).toBeDisabled();

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByText("3 з 3")).toBeInTheDocument();
  });
});

describe("HomeCurrentlyReading progress update", () => {
  it("fetches the chosen book and opens its progress dialog", async () => {
    showBooks({ data: page(threeBooks()), kind: "fresh" });

    const secondSlide = screen.getByRole("group", { name: "2 з 3" });
    await userEvent.click(
      within(secondSlide).getByRole("button", { name: reading.updateProgress }),
    );

    expect(await screen.findByRole("dialog", { name: progressDialogTitle })).toBeInTheDocument();
    const requested = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requested.some((url) => url.endsWith(`/api/books/${BOOK_IDS[1]}`))).toBe(true);
    expect(requested.some((url) => url.endsWith(`/api/books/${BOOK_IDS[0]}`))).toBe(false);
  });
});
