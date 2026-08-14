import "@testing-library/jest-dom/vitest";

import type { ComponentProps, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { DeliveryOrderCardModel } from "../model/order-card-model";

import { DeliveryOrderCard } from "./delivery-order-card";
import {
  deliveryOrderCards,
  makeDeliveryOrderBookModel,
  makeDeliveryOrderCardModel,
  makeDeliveryShipmentGroupModel,
} from "./delivery.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function bookListAt(index: number): HTMLElement {
  const list = screen.getAllByRole("list")[index];
  if (list === undefined) throw new Error(`no shipment book list at index ${index}`);
  return list;
}

function renderCard(
  model: DeliveryOrderCardModel,
  overrides: Partial<ComponentProps<typeof DeliveryOrderCard>> = {},
) {
  return renderWithProviders(
    <DeliveryOrderCard
      model={model}
      onCancelBook={vi.fn()}
      onEditBook={vi.fn()}
      onReceiveBook={vi.fn()}
      onReceiveShipment={vi.fn()}
      onToggleSelectBook={vi.fn()}
      receivePendingBookId={null}
      selectedBookIds={new Set<string>()}
      {...overrides}
    />,
  );
}

describe("DeliveryOrderCard", () => {
  it("shows the store, the order meta and the shipment details once for a multi-book shipment", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.getAllByText("Читайлик")).toHaveLength(1);
    expect(screen.getAllByText(/ORD-10298/)).toHaveLength(1);
    expect(screen.getAllByText("Нова Пошта")).toHaveLength(1);
    expect(screen.getAllByText("20450099887766")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /Відкрити трекінг/ })).toHaveLength(1);
  });

  it("renders every book of a multi-book shipment", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.getByRole("link", { name: "Страх мудреця" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Солодка Даруся" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("gives each shipment its own book list", () => {
    renderCard(deliveryOrderCards.multiShipment);

    expect(within(bookListAt(0)).getAllByRole("listitem")).toHaveLength(1);
    expect(within(bookListAt(0)).getByText("Нічний цирк")).toBeInTheDocument();
    expect(within(bookListAt(0)).queryByText("Американські боги")).not.toBeInTheDocument();

    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(2);
    expect(within(bookListAt(1)).getByText("Американські боги")).toBeInTheDocument();
    expect(within(bookListAt(1)).getByText("Пісня Ахілла")).toBeInTheDocument();
    expect(within(bookListAt(1)).queryByText("Нічний цирк")).not.toBeInTheDocument();
  });

  it("receives only the books of the shipment whose button was pressed", async () => {
    const onReceiveShipment = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onReceiveShipment });

    await userEvent.click(screen.getByRole("button", { name: "Позначити книгу отриманою" }));

    expect(onReceiveShipment).toHaveBeenCalledTimes(1);
    expect(onReceiveShipment).toHaveBeenCalledWith(["book-4"]);
  });

  it("receives every book of the shipment holding several of them", async () => {
    const onReceiveShipment = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onReceiveShipment });

    await userEvent.click(screen.getByRole("button", { name: "Позначити 2 книги отриманими" }));

    expect(onReceiveShipment).toHaveBeenCalledWith(["book-5", "book-6"]);
  });

  it("marks a single book received from its row menu", async () => {
    const book = makeDeliveryOrderBookModel({ bookId: "book-42", title: "Амадока" });
    const onReceiveBook = vi.fn();
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [makeDeliveryShipmentGroupModel({ books: [book] })],
      }),
      { onReceiveBook },
    );

    await userEvent.click(screen.getByRole("button", { name: "Дії для «Амадока»" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Позначити як отриману" }));

    expect(onReceiveBook).toHaveBeenCalledWith(book);
  });

  it("edits a single book from its row menu", async () => {
    const onEditBook = vi.fn();
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [
          makeDeliveryShipmentGroupModel({
            books: [makeDeliveryOrderBookModel({ bookId: "book-42", title: "Амадока" })],
          }),
        ],
      }),
      { onEditBook },
    );

    await userEvent.click(screen.getByRole("button", { name: "Дії для «Амадока»" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Редагувати доставку" }));

    expect(onEditBook).toHaveBeenCalledWith("book-42");
  });

  it("cancels a single book from its row menu", async () => {
    const onCancelBook = vi.fn();
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [
          makeDeliveryShipmentGroupModel({
            books: [makeDeliveryOrderBookModel({ bookId: "book-42", title: "Амадока" })],
          }),
        ],
      }),
      { onCancelBook },
    );

    await userEvent.click(screen.getByRole("button", { name: "Дії для «Амадока»" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Скасувати замовлення" }));

    expect(onCancelBook).toHaveBeenCalledWith("book-42");
  });

  it("toggles the selection of the book whose checkbox was clicked", async () => {
    const onToggleSelectBook = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onToggleSelectBook });

    await userEvent.click(screen.getByRole("checkbox", { name: "Вибрати «Пісня Ахілла»" }));

    expect(onToggleSelectBook).toHaveBeenCalledTimes(1);
    expect(onToggleSelectBook).toHaveBeenCalledWith("book-6");
  });

  it("shows a selected book as checked and leaves the others unchecked", () => {
    renderCard(deliveryOrderCards.multiShipment, { selectedBookIds: new Set(["book-5"]) });

    expect(screen.getByRole("checkbox", { name: "Вибрати «Американські боги»" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Вибрати «Пісня Ахілла»" })).not.toBeChecked();
  });

  it("labels the group of books that has not been dispatched yet and still lists them", () => {
    renderCard(deliveryOrderCards.notShipped);

    expect(screen.getByText("Ще не відправлено")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Музей покинутих секретів" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Амадока" })).toBeInTheDocument();
  });
});
