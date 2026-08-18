import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { DeliveryToolbar } from "./delivery-toolbar";

const FILTER_COUNTS = {
  all: 12,
  delayed: 3,
  in_transit: 5,
  ordered: 6,
  ready_for_pickup: 1,
};

function chipNames(): string[] {
  return screen.getAllByRole("radio").map((chip) => chip.textContent ?? "");
}

function renderToolbar(overrides: Partial<ComponentProps<typeof DeliveryToolbar>> = {}) {
  const onFilterChange = vi.fn();

  renderWithProviders(
    <DeliveryToolbar
      counterLabel="12 книжок"
      filter="all"
      isPending={false}
      loadingLabel="Завантаження"
      onClearSearch={vi.fn()}
      onFilterChange={onFilterChange}
      onSearch={vi.fn()}
      onSortChange={vi.fn()}
      searchValue=""
      sort="closest_delivery"
      {...overrides}
    />,
  );

  return { onFilterChange };
}

describe("DeliveryToolbar quick filters", () => {
  it("offers the shipment statuses plus the delayed attention chip", () => {
    renderToolbar();

    expect(chipNames()).toEqual([
      "Усі",
      "Очікують відправлення",
      "В дорозі",
      "Готові до отримання",
      "Затримуються",
    ]);
  });

  it("shows how many books sit behind each chip", () => {
    renderToolbar({ filterCounts: FILTER_COUNTS });

    expect(chipNames()).toEqual([
      "Усі12",
      "Очікують відправлення6",
      "В дорозі5",
      "Готові до отримання1",
      "Затримуються3",
    ]);
  });

  it("asks for the picked filter when a chip is clicked", async () => {
    const { onFilterChange } = renderToolbar({ filterCounts: FILTER_COUNTS });

    await userEvent.click(screen.getByRole("radio", { name: /Затримуються/ }));

    expect(onFilterChange).toHaveBeenCalledWith("delayed");
  });
});
