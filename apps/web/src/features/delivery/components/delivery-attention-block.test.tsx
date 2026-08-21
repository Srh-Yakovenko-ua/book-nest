import "@testing-library/jest-dom/vitest";

import type { InTransitAttention } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { DeliveryAttentionBlock } from "./delivery-attention-block";

const ALL_SIX: InTransitAttention[] = [
  { count: 2, expiredCount: 0, nearestPickupUntil: null, reason: "pickup_expiring" },
  { count: 3, maxDelayDays: 4, reason: "delayed" },
  { count: 1, maxWaitingDays: 9, reason: "awaiting_dispatch" },
  { count: 5, reason: "without_tracking" },
  { count: 6, reason: "without_expected_date" },
  { count: 4, ordersCount: 2, reason: "unassigned_books", revealOrderId: "order-1" },
];

function renderBlock(attention: InTransitAttention[]) {
  const onSelect = vi.fn();

  renderWithProviders(
    <DeliveryAttentionBlock
      activeReason={null}
      attention={attention}
      isLoading={false}
      onSelect={onSelect}
    />,
  );

  return { onSelect };
}

function rowLabels(): string[] {
  return screen.getAllByRole("button").map((row) => row.textContent ?? "");
}

describe("DeliveryAttentionBlock", () => {
  it("tells the reader everything is fine when nothing needs acting on", () => {
    renderBlock([]);

    expect(screen.getByText("Усе гаразд")).toBeInTheDocument();
    expect(screen.getByText("Немає доставок, які потребують вашої уваги.")).toBeInTheDocument();
  });

  it("shows four cases and offers the rest behind one row", async () => {
    renderBlock(ALL_SIX);

    expect(rowLabels()).toHaveLength(5);
    expect(rowLabels().at(-1)).toBe("Показати всі 6");
    expect(screen.queryByText(/без дати доставки/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати всі 6" }));

    expect(rowLabels()).toHaveLength(6);
    expect(screen.getByText("6 посилок без дати доставки")).toBeInTheDocument();
    expect(screen.queryByText("Показати всі 6")).not.toBeInTheDocument();
  });

  it("keeps every case on screen when they fit", () => {
    renderBlock(ALL_SIX.slice(0, 4));

    expect(rowLabels()).toHaveLength(4);
    expect(screen.queryByText(/Показати всі/)).not.toBeInTheDocument();
  });

  it("asks for the picked reason when a row is clicked", async () => {
    const { onSelect } = renderBlock(ALL_SIX);

    await userEvent.click(screen.getByText("3 посилки затримуються"));

    expect(onSelect).toHaveBeenCalledWith("delayed");
  });

  it("reads the counts through the ukrainian plural forms", () => {
    renderBlock([
      { count: 1, maxDelayDays: 1, reason: "delayed" },
      { count: 5, maxWaitingDays: 12, reason: "awaiting_dispatch" },
    ]);

    expect(screen.getByText("1 посилка затримується")).toBeInTheDocument();
    expect(screen.getByText("Найдовша затримка — 1 день")).toBeInTheDocument();
    expect(screen.getByText("5 замовлень не відправлено понад 7 днів")).toBeInTheDocument();
    expect(screen.getByText("Найдовше очікування — 12 днів")).toBeInTheDocument();
  });
});
