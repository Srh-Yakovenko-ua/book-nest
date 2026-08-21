import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { DeliveryAdvancedState } from "../model/in-transit-params";

import { DELIVERY_ADVANCED_EMPTY } from "../model/in-transit-params";
import { DeliveryToolbar } from "./delivery-toolbar";

const FILTER_COUNTS = {
  all: 12,
  delayed: 3,
  in_transit: 5,
  ordered: 6,
  ready_for_pickup: 1,
};

function advancedState(overrides: Partial<DeliveryAdvancedState> = {}): DeliveryAdvancedState {
  return { ...DELIVERY_ADVANCED_EMPTY, ...overrides };
}

function chipNames(): string[] {
  return screen.getAllByRole("radio").map((chip) => chip.textContent ?? "");
}

async function removeChip(label: string): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: `Прибрати фільтр ${label}` }));
}

function renderToolbar(overrides: Partial<ComponentProps<typeof DeliveryToolbar>> = {}) {
  const onApplyAdvanced = vi.fn();
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
      onApplyAdvanced={onApplyAdvanced}
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

  return { onApplyAdvanced, onClearAll, onFilterChange, onSortChange };
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

  it("hands the whole chip row back to the page when everything is cleared", async () => {
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

describe("DeliveryToolbar advanced filter chips", () => {
  it("names every picked store on a chip of its own", () => {
    renderToolbar({ advanced: advancedState({ store: ["Yakaboo", "Book24"] }), advancedCount: 1 });

    expect(screen.getByText("Магазин: Yakaboo")).toBeInTheDocument();
    expect(screen.getByText("Магазин: Book24")).toBeInTheDocument();
    expect(screen.queryByText(/Розширені фільтри/)).not.toBeInTheDocument();
  });

  it("drops a single store and leaves the other filters applied", async () => {
    const advanced = advancedState({
      booksMin: 2,
      service: ["Нова пошта"],
      store: ["Yakaboo", "Book24"],
    });
    const { onApplyAdvanced } = renderToolbar({ advanced, advancedCount: 3 });

    await removeChip("Магазин: Yakaboo");

    expect(onApplyAdvanced).toHaveBeenCalledWith({ ...advanced, store: ["Book24"] });
  });

  it("spells out a date range on one chip and clears both bounds with it", async () => {
    const advanced = advancedState({
      orderedFrom: "2026-08-01",
      orderedTo: "2026-08-20",
      store: ["Yakaboo"],
    });
    const { onApplyAdvanced } = renderToolbar({ advanced, advancedCount: 2 });

    expect(
      screen.getByText("Дата замовлення: 1 серп. 2026 р. – 20 серп. 2026 р."),
    ).toBeInTheDocument();

    await removeChip("Дата замовлення: 1 серп. 2026 р. – 20 серп. 2026 р.");

    expect(onApplyAdvanced).toHaveBeenCalledWith({
      ...advanced,
      orderedFrom: null,
      orderedTo: null,
    });
  });

  it("keeps the picked currencies when the order total chip is removed", async () => {
    const advanced = advancedState({ currency: ["UAH"], priceMax: 500, priceMin: 100 });
    const { onApplyAdvanced } = renderToolbar({ advanced, advancedCount: 2 });

    expect(screen.getByText("Вартість: 100–500 UAH")).toBeInTheDocument();

    await removeChip("Вартість: 100–500 UAH");

    expect(onApplyAdvanced).toHaveBeenCalledWith({
      ...advanced,
      priceMax: null,
      priceMin: null,
    });
  });

  it("holds the order total back while more than one currency is picked", () => {
    renderToolbar({
      advanced: advancedState({ currency: ["UAH", "EUR"], priceMax: 500, priceMin: 100 }),
      advancedCount: 1,
    });

    expect(screen.queryByText(/^Вартість:/)).not.toBeInTheDocument();
    expect(screen.getByText("UAH")).toBeInTheDocument();
    expect(screen.getByText("EUR")).toBeInTheDocument();
  });

  it("says nothing about a range that reads backwards", () => {
    renderToolbar({
      advanced: advancedState({ booksMax: 2, booksMin: 5, store: ["Yakaboo"] }),
      advancedCount: 2,
    });

    expect(screen.queryByText(/Кількість книг/)).not.toBeInTheDocument();
    expect(screen.getByText("Магазин: Yakaboo")).toBeInTheDocument();
  });

  it("keeps the attention chip in front of the advanced ones", () => {
    renderToolbar({
      advanced: advancedState({ structure: ["no_shipment"] }),
      advancedCount: 1,
      filter: "no_delivery_date",
    });

    const row = screen.getByRole("group", { name: "Активні фільтри" });
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Прибрати фільтр Увага: Без дати доставки", "Прибрати фільтр Ще без посилки", null]);
  });
});

describe("DeliveryToolbar selection", () => {
  it("stays out of the toolbar while nothing on the page can be selected", () => {
    renderToolbar();

    expect(screen.queryByRole("button", { name: "Вибрати" })).not.toBeInTheDocument();
  });

  it("offers the selection toggle once a parcel can be selected", async () => {
    const onToggle = vi.fn();
    renderToolbar({ selection: { isSelecting: false, onToggle } });

    const toggle = screen.getByRole("button", { name: "Вибрати" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("offers the way out while the page is in selection mode", () => {
    renderToolbar({ selection: { isSelecting: true, onToggle: vi.fn() } });

    expect(screen.getByRole("button", { name: "Завершити вибір" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("DeliveryToolbar sorting", () => {
  it("spells out the criterion and the direction on the desktop select", () => {
    renderToolbar({ advanced: advancedState({ currency: ["UAH"] }), sort: "price" });

    expect(screen.getByRole("combobox", { name: "Сортування" })).toHaveTextContent(
      "За вартістю замовлення: від нижчої",
    );
  });

  it("holds the order-total sort back until a single currency gates it", async () => {
    renderToolbar();

    await userEvent.click(screen.getByRole("combobox", { name: "Сортування" }));

    const option = await screen.findByRole("option", {
      name: /За вартістю замовлення: від нижчої/,
    });
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveTextContent("Оберіть одну валюту, щоб сортувати за вартістю");
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
