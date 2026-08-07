import "@testing-library/jest-dom/vitest";

import type { ReadingQueueSummaryView } from "@app/shared";

import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { QueueSummaryCards } from "./queue-summary-cards";

const copy = messages.readingQueue.stats;

const MOBILE_TILE_SKELETONS = 12;
const GRID_CARD_SKELETONS = 16;

const SUMMARY: ReadingQueueSummaryView = {
  availableNowCount: 5,
  blockedBySeriesOrderCount: 2,
  seriesBooksCount: 6,
  seriesInQueueCount: 3,
  standaloneBooksCount: 4,
  totalCount: 10,
  unavailableByOwnership: { inTransit: 2, lentToSomeone: 0, none: 0, wantToBuy: 1 },
  unavailableCount: 3,
};

const EMPTY_SUMMARY: ReadingQueueSummaryView = {
  availableNowCount: 0,
  blockedBySeriesOrderCount: 0,
  seriesBooksCount: 0,
  seriesInQueueCount: 0,
  standaloneBooksCount: 0,
  totalCount: 0,
  unavailableByOwnership: { inTransit: 0, lentToSomeone: 0, none: 0, wantToBuy: 0 },
  unavailableCount: 0,
};

function card(label: string): HTMLElement {
  const found = screen.getByText(label).closest('[data-slot="stat-card"]');
  if (found === null) throw new Error(`Stat card not found: ${label}`);
  return found as HTMLElement;
}

function renderCards(props: Partial<Parameters<typeof QueueSummaryCards>[0]> = {}) {
  renderWithProviders(
    <QueueSummaryCards isLoading={false} seriesWithIssuesCount={1} summary={SUMMARY} {...props} />,
  );
}

describe("QueueSummaryCards", () => {
  it("renders the four queue metrics with their values", () => {
    renderCards();

    expect(document.querySelectorAll('[data-slot="stat-card"]')).toHaveLength(4);
    expect(card(copy.total.label)).toHaveTextContent(/10\s*книг/);
    expect(card(copy.availableNow.label)).toHaveTextContent(/5\s*книг/);
    expect(card(copy.unavailable.label)).toHaveTextContent(/3\s*книги/);
    expect(card(copy.seriesInQueue.label)).toHaveTextContent(/3\s*серії/);
  });

  it("splits the total into series and standalone books", () => {
    renderCards();

    expect(screen.getByText("6 із серій · 4 окремих")).toBeInTheDocument();
    expect(screen.getByText(copy.availableNow.caption)).toBeInTheDocument();
  });

  it("omits zero ownership categories from the unavailable caption", () => {
    renderCards();

    expect(screen.getByText("1 у списку бажань · 2 в дорозі")).toBeInTheDocument();
  });

  it("splits the series count into healthy and problematic ones", () => {
    renderCards();

    expect(screen.getByText("2 без проблем · 1 потребує уваги")).toBeInTheDocument();
  });

  it("keeps every card visible when the queue is empty", () => {
    renderCards({ seriesWithIssuesCount: 0, summary: EMPTY_SUMMARY });

    expect(card(copy.unavailable.label)).toHaveTextContent(/0\s*книг/);
    expect(card(copy.seriesInQueue.label)).toHaveTextContent(/0\s*серій/);
  });

  it("keeps the cards non-interactive", () => {
    renderCards();

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    for (const element of document.querySelectorAll('[data-slot="stat-card"]')) {
      expect(element).not.toHaveAttribute("tabindex");
      expect(element).not.toHaveAttribute("aria-pressed");
    }
  });

  it("renders placeholders instead of cards while the summary loads", () => {
    renderCards({ isLoading: true, summary: null });

    expect(document.querySelectorAll('[data-slot="stat-card"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      MOBILE_TILE_SKELETONS + GRID_CARD_SKELETONS,
    );
  });
});
