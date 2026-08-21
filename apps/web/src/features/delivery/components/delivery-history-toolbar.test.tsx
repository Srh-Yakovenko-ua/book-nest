import "@testing-library/jest-dom/vitest";

import type { BookOrderHistoryFacetsView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { DeliveryHistoryAdvancedState } from "../model/history-params";

import { DELIVERY_HISTORY_ADVANCED_EMPTY } from "../model/history-params";
import { DeliveryHistoryToolbar } from "./delivery-history-toolbar";

const EMPTY_ADVANCED: DeliveryHistoryAdvancedState = DELIVERY_HISTORY_ADVANCED_EMPTY;

const FACETS: BookOrderHistoryFacetsView = {
  services: [
    { count: 2, name: "Нова Пошта" },
    { count: 1, name: "Укрпошта" },
  ],
  stores: [
    { count: 3, name: "Yakaboo" },
    { count: 1, name: "Book24" },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/delivery/books/history/facets")) {
      return Promise.resolve(
        new Response(JSON.stringify(FACETS), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const SORT_LABELS = [
  "За датою замовлення: спочатку нові",
  "За датою замовлення: спочатку старі",
  "За останніми змінами: спочатку нові",
  "За магазином: А–Я",
  "За вартістю замовлення: від нижчої",
  "За вартістю замовлення: від вищої",
];

async function openDesktopSort(): Promise<string[]> {
  await userEvent.click(screen.getByRole("combobox", { name: "Сортування" }));
  const options = await screen.findAllByRole("option");
  return options.map((option) => option.textContent ?? "");
}

function renderToolbar(overrides: Partial<ComponentProps<typeof DeliveryHistoryToolbar>> = {}) {
  const onApplyAdvanced = vi.fn();
  const onClearAdvanced = vi.fn();
  const onSortChange = vi.fn();
  const onTabChange = vi.fn();

  renderWithProviders(
    <DeliveryHistoryToolbar
      advanced={EMPTY_ADVANCED}
      advancedCount={0}
      canSortByPrice={false}
      counterLabel="6 замовлень"
      isPending={false}
      loadingLabel="Завантаження"
      onApplyAdvanced={onApplyAdvanced}
      onClearAdvanced={onClearAdvanced}
      onClearSearch={vi.fn()}
      onSearch={vi.fn()}
      onSortChange={onSortChange}
      onTabChange={onTabChange}
      searchValue=""
      sort="newest_orders"
      tab="received"
      {...overrides}
    />,
  );

  return { onApplyAdvanced, onClearAdvanced, onSortChange, onTabChange };
}

describe("DeliveryHistoryToolbar sorting", () => {
  it("spells out the criterion and the direction on the desktop select", () => {
    renderToolbar({ sort: "recently_updated" });

    expect(screen.getByRole("combobox", { name: "Сортування" })).toHaveTextContent(
      "За останніми змінами: спочатку нові",
    );
  });

  it("offers the same six orders in the same order on the received tab", async () => {
    renderToolbar({ canSortByPrice: true });

    expect(await openDesktopSort()).toEqual(SORT_LABELS);
  });

  it("offers the same six orders in the same order on the cancelled tab", async () => {
    renderToolbar({ canSortByPrice: true, tab: "cancelled" });

    expect(await openDesktopSort()).toEqual(SORT_LABELS);
  });

  it("holds both order-total sorts back until a single currency gates them", async () => {
    renderToolbar();

    await userEvent.click(screen.getByRole("combobox", { name: "Сортування" }));

    for (const name of [/від нижчої/, /від вищої/]) {
      const option = await screen.findByRole("option", { name });
      expect(option).toHaveAttribute("aria-disabled", "true");
      expect(option).toHaveTextContent("Оберіть одну валюту, щоб сортувати за вартістю");
    }
  });

  it("shortens the same order down to a chip on the mobile trigger", () => {
    renderToolbar({ sort: "oldest_orders" });

    expect(screen.getByRole("button", { name: "Сортування" })).toHaveTextContent("Замовлення ↑");
  });

  it("groups the orders by criterion inside the drawer", async () => {
    renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Сортування" }));

    const sheet = await screen.findByRole("dialog");
    for (const group of ["Дата замовлення", "Останні зміни", "Магазин", "Вартість замовлення"]) {
      expect(within(sheet).getByText(group)).toBeInTheDocument();
    }
    expect(within(sheet).getByText("Спочатку старі")).toBeInTheDocument();
    expect(within(sheet).getByText("Від нижчої")).toBeInTheDocument();
  });

  it("asks for the picked order and closes the drawer", async () => {
    const { onSortChange } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Сортування" }));

    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByText("Спочатку старі"));

    expect(onSortChange).toHaveBeenCalledWith("oldest_orders");
    await waitFor(() => expect(sheet).toHaveAttribute("data-state", "closed"));
  });
});

describe("DeliveryHistoryToolbar advanced filters", () => {
  async function openFilters() {
    await userEvent.click(screen.getByRole("button", { name: "Фільтри" }));
    return screen.findByRole("dialog");
  }

  it("opens a right sheet that says what the filters do", async () => {
    renderToolbar();

    const sheet = await openFilters();

    expect(within(sheet).getByText("Розширені фільтри")).toBeInTheDocument();
    expect(within(sheet).getByText("Звужують список замовлень.")).toBeInTheDocument();
  });

  it("asks the history facets for the tab that is open", async () => {
    renderToolbar({ tab: "cancelled" });

    await openFilters();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/delivery/books/history/facets?tab=cancelled"),
        expect.anything(),
      ),
    );
  });

  it("offers the stores the history actually holds", async () => {
    renderToolbar();

    const sheet = await openFilters();
    await userEvent.click(within(sheet).getByRole("button", { name: "Будь-який магазин" }));

    expect(await screen.findByText("Yakaboo")).toBeInTheDocument();
    expect(screen.getByText("Book24")).toBeInTheDocument();
  });

  it("counts the active dimensions on the trigger", () => {
    renderToolbar({ advancedCount: 3 });

    expect(screen.getByRole("button", { name: /Фільтри/ })).toHaveTextContent("3");
  });

  it("names the terminal date section after the received tab", async () => {
    renderToolbar();

    const sheet = await openFilters();

    expect(within(sheet).getByText("Дата отримання")).toBeInTheDocument();
    expect(within(sheet).queryByText("Дата скасування")).not.toBeInTheDocument();
    expect(within(sheet).getByLabelText("Отримано від")).toBeInTheDocument();
  });

  it("keeps the terminal date section named after the cancelled tab", async () => {
    renderToolbar({ tab: "cancelled" });

    const sheet = await openFilters();

    expect(within(sheet).getByText("Дата скасування")).toBeInTheDocument();
    expect(within(sheet).queryByText("Дата отримання")).not.toBeInTheDocument();
  });

  it("leaves none of the active-delivery-only sections behind", async () => {
    renderToolbar();

    const sheet = await openFilters();

    for (const gone of ["Очікувана дата доставки", "Структура доставки", "Є номер ТТН"]) {
      expect(within(sheet).queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("holds the order total back until exactly one currency is picked", async () => {
    renderToolbar();

    const sheet = await openFilters();

    expect(within(sheet).getByLabelText("Вартість від")).toBeDisabled();
    expect(
      within(sheet).getByText("Оберіть одну валюту, щоб фільтрувати за вартістю."),
    ).toBeInTheDocument();
  });

  it("opens the order total once a currency is picked", async () => {
    renderToolbar({ advanced: { ...EMPTY_ADVANCED, currency: ["UAH"] } });

    const sheet = await openFilters();

    expect(within(sheet).getByLabelText("Вартість від")).toBeEnabled();
  });

  it("hands the draft over only when Apply is pressed", async () => {
    const { onApplyAdvanced } = renderToolbar();

    const sheet = await openFilters();
    await userEvent.type(within(sheet).getByLabelText("Книг щонайменше"), "3");

    expect(onApplyAdvanced).not.toHaveBeenCalled();

    await userEvent.click(within(sheet).getByRole("button", { name: "Застосувати" }));

    expect(onApplyAdvanced).toHaveBeenCalledWith(
      expect.objectContaining({ booksMax: null, booksMin: 3 }),
    );
  });

  it("blocks Apply while a range runs backwards", async () => {
    renderToolbar({ advanced: { ...EMPTY_ADVANCED, booksMax: 2, booksMin: 9 } });

    const sheet = await openFilters();

    expect(within(sheet).getByRole("button", { name: "Застосувати" })).toBeDisabled();
    expect(within(sheet).getAllByText("Початок діапазону пізніший за його кінець")).toHaveLength(1);
  });
});

describe("DeliveryHistoryToolbar active filter chips", () => {
  it("shows one chip per value instead of a single aggregate", () => {
    renderToolbar({
      advanced: {
        ...EMPTY_ADVANCED,
        booksMax: 10,
        booksMin: 3,
        currency: ["UAH"],
        service: ["Нова Пошта"],
        store: ["Yakaboo"],
      },
    });

    for (const label of ["Магазин: Yakaboo", "Книг: 3–10", "Служба: Нова Пошта", "UAH"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Розширені фільтри: /)).not.toBeInTheDocument();
  });

  it("names the terminal range after the tab it belongs to", () => {
    renderToolbar({
      advanced: { ...EMPTY_ADVANCED, receivedFrom: "2026-08-01", receivedTo: "2026-08-20" },
    });

    expect(screen.getByText(/^Отримано: /)).toBeInTheDocument();
  });

  it("ignores a receipt range while the cancelled tab is open", () => {
    renderToolbar({
      advanced: { ...EMPTY_ADVANCED, receivedFrom: "2026-08-01" },
      tab: "cancelled",
    });

    expect(screen.queryByText(/^Отримано/)).not.toBeInTheDocument();
  });

  it("drops only its own value when a chip is removed", async () => {
    const { onApplyAdvanced } = renderToolbar({
      advanced: { ...EMPTY_ADVANCED, store: ["Yakaboo", "Book24"] },
    });

    await userEvent.click(screen.getByRole("button", { name: "Прибрати фільтр Магазин: Yakaboo" }));

    expect(onApplyAdvanced).toHaveBeenCalledWith(expect.objectContaining({ store: ["Book24"] }));
  });

  it("clears the whole range behind a range chip", async () => {
    const { onApplyAdvanced } = renderToolbar({
      advanced: { ...EMPTY_ADVANCED, booksMax: 10, booksMin: 3 },
    });

    await userEvent.click(screen.getByRole("button", { name: "Прибрати фільтр Книг: 3–10" }));

    expect(onApplyAdvanced).toHaveBeenCalledWith(
      expect.objectContaining({ booksMax: null, booksMin: null }),
    );
  });

  it("asks to clear only the advanced filters", async () => {
    const { onClearAdvanced } = renderToolbar({
      advanced: { ...EMPTY_ADVANCED, store: ["Yakaboo"] },
    });

    await userEvent.click(screen.getByRole("button", { name: "Очистити все" }));

    expect(onClearAdvanced).toHaveBeenCalledTimes(1);
  });
});
