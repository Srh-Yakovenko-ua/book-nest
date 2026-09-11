import "@testing-library/jest-dom/vitest";

import type { QuotesOverviewView, QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeQuote } from "../model/quotes.fixtures";
import { QuoteRediscoveryBlock } from "./quote-rediscovery-block";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const QUOTE_TEXT = "Страх — убивця розуму.";
const HEADING = "Згадати цитату";
const CTA = "Переглянути повністю";

const impressionBodies: string[] = [];
const overviewRequests: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  impressionBodies.length = 0;
  overviewRequests.length = 0;
});

describe("QuoteRediscoveryBlock rendering", () => {
  it("shows the quote the backend picked for today", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock();

    expect(await screen.findByRole("heading", { level: 2, name: HEADING })).toBeVisible();
    expect(screen.getByText(QUOTE_TEXT)).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "Дюна" })).toBeVisible();
    expect(screen.getByText("Френк Герберт")).toBeVisible();
    expect(screen.getByRole("img", { name: "Обкладинка книги «Дюна»" })).toBeVisible();
    expect(screen.getByRole("button", { name: CTA })).toBeVisible();
  });

  it("renders nothing while the overview is still loading", () => {
    mockOverview(overview(makeQuote()), { pending: true });

    renderBlock();

    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
  });

  it("stays out of the way when the overview request fails", async () => {
    mockOverview(overview(makeQuote()), { overviewStatus: 500 });

    renderBlock();

    await waitFor(() => expect(overviewRequests).toHaveLength(1));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders nothing when the archive holds no quote to rediscover", async () => {
    mockOverview({ memoryQuote: null, postFinish: null });

    renderBlock();

    await waitFor(() => expect(overviewRequests).toHaveLength(1));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("names an unknown author when the book has none", async () => {
    mockOverview(overview(makeQuote({ book: { ...makeQuote().book, firstAuthorName: "" } })));

    renderBlock();

    expect(await screen.findByText("Автор невідомий")).toBeVisible();
  });

  it("links the cover and the title to the book", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock();

    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/books/book-1");
  });
});

describe("QuoteRediscoveryBlock spoiler safety", () => {
  it("hides the whole block rather than exposing a spoiler", async () => {
    mockOverview(overview(makeQuote({ isSpoiler: true })));

    renderBlock();

    await waitFor(() => expect(overviewRequests).toHaveLength(1));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(QUOTE_TEXT);
  });

  it("never counts an impression for a spoiler it refused to show", async () => {
    mockOverview(overview(makeQuote({ isSpoiler: true })));

    renderBlock();

    await waitFor(() => expect(overviewRequests).toHaveLength(1));
    expect(impressionBodies).toHaveLength(0);
  });
});

describe("QuoteRediscoveryBlock metadata", () => {
  it("joins the chapter and the page", async () => {
    mockOverview(overview(makeQuote({ chapter: "Розділ 17", page: 318 })));

    renderBlock();

    expect(await screen.findByText("Розділ 17 · стор. 318")).toBeVisible();
  });

  it("keeps the line to the page alone", async () => {
    mockOverview(overview(makeQuote({ chapter: null, page: 318 })));

    renderBlock();

    expect(await screen.findByText("стор. 318")).toBeVisible();
  });

  it("keeps the line to the chapter alone", async () => {
    mockOverview(overview(makeQuote({ chapter: "Розділ 17", page: null })));

    renderBlock();

    expect(await screen.findByText("Розділ 17")).toBeVisible();
  });

  it("drops the line instead of rendering a bare separator", async () => {
    mockOverview(overview(makeQuote({ chapter: null, page: null })));

    renderBlock();

    await screen.findByText(QUOTE_TEXT);
    expect(screen.queryByText(/стор\./)).not.toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });
});

describe("QuoteRediscoveryBlock signals", () => {
  it("shows both signals when the quote is favorite and carries a comment", async () => {
    mockOverview(
      overview(makeQuote({ comment: "Перечитую перед складною розмовою.", isFavorite: true })),
    );

    renderBlock();

    expect(await screen.findByText("Улюблена")).toBeVisible();
    expect(screen.getByText("Є коментар")).toBeVisible();
  });

  it("shows the favorite signal alone", async () => {
    mockOverview(overview(makeQuote({ comment: null, isFavorite: true })));

    renderBlock();

    expect(await screen.findByText("Улюблена")).toBeVisible();
    expect(screen.queryByText("Є коментар")).not.toBeInTheDocument();
  });

  it("shows the comment signal alone", async () => {
    mockOverview(overview(makeQuote({ comment: "Коротка нотатка на полях.", isFavorite: false })));

    renderBlock();

    expect(await screen.findByText("Є коментар")).toBeVisible();
    expect(screen.queryByText("Улюблена")).not.toBeInTheDocument();
  });

  it("drops the line when a blank comment is the only candidate", async () => {
    mockOverview(overview(makeQuote({ comment: "   ", isFavorite: false })));

    renderBlock();

    await screen.findByText(QUOTE_TEXT);
    expect(screen.queryByText("Улюблена")).not.toBeInTheDocument();
    expect(screen.queryByText("Є коментар")).not.toBeInTheDocument();
  });
});

