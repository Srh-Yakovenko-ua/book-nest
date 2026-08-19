import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { DELIVERY_ADVANCED_EMPTY } from "../model/in-transit-params";
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
  const onClearAll = vi.fn();
  const onFilterChange = vi.fn();
  const onSortChange = vi.fn();

  renderWithProviders(
    <DeliveryToolbar
      advanced={DELIVERY_ADVANCED_EMPTY}
      advancedCount={0}
      counterLabel="12 книжок"
      filter="all"
      isPending={false}
      loadingLabel="Завантаження"
      onApplyAdvanced={vi.fn()}
      onClearAdvanced={vi.fn()}
      onClearAll={onClearAll}
      onClearSearch={vi.fn()}
      onFilterChange={onFilterChange}
      onSearch={vi.fn()}
      onSortChange={onSortChange}
      searchValue=""
      sort="closest_delivery"
      {...overrides}
    />,
  );

  return { onClearAll, onFilterChange, onSortChange };
}

describe("DeliveryToolbar quick filters", () => {
  it("offers the five shipment statuses and nothing else", () => {
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

describe("DeliveryToolbar attention filter", () => {
  it("keeps the quick filters untouched when an attention problem is filtering the list", () => {
    renderToolbar({ filter: "awaiting_dispatch", filterCounts: FILTER_COUNTS });

    expect(chipNames()).toEqual([
      "Усі12",
      "Очікують відправлення6",
      "В дорозі5",
      "Готові до отримання1",
      "Затримуються3",
    ]);
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

  it("names the attention problem as a removable active filter", () => {
    renderToolbar({ filter: "no_delivery_date" });

    expect(screen.getByText("Увага: Без дати доставки")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Прибрати фільтр Увага: Без дати доставки" }),
    ).toBeInTheDocument();
  });

  it("returns to every delivery when the attention filter is removed", async () => {
    const { onFilterChange } = renderToolbar({ filter: "unassigned" });

    await userEvent.click(
      screen.getByRole("button", { name: "Прибрати фільтр Увага: Не розподілені книги" }),
    );

    expect(onFilterChange).toHaveBeenCalledWith("all");
  });

  it("wipes the search along with the filter when everything is cleared", async () => {
    const { onClearAll } = renderToolbar({ filter: "pickup_expiring", searchValue: "Хобб" });

    await userEvent.click(screen.getByRole("button", { name: "Очистити все" }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("stays out of the way while a primary quick filter is active", () => {
    renderToolbar({ filter: "delayed" });

    expect(screen.queryByText(/^Увага:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Очистити все" })).not.toBeInTheDocument();
  });
});

describe("DeliveryToolbar sorting", () => {
  it("spells out the criterion and the direction on the desktop select", () => {
    renderToolbar({ sort: "price" });

    expect(screen.getByRole("combobox", { name: "Сортування" })).toHaveTextContent(
      "За ціною: від нижчої",
    );
  });

  it("shortens the same order down to a chip on the mobile trigger", () => {
    renderToolbar({ sort: "newest_orders" });

    expect(screen.getByRole("button", { name: "Сортування" })).toHaveTextContent("Замовлення ↓");
  });

  it("groups the orders by criterion inside the drawer", async () => {
    renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Сортування" }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Дата замовлення")).toBeInTheDocument();
    expect(within(sheet).getByText("Спочатку нові")).toBeInTheDocument();
    expect(within(sheet).getByText("Спочатку старі")).toBeInTheDocument();
    expect(within(sheet).getByText("Від нижчої")).toBeInTheDocument();
  });

  it("asks for the picked order and closes the drawer", async () => {
    const { onSortChange } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Сортування" }));

    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByText("Спочатку нові"));

    expect(onSortChange).toHaveBeenCalledWith("newest_orders");
    await waitFor(() => expect(sheet).toHaveAttribute("data-state", "closed"));
  });
});
