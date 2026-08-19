import "@testing-library/jest-dom/vitest";

import type { InTransitFacetsView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { DeliveryAdvancedState } from "../model/in-transit-params";

import { DELIVERY_ADVANCED_EMPTY } from "../model/in-transit-params";
import { DeliveryAdvancedFilters } from "./delivery-advanced-filters";

const FACETS: InTransitFacetsView = {
  services: [
    { count: 2, name: "Nova Poshta" },
    { count: 1, name: "Ukrposhta" },
  ],
  stores: [
    { count: 3, name: "Yakaboo" },
    { count: 1, name: "Book24" },
  ],
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

async function openPanel() {
  await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
  return screen.getByRole("dialog");
}

function renderFilters(state: DeliveryAdvancedState = DELIVERY_ADVANCED_EMPTY) {
  const onApply = vi.fn();

  renderWithProviders(<DeliveryAdvancedFilters activeCount={0} onApply={onApply} state={state} />);

  return { onApply };
}

function section(panel: HTMLElement, title: string): HTMLElement {
  const heading = within(panel).getByText(title);
  const box = heading.closest('[data-slot="filter-section"]');
  if (box === null) throw new Error(`Filter section not found: ${title}`);
  return box as HTMLElement;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/delivery/books/in-transit/facets")) {
      return Promise.resolve(jsonResponse(FACETS));
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeliveryAdvancedFilters", () => {
  it("keeps the draft to itself until the reader applies it", async () => {
    const { onApply } = renderFilters();
    const panel = await openPanel();

    await userEvent.click(within(panel).getByRole("button", { name: "Кілька посилок" }));

    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(within(panel).getByRole("button", { name: "Застосувати" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ structure: ["multiple_shipments"] }),
    );
  });

  it("empties the draft on reset without applying anything", async () => {
    const { onApply } = renderFilters({ ...DELIVERY_ADVANCED_EMPTY, structure: ["no_shipment"] });
    const panel = await openPanel();

    expect(within(panel).getByRole("button", { name: "Ще без посилки" })).toHaveAttribute(
      "data-state",
      "on",
    );

    await userEvent.click(within(panel).getByRole("button", { name: "Скинути" }));

    expect(within(panel).getByRole("button", { name: "Ще без посилки" })).toHaveAttribute(
      "data-state",
      "off",
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it("drops an edited draft when the panel is closed and reopened", async () => {
    renderFilters();
    const panel = await openPanel();

    await userEvent.click(within(panel).getByRole("button", { name: "Одна посилка" }));
    await userEvent.keyboard("{Escape}");

    const reopened = await openPanel();

    expect(within(reopened).getByRole("button", { name: "Одна посилка" })).toHaveAttribute(
      "data-state",
      "off",
    );
  });

  it("locks the total range until exactly one currency is chosen", async () => {
    renderFilters();
    const panel = await openPanel();
    const total = section(panel, "Вартість замовлення");

    expect(within(total).getByLabelText("Вартість від")).toBeDisabled();
    expect(
      within(total).getByText("Оберіть одну валюту, щоб фільтрувати за вартістю."),
    ).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "UAH" }));

    expect(within(total).getByLabelText("Вартість від")).toBeEnabled();

    await userEvent.click(within(panel).getByRole("button", { name: "EUR" }));

    expect(within(total).getByLabelText("Вартість від")).toBeDisabled();
  });

  it("carries the range straight through once a single currency gates it", async () => {
    const { onApply } = renderFilters({ ...DELIVERY_ADVANCED_EMPTY, currency: ["UAH"] });
    const panel = await openPanel();

    await userEvent.type(
      within(section(panel, "Вартість замовлення")).getByLabelText("Вартість від"),
      "100",
    );
    await userEvent.click(within(panel).getByRole("button", { name: "Застосувати" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ currency: ["UAH"], priceMin: 100 }),
    );
  });

  it("refuses to apply a range that reads backwards", async () => {
    renderFilters();
    const panel = await openPanel();
    const books = section(panel, "Кількість книг");

    await userEvent.type(within(books).getByLabelText("Книг від"), "9");
    await userEvent.type(within(books).getByLabelText("Книг до"), "2");

    expect(within(panel).getByRole("button", { name: "Застосувати" })).toBeDisabled();
    expect(within(books).getByText("Початок діапазону більший за кінець")).toBeInTheDocument();
  });

  it("offers the stores and services the deliveries actually run through", async () => {
    renderFilters();
    const panel = await openPanel();

    await userEvent.click(
      within(section(panel, "Магазин")).getByRole("button", { name: "Будь-який магазин" }),
    );

    expect(await screen.findByRole("option", { name: "Yakaboo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Book24" })).toBeInTheDocument();
  });
});
