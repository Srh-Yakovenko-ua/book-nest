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

function makeShortAndLongShipments(): DeliveryOrderCardModel {
  const shipmentBooks = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) =>
      makeDeliveryOrderBookModel({ bookId: `${prefix}-${index}`, id: `${prefix}-item-${index}` }),
    );

  return makeDeliveryOrderCardModel({
    booksCount: 11,
    shipments: [
      makeDeliveryShipmentGroupModel({
        books: shipmentBooks("first", 3),
        serviceName: "Нова Пошта",
      }),
      makeDeliveryShipmentGroupModel({
        books: shipmentBooks("later", 8),
        id: "shipment-later",
        serviceName: "Укрпошта",
      }),
    ],
  });
}

function renderCard(
  model: DeliveryOrderCardModel,
  overrides: Partial<ComponentProps<typeof DeliveryOrderCard>> = {},
) {
  return renderWithProviders(
    <DeliveryOrderCard
      model={model}
      onCancelBook={vi.fn()}
      onChangeShipmentStatus={vi.fn()}
      onEditBook={vi.fn()}
      onManage={vi.fn()}
      onReceiveShipment={vi.fn()}
      onToggleSelectShipment={vi.fn()}
      preparingEdit={false}
      selectedShipmentIds={new Set<string>()}
      selectionMode={false}
      {...overrides}
    />,
  );
}

function shipmentSectionAt(index: number): HTMLElement {
  const section = screen.getAllByRole("heading", { level: 4 })[index]?.closest("section");
  if (section === null || section === undefined) {
    throw new Error(`no shipment section at index ${index}`);
  }
  return section;
}