describe("QuoteRediscoveryBlock saved age", () => {
  it("counts the months back to the day the reader saved the quote", async () => {
    freezeToday();
    mockOverview(overview(makeQuote({ createdAt: "2026-01-10T10:00:00.000Z" })));

    renderBlock();

    expect(await screen.findByText("Ви зберегли її 8 місяців тому")).toBeVisible();
  });

  it("falls back to years for anything older than a year", async () => {
    freezeToday();
    mockOverview(overview(makeQuote({ createdAt: "2025-06-01T10:00:00.000Z" })));

    renderBlock();

    expect(await screen.findByText("Ви зберегли її минулого року")).toBeVisible();
  });
});

describe("QuoteRediscoveryBlock full view", () => {
  it("opens the existing dialog with the full text", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock();
    await clickCta();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(QUOTE_TEXT)).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Дюна" })).toBeVisible();
  });

  it("offers no inline expansion of the preview", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock();

    const block = await findBlock();
    expect(within(block).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Показати повністю" })).not.toBeInTheDocument();
  });

  it("hands the quote to the caller instead of owning a dialog a drawer would unmount", async () => {
    mockOverview(overview(makeQuote()));
    const opened: QuoteView[] = [];

    renderBlock({ onOpenFullView: (quote) => opened.push(quote) });
    await clickCta();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opened.map((quote) => quote.id)).toEqual(["quote-1"]);
  });

  it("asks for no other quote when the reader opens the dialog", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock();
    await clickCta();

    await screen.findByRole("dialog");
    expect(overviewRequests).toHaveLength(1);
  });
});

describe("QuoteRediscoveryBlock impression", () => {
  it("counts the quote once when the block is presented", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock();

    await waitFor(() => expect(impressionBodies).toHaveLength(1));
    expect(JSON.parse(impressionBodies[0] ?? "")).toEqual({ quoteId: "quote-1" });
  });

  it("counts nothing while the panel holding the block stays hidden", async () => {
    mockOverview(overview(makeQuote()));

    renderBlock({ isVisible: false });

    expect(await screen.findByText(QUOTE_TEXT)).toBeVisible();
    expect(impressionBodies).toHaveLength(0);
  });

  it("counts the quote once when the panel finally opens", async () => {
    mockOverview(overview(makeQuote()));

    const { rerender } = renderBlock({ isVisible: false });
    await screen.findByText(QUOTE_TEXT);

    rerender(<QuoteRediscoveryBlock isVisible />);

    await waitFor(() => expect(impressionBodies).toHaveLength(1));

    rerender(<QuoteRediscoveryBlock isVisible={false} />);
    rerender(<QuoteRediscoveryBlock isVisible />);

    await waitFor(() => expect(overviewRequests.length).toBeGreaterThan(0));
    expect(impressionBodies).toHaveLength(1);
  });

  it("never counts the same quote twice when the overview is fetched again", async () => {
    mockOverview(overview(makeQuote()));

    const { queryClient } = renderBlock();
    await waitFor(() => expect(impressionBodies).toHaveLength(1));

    await queryClient.refetchQueries();

    await waitFor(() => expect(overviewRequests.length).toBeGreaterThan(1));
    expect(impressionBodies).toHaveLength(1);
  });

  it("keeps the quote on screen when the impression request fails", async () => {
    mockOverview(overview(makeQuote()), { impressionStatus: 500 });

    renderBlock();

    await waitFor(() => expect(impressionBodies).toHaveLength(1));
    expect(await screen.findByRole("heading", { level: 2, name: HEADING })).toBeVisible();
    expect(screen.getByText(QUOTE_TEXT)).toBeVisible();
    expect(screen.getByRole("button", { name: CTA })).toBeVisible();
  });
});

describe("QuoteRediscoveryBlock accessibility", () => {
  it("presents one heading, two book links and one action", async () => {
    mockOverview(overview(makeQuote({ isFavorite: true })));

    renderBlock();

    const block = await findBlock();

    expect(within(block).getAllByRole("button")).toHaveLength(1);
    expect(within(block).getAllByRole("link")).toHaveLength(2);
    expect(within(block).getByText("Улюблена")).not.toHaveAttribute("aria-hidden");
  });
});

async function clickCta() {
  await userEvent.click(await screen.findByRole("button", { name: CTA }));
}

async function findBlock(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name: HEADING });
  const block = heading.closest("section");
  if (block === null) throw new Error("the rediscovery block has no section shell");
  return block;
}

function freezeToday() {
  vi.useFakeTimers({ toFake: ["Date"] });
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
  options: { impressionStatus?: number; overviewStatus?: number; pending?: boolean } = {},
) {
  const { impressionStatus = 204, overviewStatus = 200, pending = false } = options;

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/quotes/rediscovery/impression")) {
        impressionBodies.push(String(init?.body ?? ""));
        return Promise.resolve(
          impressionStatus === 204
            ? new Response(null, { status: 204 })
            : jsonResponse({ message: "impression failed" }, impressionStatus),
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

function overview(memoryQuote: QuoteView): QuotesOverviewView {
  return { memoryQuote, postFinish: null };
}

function renderBlock(
  props: { isVisible?: boolean; onOpenFullView?: (quote: QuoteView) => void } = {},
) {
  const { isVisible = true, onOpenFullView } = props;
  return renderWithProviders(
    <QuoteRediscoveryBlock isVisible={isVisible} onOpenFullView={onOpenFullView} />,
  );
}
