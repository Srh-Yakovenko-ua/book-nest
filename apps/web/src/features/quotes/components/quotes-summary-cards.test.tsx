import "@testing-library/jest-dom/vitest";

import type { QuotesSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { QuotesSummaryCards, useQuotesSummaryCards } from "./quotes-summary-cards";

const copy = messages.quotes.summary;

const LAYOUT = {
  cardCount: 4,
  gridSkeletonsPerCard: 4,
  mobileSkeletonsPerTile: 3,
} as const;

const SUMMARY: QuotesSummaryView = {
  averageQuotesPerQuotedBook: 2.875,
  favoritesCount: 4,
  quotedBooksCount: 8,
  spoilerCount: 1,
  topAuthor: { leadersCount: 1, name: "Френк Герберт", quotesCount: 9 },
  topBook: { leadersCount: 1, quotesCount: 5, title: "Дюна" },
  totalCount: 23,
  withCommentCount: 6,
  withoutSpoilerCount: 22,
};

const EMPTY_SUMMARY: QuotesSummaryView = {
  averageQuotesPerQuotedBook: null,
  favoritesCount: 0,
  quotedBooksCount: 0,
  spoilerCount: 0,
  topAuthor: null,
  topBook: null,
  totalCount: 0,
  withCommentCount: 0,
  withoutSpoilerCount: 0,
};

function cardAt(index: number): HTMLElement {
  const card = statCards()[index];
  if (card === undefined) throw new Error(`no stat card at index ${index}`);
  return card;
}

function Harness({
  isError = false,
  isLoading = false,
  mobileAction,
  summary,
}: {
  isError?: boolean;
  isLoading?: boolean;
  mobileAction?: ReactNode;
  summary?: QuotesSummaryView;
}) {
  const cards = useQuotesSummaryCards(summary);

  return (
    <QuotesSummaryCards
      cards={cards}
      isError={isError}
      isLoading={isLoading}
      mobileAction={mobileAction}
    />
  );
}

function iconOf(card: HTMLElement): null | string {
  return card.querySelector("use")?.getAttribute("href") ?? null;
}

function mobileTile(compactLabel: string): HTMLElement {
  const tile = screen.getByText(compactLabel).closest('[data-slot="card"]');
  if (tile === null) throw new Error(`no mobile tile for ${compactLabel}`);
  return tile as HTMLElement;
}

function renderCards(props: Parameters<typeof Harness>[0] = {}) {
  return renderWithProviders(<Harness summary={SUMMARY} {...props} />);
}

function statCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
}

