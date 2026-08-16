import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { OrderItemPriceDialog } from "./order-item-price-dialog";

const orderedBook = makeBookView({
  delivery: {
    active: {
      cancelledAt: null,
      cancelReason: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      currency: "UAH",
      deliveryService: "Нова Пошта",
      expectedDeliveryDate: "2026-08-20",
      id: "order-item-1",
      note: null,
      orderDate: "2026-08-01",
      orderNumber: "QA-1",
      price: 150,
      receivedAt: null,
      status: "in_transit",
      storeName: "Yakaboo",
      trackingNumber: "TTN-1",
      trackingUrl: null,
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
    latest: null,
    totalCount: 1,
  },
  id: "book-1",
  ownershipStatus: "in_transit",
  title: "Поклик з могили",
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(orderedBook), {
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function patchCall(): [string, RequestInit] | undefined {
  return fetchMock.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
  ) as [string, RequestInit] | undefined;
}

describe("OrderItemPriceDialog", () => {
  it("asks only for the price and sends nothing else", async () => {
    renderWithProviders(<OrderItemPriceDialog bookId="book-1" onOpenChange={vi.fn()} open />);

    const priceInput = await screen.findByLabelText("Вартість");
    expect(priceInput).toHaveValue(150);
    expect(screen.queryByLabelText("Магазин")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Номер замовлення")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Статус доставки")).not.toBeInTheDocument();

    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "199");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchCall()).toBeDefined());
    const call = patchCall();
    if (call === undefined) throw new Error("Price update was not sent");
    expect(JSON.parse(String(call[1].body))).toEqual({ price: 199 });
  });

  it("clears the price when the field is left empty", async () => {
    renderWithProviders(<OrderItemPriceDialog bookId="book-1" onOpenChange={vi.fn()} open />);

    const priceInput = await screen.findByLabelText("Вартість");
    await userEvent.clear(priceInput);
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchCall()).toBeDefined());
    const call = patchCall();
    if (call === undefined) throw new Error("Price update was not sent");
    expect(JSON.parse(String(call[1].body))).toEqual({ price: null });
  });

  it("refuses a price that is not a positive amount", async () => {
    renderWithProviders(<OrderItemPriceDialog bookId="book-1" onOpenChange={vi.fn()} open />);

    const priceInput = await screen.findByLabelText("Вартість");
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "0");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Вартість має бути більшою за 0.");
    expect(patchCall()).toBeUndefined();
  });
});