describe("DeliveryOrderCard", () => {
  it("shows the store, the order meta and the shipment details once for a multi-book shipment", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.getAllByText("Читайлик")).toHaveLength(1);
    expect(screen.getAllByText(/ORD-10298/)).toHaveLength(1);
    expect(screen.getByText("1 250 UAH")).toBeInTheDocument();
    expect(screen.getByText("3 книги")).toBeInTheDocument();
    expect(screen.getAllByText("Нова Пошта")).toHaveLength(1);
    expect(screen.getAllByText("20450099887766")).toHaveLength(1);
    expect(screen.getByText("Служба доставки:")).toHaveClass("sr-only");
    expect(screen.getByText("Номер ТТН:")).toHaveClass("sr-only");
    expect(screen.getByText("Очікувана дата доставки: 10 лип. 2026")).toBeInTheDocument();
    const trackingLink = screen.getByRole("link", { name: /Відкрити трекінг/ });
    expect(trackingLink).toHaveAttribute("target", "_blank");
    expect(trackingLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps the service, the tracking number and the tracking link on one line, with the expected date below", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    const service = screen.getByText("Нова Пошта");
    const trackingNumber = screen.getByText("20450099887766");
    const trackingLink = screen.getByRole("link", { name: /Відкрити трекінг/ });
    const expectedDate = screen.getByText("Очікувана дата доставки: 10 лип. 2026");
    const metadataLine = trackingNumber.closest("p");

    expect(service.compareDocumentPosition(trackingNumber) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(metadataLine).toContainElement(service);
    expect(metadataLine).toContainElement(trackingLink);
    expect(metadataLine).not.toContainElement(expectedDate);
    expect(
      trackingLink.compareDocumentPosition(expectedDate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders every book of a multi-book shipment", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.getByRole("link", { name: "Страх мудреця" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Солодка Даруся" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders a linked series row with its localized position", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.getByRole("link", { name: "Хроніка вбивці короля · 1 з 2" })).toHaveAttribute(
      "href",
      "/series/kingkiller-chronicle",
    );
  });

  it("shows three books until the order is expanded", async () => {
    const books = Array.from({ length: 6 }, (_, index) =>
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
    await userEvent.click(screen.getByRole("button", { name: "Показати ще 3 книги" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Згорнути" })).toBeInTheDocument();
  });

  it("hides selection checkboxes outside selection mode", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("counts the collapsed books of every shipment, not only the first", async () => {
    renderCard(makeShortAndLongShipments());

    expect(within(bookListAt(0)).getAllByRole("listitem")).toHaveLength(3);
    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Показати ще 5 книг" }));

    expect(within(bookListAt(0)).getAllByRole("listitem")).toHaveLength(3);
    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(8);
  });

  it("keeps later shipment metadata visible while its books are collapsed", () => {
    renderCard(makeShortAndLongShipments());

    expect(screen.getByText("Укрпошта")).toBeInTheDocument();
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
    expect(within(bookListAt(0)).getByRole("link", { name: "Нічний цирк" })).toBeInTheDocument();
    expect(within(bookListAt(0)).queryByText("Американські боги")).not.toBeInTheDocument();

    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(2);
    expect(within(bookListAt(1)).getByText("Американські боги")).toBeInTheDocument();
    expect(within(bookListAt(1)).getByText("Пісня Ахілла")).toBeInTheDocument();
    expect(within(bookListAt(1)).queryByText("Нічний цирк")).not.toBeInTheDocument();
  });

  it("does not render the former persistent count receive actions", () => {
    renderCard(deliveryOrderCards.multiShipment);

    expect(
      screen.queryByRole("button", { name: "Позначити книгу отриманою" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Позначити 2 книги отриманими" }),
    ).not.toBeInTheDocument();
  });

  it("receives an active shipment from its shipment menu by shipment id", async () => {
    const onReceiveShipment = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onReceiveShipment });

    await userEvent.click(screen.getByRole("button", { name: "Дії: Посилка 2" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Позначити посилку отриманою" }),
    );

    expect(onReceiveShipment).toHaveBeenCalledTimes(1);
    expect(onReceiveShipment).toHaveBeenCalledWith("shipment-3b", 2);
  });

  it("shows the compact receive action for ready-for-pickup and uses its shipment id", async () => {
    const onReceiveShipment = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onReceiveShipment });

    await userEvent.click(screen.getByRole("button", { name: "Позначити отриманою" }));

    expect(onReceiveShipment).toHaveBeenCalledTimes(1);
    expect(onReceiveShipment).toHaveBeenCalledWith("shipment-3a", 1);
  });

  it.each([
    ["ordered", "Позначити в дорозі", "in_transit"],
    ["in_transit", "Позначити прибуття", "ready_for_pickup"],
  ] as const)(
    "advances a %s shipment to its next status in one click",
    async (status, label, next) => {
      const onChangeShipmentStatus = vi.fn();
      renderCard(
        makeDeliveryOrderCardModel({
          shipments: [makeDeliveryShipmentGroupModel({ id: `shipment-${status}`, status })],
        }),
        { onChangeShipmentStatus },
      );

      await userEvent.click(screen.getByRole("button", { name: label }));

      expect(onChangeShipmentStatus).toHaveBeenCalledTimes(1);
      expect(onChangeShipmentStatus).toHaveBeenCalledWith(`shipment-${status}`, next);
    },
  );

  it("moves a shipment back to an earlier status from the status submenu", async () => {
    const onChangeShipmentStatus = vi.fn();
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [makeDeliveryShipmentGroupModel({ id: "shipment-back", status: "in_transit" })],
      }),
      { onChangeShipmentStatus },
    );

    await userEvent.click(screen.getByRole("button", { name: "Дії: Посилка" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Статус посилки" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Замовлена" }));

    expect(onChangeShipmentStatus).toHaveBeenCalledWith("shipment-back", "ordered");
  });

  it("does not resend the status a shipment already carries", async () => {
    const onChangeShipmentStatus = vi.fn();
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [makeDeliveryShipmentGroupModel({ id: "shipment-same", status: "in_transit" })],
      }),
      { onChangeShipmentStatus },
    );

    await userEvent.click(screen.getByRole("button", { name: "Дії: Посилка" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Статус посилки" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "В дорозі" }));

    expect(onChangeShipmentStatus).not.toHaveBeenCalled();
  });

  it("names the shipment status next to a badge that reports the delivery date instead", () => {
    renderCard(makeDeliveryOrderCardModel());

    const section = within(shipmentSectionAt(0));
    expect(section.getByText("Очікується скоро")).toBeInTheDocument();
    expect(section.getByText("В дорозі")).toBeInTheDocument();
  });

  it("does not repeat the status when the badge already carries it", () => {
    renderCard(deliveryOrderCards.multipleBooks);

    expect(within(shipmentSectionAt(0)).getAllByText("В дорозі")).toHaveLength(1);
  });

  it("shows the pickup deadline of a shipment waiting at a pickup point", () => {
    renderCard(deliveryOrderCards.multiShipment);

    expect(screen.getByText("Зберігається до 18 лип. 2026")).toBeInTheDocument();
  });

  it("keeps the pickup deadline hidden while the shipment is still travelling", () => {
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [
          makeDeliveryShipmentGroupModel({
            pickupUntil: "2026-07-18",
            pickupUntilText: "18 лип. 2026",
            status: "in_transit",
          }),
        ],
      }),
    );

    expect(screen.queryByText("Зберігається до 18 лип. 2026")).not.toBeInTheDocument();
  });

  it.each(["ordered", "in_transit"] as const)(
    "keeps receive in the shipment menu only for %s",
    async (status) => {
      const onReceiveShipment = vi.fn();
      renderCard(
        makeDeliveryOrderCardModel({
          shipments: [makeDeliveryShipmentGroupModel({ id: `shipment-${status}`, status })],
        }),
        { onReceiveShipment },
      );

      expect(screen.queryByRole("button", { name: "Позначити отриманою" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Дії: Посилка" }));
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Позначити посилку отриманою" }),
      );

      expect(onReceiveShipment).toHaveBeenCalledWith(`shipment-${status}`, 1);
    },
  );

  it.each(["received", "cancelled"] as const)(
    "disables shipment management actions for %s",
    (status) => {
      renderCard(
        makeDeliveryOrderCardModel({
          shipments: [makeDeliveryShipmentGroupModel({ status })],
        }),
      );

      expect(screen.queryByRole("button", { name: "Позначити отриманою" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Дії: Посилка" })).toBeDisabled();
      expect(screen.queryByText("Позначити посилку отриманою")).not.toBeInTheDocument();
    },
  );

  it("disables shipment management actions for unassigned books", () => {
    renderCard(deliveryOrderCards.notShipped);

    expect(screen.queryByRole("button", { name: "Позначити отриманою" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Дії: Посилка" })).toBeDisabled();
    expect(screen.queryByText("Позначити посилку отриманою")).not.toBeInTheDocument();
  });

  it("does not expose shipment receive from the order or book menus", async () => {
    renderCard(deliveryOrderCards.singleBook);

    await userEvent.click(screen.getByRole("button", { name: "Дії із замовленням" }));
    expect(
      screen.queryByRole("menuitem", { name: "Позначити посилку отриманою" }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Дії для «Таємна історія»" }));
    expect(
      screen.queryByRole("menuitem", { name: "Позначити посилку отриманою" }),
    ).not.toBeInTheDocument();
  });

  it("leaves the book menu with only the price and cancel actions", async () => {
    renderCard(deliveryOrderCards.singleBook);

    await userEvent.click(screen.getByRole("button", { name: "Дії для «Таємна історія»" }));

    expect(await screen.findByRole("menuitem", { name: "Змінити ціну" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Скасувати цю книгу" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Перейти до книги" })).not.toBeInTheDocument();
  });

  it("edits a single book from its row menu", async () => {
    const onEditBook = vi.fn();
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [
          makeDeliveryShipmentGroupModel({
            books: [
              makeDeliveryOrderBookModel({ bookId: "book-42", id: "item-42", title: "Амадока" }),
            ],
          }),
        ],
      }),
      { onEditBook },
    );

    await userEvent.click(screen.getByRole("button", { name: "Дії для «Амадока»" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Змінити ціну" }));

    expect(onEditBook).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "book-42", id: "item-42", title: "Амадока" }),
    );
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

    expect(onCancelBook).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "book-42", id: "item-1", title: "Амадока" }),
    );
  });

  it("toggles the selection of the parcel whose checkbox was clicked", async () => {
    const onToggleSelectShipment = vi.fn();
    renderCard(deliveryOrderCards.multiShipment, { onToggleSelectShipment, selectionMode: true });

    await userEvent.click(screen.getByRole("checkbox", { name: "Вибрати: Посилка 2" }));

    expect(onToggleSelectShipment).toHaveBeenCalledTimes(1);
    expect(onToggleSelectShipment).toHaveBeenCalledWith("shipment-3b");
  });

  it("shows a selected parcel as checked and leaves the other parcels unchecked", () => {
    renderCard(deliveryOrderCards.multiShipment, {
      selectedShipmentIds: new Set(["shipment-3a"]),
      selectionMode: true,
    });

    expect(screen.getByRole("checkbox", { name: "Вибрати: Посилка 1" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Вибрати: Посилка 2" })).not.toBeChecked();
  });

  it("offers one checkbox per parcel and none per book", () => {
    renderCard(deliveryOrderCards.multiShipment, { selectionMode: true });

    expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual([
      "Вибрати: Посилка 1",
      "Вибрати: Посилка 2",
    ]);
  });

  it("offers no checkbox for the books that are not in a parcel yet", () => {
    renderCard(deliveryOrderCards.notShipped, { selectionMode: true });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each(["received", "cancelled"] as const)("offers no checkbox for a %s parcel", (status) => {
    renderCard(
      makeDeliveryOrderCardModel({
        shipments: [makeDeliveryShipmentGroupModel({ id: "shipment-closed", status })],
      }),
      { selectionMode: true },
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps a parcel selected while its books are collapsed", async () => {
    const onToggleSelectShipment = vi.fn();
    renderCard(makeShortAndLongShipments(), {
      onToggleSelectShipment,
      selectedShipmentIds: new Set(["shipment-later"]),
      selectionMode: true,
    });

    const checkbox = screen.getByRole("checkbox", { name: "Вибрати: Посилка 2" });
    expect(checkbox).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Показати ще 5 книг" }));

    expect(screen.getByRole("checkbox", { name: "Вибрати: Посилка 2" })).toBeChecked();
    expect(onToggleSelectShipment).not.toHaveBeenCalled();
  });

  it("labels the group of books that has not been dispatched yet and still lists them", () => {
    renderCard(deliveryOrderCards.notShipped);

    expect(screen.getByText("Ще не відправлено")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Музей покинутих секретів" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Амадока" })).toBeInTheDocument();
  });

  it("marks the order menu busy while its edit dialog loads", () => {
    renderCard(makeDeliveryOrderCardModel(), { preparingEdit: true });

    const trigger = screen.getByRole("button", { name: "Дії із замовленням" });

    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(trigger).toBeDisabled();
  });

  it("anchors every dispatched shipment so the sidebar can scroll to it", () => {
    renderCard(makeShortAndLongShipments());

    expect(shipmentSectionAt(1)).toHaveAttribute("data-shipment-id", "shipment-later");
  });

  it("opens its collapsed books when the revealed shipment belongs to this order", () => {
    const model = makeShortAndLongShipments();
    const { rerender } = renderCard(model);

    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(3);

    rerender(
      <DeliveryOrderCard
        model={model}
        onCancelBook={vi.fn()}
        onChangeShipmentStatus={vi.fn()}
        onEditBook={vi.fn()}
        onManage={vi.fn()}
        onReceiveShipment={vi.fn()}
        onToggleSelectShipment={vi.fn()}
        preparingEdit={false}
        revealedShipmentId="shipment-later"
        selectedShipmentIds={new Set<string>()}
        selectionMode={false}
      />,
    );

    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(8);
  });

  it("leaves an order alone when the revealed shipment sits somewhere else", () => {
    const model = makeShortAndLongShipments();

    renderCard(model, { revealedShipmentId: "shipment-from-another-order" });

    expect(within(bookListAt(1)).getAllByRole("listitem")).toHaveLength(3);
  });
});