describe("QuotesSummaryCards", () => {
  it("renders exactly four cards in the agreed order", () => {
    renderCards();

    expect(statCards()).toHaveLength(LAYOUT.cardCount);
    expect(statCards().map((card) => card.textContent)).toEqual([
      expect.stringContaining(copy.quotedBooks),
      expect.stringContaining(copy.averagePerBook),
      expect.stringContaining(copy.topBook),
      expect.stringContaining(copy.topAuthor),
    ]);
  });

  it("gives every card its own icon", () => {
    renderCards();

    expect(statCards().map(iconOf)).toEqual([
      "/icons/ui-icons.svg#i-library-big",
      "/icons/ui-icons.svg#i-chart",
      "/icons/ui-icons.svg#i-book-open-text",
      "/icons/ui-icons.svg#i-user-round",
    ]);
  });

  it("keeps the cards non-interactive", () => {
    renderCards();

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    for (const card of statCards()) {
      expect(card).not.toHaveAttribute("role");
      expect(card).not.toHaveAttribute("tabindex");
      expect(card.querySelector("a")).toBeNull();
      expect(card.querySelector("a[href]")).toBeNull();
      expect(card.querySelector("[tabindex]")).toBeNull();
      expect(iconOf(card)).not.toContain("chevron");
    }
  });

  it("counts the quoted books and the quotes behind them", () => {
    renderCards();

    expect(cardAt(0)).toHaveTextContent(/8\s*книг/);
    expect(cardAt(0)).toHaveTextContent("23 цитати загалом");
  });

  it("pluralizes the book unit for a single quoted book", () => {
    renderCards({
      summary: { ...SUMMARY, averageQuotesPerQuotedBook: 1, quotedBooksCount: 1, totalCount: 1 },
    });

    expect(cardAt(0)).toHaveTextContent(/1\s*книга/);
    expect(cardAt(0)).toHaveTextContent("1 цитата загалом");
    expect(cardAt(1)).toHaveTextContent(/1\s*цитата/);
    expect(cardAt(1)).toHaveTextContent("Серед 1 книги");
  });

  it("rounds the average to one decimal and formats it for the locale", () => {
    renderCards({ summary: { ...SUMMARY, averageQuotesPerQuotedBook: 2.875 } });

    expect(cardAt(1)).toHaveTextContent(/2,9\s*цитати/);
    expect(cardAt(1)).toHaveTextContent("Серед 8 книг");
  });

  it("drops the trailing zero of a whole average", () => {
    renderCards({ summary: { ...SUMMARY, averageQuotesPerQuotedBook: 3 } });

    expect(cardAt(1)).toHaveTextContent(/3\s*цитати/);
    expect(cardAt(1)).not.toHaveTextContent("3,0");
  });

  it("uses the many form for an average of five", () => {
    renderCards({ summary: { ...SUMMARY, averageQuotesPerQuotedBook: 5 } });

    expect(cardAt(1)).toHaveTextContent(/5\s*цитат(?!и)/);
  });

  it("names the most quoted book and author with their counts", () => {
    renderCards();

    expect(cardAt(2)).toHaveTextContent(/5\s*цитат(?!и)/);
    expect(cardAt(2)).toHaveTextContent("Дюна");
    expect(cardAt(3)).toHaveTextContent(/9\s*цитат(?!и)/);
    expect(cardAt(3)).toHaveTextContent("Френк Герберт");
  });

  it("counts the leading books instead of naming a winner when they tie", () => {
    renderCards({
      summary: { ...SUMMARY, topBook: { leadersCount: 3, quotesCount: 5, title: null } },
    });

    expect(cardAt(2)).toHaveTextContent("3 книги мають максимум");
    expect(cardAt(2)).not.toHaveTextContent("Дюна");
  });

  it("counts the leading authors instead of naming a winner when they tie", () => {
    renderCards({
      summary: {
        ...SUMMARY,
        topAuthor: { leadersCount: 5, name: null, quotesCount: 9 },
      },
    });

    expect(cardAt(3)).toHaveTextContent("5 авторів мають максимум");
    expect(cardAt(3)).not.toHaveTextContent("Френк Герберт");
  });

  it("calls out a library where every quoted book holds exactly one quote", () => {
    renderCards({
      summary: {
        ...SUMMARY,
        quotedBooksCount: 8,
        topBook: { leadersCount: 8, quotesCount: 1, title: null },
      },
    });

    expect(cardAt(2)).toHaveTextContent(copy.allBooksSingleQuote);
  });

  it("keeps the generic leaders phrase when every book ties above one quote", () => {
    renderCards({
      summary: {
        ...SUMMARY,
        quotedBooksCount: 8,
        topBook: { leadersCount: 8, quotesCount: 3, title: null },
      },
    });

    expect(cardAt(2)).toHaveTextContent("8 книг мають максимум");
    expect(cardAt(2)).not.toHaveTextContent(copy.allBooksSingleQuote);
  });

  it("keeps a tied top book free of any link or button", () => {
    renderCards({
      summary: { ...SUMMARY, topBook: { leadersCount: 3, quotesCount: 5, title: null } },
    });

    for (const card of statCards()) {
      expect(card.querySelector("a")).toBeNull();
      expect(card.querySelector("a[href]")).toBeNull();
      expect(card.querySelector('[role="button"]')).toBeNull();
      expect(card.querySelector("[tabindex]")).toBeNull();
    }
  });

  it("clamps a very long title instead of stretching the row", () => {
    const title = "Дюна ".repeat(60).trim();
    renderCards({
      summary: { ...SUMMARY, topBook: { leadersCount: 1, quotesCount: 5, title } },
    });

    const clamped = cardAt(2).querySelector(".line-clamp-2");
    expect(clamped).toHaveTextContent(title);
  });

  it("falls back to a dash on every card when nothing was quoted yet", () => {
    renderCards({ summary: EMPTY_SUMMARY });

    expect(cardAt(0)).toHaveTextContent(/0\s*книг/);
    expect(cardAt(0)).toHaveTextContent(copy.noQuotesYet);
    expect(cardAt(1)).toHaveTextContent(copy.empty);
    expect(cardAt(1)).toHaveTextContent(copy.noDataYet);
    expect(cardAt(1)).not.toHaveTextContent("цитат");
    expect(cardAt(2)).toHaveTextContent(copy.empty);
    expect(cardAt(2)).toHaveTextContent(copy.noQuotesYet);
    expect(cardAt(3)).toHaveTextContent(copy.empty);
    expect(cardAt(3)).toHaveTextContent(copy.noQuotesYet);
  });

  it("separates missing author data from having no quotes at all", () => {
    renderCards({ summary: { ...SUMMARY, topAuthor: null } });

    expect(cardAt(3)).toHaveTextContent(copy.empty);
    expect(cardAt(3)).toHaveTextContent(copy.noAuthorData);
  });

  it("shows placeholders instead of cards while the summary loads", () => {
    renderCards({ isLoading: true, summary: undefined });

    expect(statCards()).toHaveLength(0);
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      LAYOUT.cardCount * (LAYOUT.gridSkeletonsPerCard + LAYOUT.mobileSkeletonsPerTile),
    );
  });

  it("keeps the compact tiles numeric and leaves the names to the detailed card", () => {
    renderCards();

    expect(mobileTile(copy.mobile.compact.quotedBooks)).toHaveTextContent("8");
    expect(mobileTile(copy.mobile.compact.averagePerBook)).toHaveTextContent("2,9");
    expect(mobileTile(copy.mobile.compact.topBook)).toHaveTextContent("5");
    expect(mobileTile(copy.mobile.compact.topBook)).not.toHaveTextContent("Дюна");
    expect(mobileTile(copy.mobile.compact.topAuthor)).toHaveTextContent("9");
    expect(mobileTile(copy.mobile.compact.topAuthor)).not.toHaveTextContent("Френк Герберт");
    expect(cardAt(2)).toHaveTextContent("Дюна");
    expect(cardAt(3)).toHaveTextContent("Френк Герберт");
  });

  it("falls back to a dash on the mobile tiles when nothing was quoted yet", () => {
    renderCards({ summary: EMPTY_SUMMARY });

    expect(mobileTile(copy.mobile.compact.topBook)).toHaveTextContent(copy.empty);
    expect(mobileTile(copy.mobile.compact.topAuthor)).toHaveTextContent(copy.empty);
  });

  it("renders nothing when the summary request failed", () => {
    const { container } = renderCards({ isError: true });

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the mobile action reachable when the summary request failed", () => {
    renderCards({ isError: true, mobileAction: <button type="button">Огляд цитат</button> });

    expect(statCards()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Огляд цитат" })).toBeInTheDocument();
  });
});
