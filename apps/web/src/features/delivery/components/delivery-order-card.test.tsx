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
      onManage={vi.fn()}
      onReceiveShipment={vi.fn()}
      onToggleSelectBook={vi.fn()}
      selectedBookIds={new Set<string>()}
      selectionMode={false}
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

  it("shows three books until the order is expanded", async () => {
    const books = Array.from({ length: 5 }, (_, index) =>
      makeDeliveryOrderBookModel({
        bookId: `book-${index}`,
        id: `item-${index}`,
        title: `Книга ${index + 1}`,
      }),
    );
    renderCard(
      makeDeliveryOrderCardModel({
        booksCount: books.length,
        shipments: [makeDeliveryShipmentGroupModel({ books })],
      }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Показати ще 2 книги" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Згорнути" })).toBeInTheDocument();
  });

  it("hides selection checkboxes outside selection mode", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps later shipment metadata visible while its books are collapsed", () => {
    const firstBooks = Array.from({ length: 3 }, (_, index) =>
      makeDeliveryOrderBookModel({ bookId: `first-${index}`, id: `first-item-${index}` }),
    );
    renderCard(
      makeDeliveryOrderCardModel({
        booksCount: 4,
        shipments: [
          makeDeliveryShipmentGroupModel({ books: firstBooks, serviceName: "Нова Пошта" }),
          makeDeliveryShipmentGroupModel({
            books: [makeDeliveryOrderBookModel({ bookId: "later", id: "later-item" })],
            id: "shipment-later",
            serviceName: "Укрпошта",
          }),
        ],
      }),
    );

    expect(screen.getByText("Укрпошта")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("exposes working order and shipment actions through their own menus", async () => {
    const onManage = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onManage });

    await userEvent.click(screen.getByRole("button", { name: "Дії із замовленням" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Редагувати замовлення" }));
    expect(onManage).toHaveBeenCalledWith({
      kind: "edit-order",
      order: deliveryOrderCards.multiShipment,
    });

    await userEvent.click(screen.getByRole("button", { name: "Дії: Посилка 1" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Редагувати посилку" }));
    expect(onManage).toHaveBeenCalledWith({
      kind: "edit-shipment",
      shipment: deliveryOrderCards.multiShipment.shipments[0],
    });
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
    await userEvent.click(await screen.findByRole("menuitem", { name: "Змінити ціну" }));

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
    await userEvent.click(await screen.findByRole("menuitem", { name: "Скасувати цю книгу" }));

    expect(onCancelBook).toHaveBeenCalledWith("book-42");
  });

  it("toggles the selection of the book whose checkbox was clicked", async () => {
    const onToggleSelectBook = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onToggleSelectBook, selectionMode: true });

    await userEvent.click(screen.getByRole("checkbox", { name: "Вибрати «Пісня Ахілла»" }));

    expect(onToggleSelectBook).toHaveBeenCalledTimes(1);
    expect(onToggleSelectBook).toHaveBeenCalledWith("book-6");
  });

  it("shows a selected book as checked and leaves the others unchecked", () => {
    renderCard(deliveryOrderCards.multiShipment, {
      selectedBookIds: new Set(["book-5"]),
      selectionMode: true,
    });

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
