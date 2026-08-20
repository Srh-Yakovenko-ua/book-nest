import "@testing-library/jest-dom/vitest";

import type { BookOrderHistoryOutcomeView } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { DeliveryLatestReceiptCardModel } from "../model/latest-receipt-card";

import { DeliveryHistoryReceivedBlocks } from "./delivery-history-sidebar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

function outcome(overrides: Partial<BookOrderHistoryOutcomeView> = {}) {
  return { seriesInsights: [], unreadReceived: null, ...overrides };
}

function receiptModel(
  overrides: Partial<DeliveryLatestReceiptCardModel> = {},
): DeliveryLatestReceiptCardModel {
  return {
    books: {
      countText: "4 книги",
      covers: [{ authorName: "Frank Herbert", bookHref: "/books/a", id: "a", title: "Дюна" }],
      kind: "stack",
    },
    orderId: "order-1",
    receivedDateText: "20 серп. 2026",
    relativeDayText: "Сьогодні",
    sameDayText: null,
    serviceName: "Нова пошта",
    shipmentId: "shipment-1",
    storeName: "Yakaboo",
    ...overrides,
  };
}

function renderSidebar({
  latestReceipt = receiptModel(),
  onRevealLatestReceipt = vi.fn(),
  outcomeView = outcome(),
  revealResetsFilters = false,
}: {
  latestReceipt?: DeliveryLatestReceiptCardModel | null;
  onRevealLatestReceipt?: () => void;
  outcomeView?: BookOrderHistoryOutcomeView;
  revealResetsFilters?: boolean;
} = {}) {
  return renderWithProviders(
    <DeliveryHistoryReceivedBlocks
      isOutcomeLoading={false}
      isReceiptLoading={false}
      latestReceipt={latestReceipt}
      onRevealLatestReceipt={onRevealLatestReceipt}
      outcome={outcomeView}
      revealResetsFilters={revealResetsFilters}
    />,
  );
}

describe("latest receipt block", () => {
  it("says nothing has arrived yet and offers no way in", () => {
    renderSidebar({ latestReceipt: null });

    expect(screen.getByText("Ще нічого не отримано")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Відкрити в історії/ })).not.toBeInTheDocument();
  });

  it("shows the day, the store, the service and the book count", () => {
    renderSidebar();

    expect(screen.getByText("Сьогодні")).toBeInTheDocument();
    expect(screen.getByText("20 серп. 2026")).toBeInTheDocument();
    expect(screen.getByText("Yakaboo")).toBeInTheDocument();
    expect(screen.getByText("Нова пошта")).toBeInTheDocument();
    expect(screen.getByText("4 книги")).toBeInTheDocument();
  });

  it("keeps the expected delivery date, the order number and the total out of the card", () => {
    renderSidebar({ latestReceipt: receiptModel({ sameDayText: "Ще 2 отримання цього дня" }) });

    expect(screen.getByText("Ще 2 отримання цього дня")).toBeInTheDocument();
    expect(screen.queryByText(/Очікується/)).not.toBeInTheDocument();
    expect(screen.queryByText(/₴/)).not.toBeInTheDocument();
  });

  it("asks the page to reveal the receipt in the list", async () => {
    const onRevealLatestReceipt = vi.fn();
    renderSidebar({ onRevealLatestReceipt });

    await userEvent.click(screen.getByRole("button", { name: /Відкрити в історії/ }));

    expect(onRevealLatestReceipt).toHaveBeenCalledOnce();
  });

  it("warns before it drops the filters that hide the receipt", () => {
    renderSidebar({ revealResetsFilters: true });

    expect(screen.getByText("Щоб показати, скинемо пошук і фільтри")).toBeInTheDocument();
  });
});

describe("waiting to be read block", () => {
  it("stays out entirely while nothing has been received", () => {
    renderSidebar();

    expect(screen.queryByText("Чекають на читання")).not.toBeInTheDocument();
  });

  it("counts the waiting books and the queue members among them", () => {
    renderSidebar({
      outcomeView: outcome({
        unreadReceived: {
          bookPreviews: [{ authorName: "Frank Herbert", cover: null, id: "a", title: "Дюна" }],
          booksCount: 18,
          inQueueCount: 4,
        },
      }),
    });

    expect(screen.getByText("Чекають на читання")).toBeInTheDocument();
    expect(screen.getByText("18 книг")).toBeInTheDocument();
    expect(screen.getByText("4 уже в черзі читання")).toBeInTheDocument();
  });

  it("says everything is read once no received book waits", () => {
    renderSidebar({
      outcomeView: outcome({
        unreadReceived: { bookPreviews: [], booksCount: 0, inQueueCount: 0 },
      }),
    });

    expect(screen.getByText("Усе прочитано")).toBeInTheDocument();
    expect(screen.getByText("Серед отриманих книг немає тих, що ще чекають.")).toBeInTheDocument();
  });
});

describe("how series filled up block", () => {
  it("stays out while the backend found no insight", () => {
    renderSidebar();

    expect(screen.queryByText("Як поповнилися серії")).not.toBeInTheDocument();
  });

  it("lists the insights the backend ranked, strongest first", () => {
    renderSidebar({
      outcomeView: outcome({
        seriesInsights: [
          { booksCount: 3, kind: "series_completed", seriesCount: 2 },
          { booksCount: 4, kind: "series_gaps_closed", seriesCount: 3 },
          { booksCount: 6, kind: "series_topped_up", seriesCount: 5 },
        ],
      }),
    });

    const rows = screen.getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("2 серії стали повними");
    expect(rows[1]).toHaveTextContent("У 3 серіях закрилися прогалини");
    expect(rows[2]).toHaveTextContent("Ще 5 серій поповнилися");
  });
});
