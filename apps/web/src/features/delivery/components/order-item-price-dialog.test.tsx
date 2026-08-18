import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeDeliveryOrderBookModel } from "./delivery.fixtures";
import { OrderItemPriceDialog } from "./order-item-price-dialog";

const orderedBook = makeDeliveryOrderBookModel({
  bookHref: "/books/book-1",
  bookId: "book-1",
  currency: "UAH",
  id: "order-item-1",
  price: 150,
  priceText: "150 UAH",
  title: "Поклик з могили",
});

const savedBook = makeBookView({
  id: "book-1",
  ownershipStatus: "in_transit",
  title: "Поклик з могили",
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(savedBook), {
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
  it("shows the price the list already knows without asking the server for it", () => {
    renderWithProviders(<OrderItemPriceDialog book={orderedBook} onOpenChange={vi.fn()} open />);

    expect(screen.getByLabelText("Вартість")).toHaveValue(150);
    expect(screen.getByText("UAH")).toBeInTheDocument();
    expect(
      screen.getByText("Оновіть, скільки коштувала книга «Поклик з могили» у цьому замовленні."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks only for the price and sends nothing else", async () => {
    renderWithProviders(<OrderItemPriceDialog book={orderedBook} onOpenChange={vi.fn()} open />);

    const priceInput = screen.getByLabelText("Вартість");
    expect(screen.queryByLabelText("Магазин")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Номер замовлення")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Статус доставки")).not.toBeInTheDocument();

    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "199");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchCall()).toBeDefined());
    const call = patchCall();
    if (call === undefined) throw new Error("Price update was not sent");
    expect(call[0]).toContain("/api/books/book-1/deliveries/order-item-1");
    expect(JSON.parse(String(call[1].body))).toEqual({ price: 199 });
  });

  it("clears the price when the field is left empty", async () => {
    renderWithProviders(<OrderItemPriceDialog book={orderedBook} onOpenChange={vi.fn()} open />);

    await userEvent.clear(screen.getByLabelText("Вартість"));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchCall()).toBeDefined());
    const call = patchCall();
    if (call === undefined) throw new Error("Price update was not sent");
    expect(JSON.parse(String(call[1].body))).toEqual({ price: null });
  });

  it("refuses a price that is not a positive amount", async () => {
    renderWithProviders(<OrderItemPriceDialog book={orderedBook} onOpenChange={vi.fn()} open />);

    const priceInput = screen.getByLabelText("Вартість");
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "0");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Вартість має бути більшою за 0.");
    expect(patchCall()).toBeUndefined();
  });

  it("warns that the order total is about to be cleared when the flag is on", () => {
    renderWithProviders(
      <OrderItemPriceDialog
        book={{ ...orderedBook, resetsOrderTotal: true }}
        onOpenChange={vi.fn()}
        open
      />,
    );

    expect(
      screen.getByText(
        "Загальну суму замовлення буде скинуто, бо ціна вказана не для всіх книг. Ви зможете ввести її знову в «Редагувати замовлення».",
      ),
    ).toBeInTheDocument();
  });

  it("stays silent when the order total survives the edit", () => {
    renderWithProviders(<OrderItemPriceDialog book={orderedBook} onOpenChange={vi.fn()} open />);

    expect(
      screen.queryByText(
        "Загальну суму замовлення буде скинуто, бо ціна вказана не для всіх книг. Ви зможете ввести її знову в «Редагувати замовлення».",
      ),
    ).not.toBeInTheDocument();
  });
});
