import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeDeliveryOrderCardModel, makeDeliveryShipmentGroupModel } from "./delivery.fixtures";
import { OrderShipmentActionDialog } from "./order-shipment-action-dialog";

const shipment = makeDeliveryShipmentGroupModel({
  expectedDate: "2026-08-22",
  note: "Лишити у відділенні",
  serviceName: "Нова Пошта",
  status: "ordered",
  trackingNumber: "TTN-1",
  trackingUrl: "https://np.test/TTN-1",
});

const updatedOrder = {
  createdAt: "2026-08-01T10:00:00.000Z",
  currency: "UAH",
  deliveryPrice: null,
  derivedStatus: "shipped",
  discount: null,
  id: "order-1",
  items: [],
  note: null,
  orderDate: "2026-08-01",
  orderNumber: "QA-1",
  shipments: [],
  storeName: "Yakaboo",
  totalAmount: null,
  updatedAt: "2026-08-01T10:00:00.000Z",
};

const recentStores = ["Yakaboo", "Книгарня Є", "Букініст"];

const TODAY = new Date(2026, 7, 17, 9, 0, 0);

const fetchMock = vi.fn();

let loadedOrder: unknown = updatedOrder;

function orderItem(id: string, price: null | number) {
  return {
    bookId: `book-${id}`,
    cancelledAt: null,
    cancelReason: null,
    id,
    orderId: "order-1",
    price,
    receivedAt: null,
    shipmentId: null,
  };
}

function renderEditOrder({ onOpenChange = vi.fn() }: { onOpenChange?: () => void } = {}) {
  return renderWithProviders(
    <OrderShipmentActionDialog
      action={{ kind: "edit-order", order: makeDeliveryOrderCardModel({ id: "order-1" }) }}
      onOpenChange={onOpenChange}
    />,
  );
}

function responseFor(url: string): unknown {
  if (url.includes("delivery-services")) return [];
  if (url.includes("purchase-stores")) return recentStores;
  return loadedOrder;
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  loadedOrder = updatedOrder;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) =>
    Promise.resolve(
      new Response(JSON.stringify(responseFor(String(input))), {
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function patchBody(): unknown {
  const call = fetchMock.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
  );
  return call === undefined ? undefined : JSON.parse(String((call[1] as RequestInit).body));
}

describe("OrderShipmentActionDialog edit-order", () => {
  it("picks the store from the recent-store suggestions instead of a bare text input", async () => {
    const onOpenChange = vi.fn();
    renderEditOrder({ onOpenChange });

    const storeField = await screen.findByLabelText("Магазин");
    expect(storeField).toHaveValue("Yakaboo");

    await userEvent.clear(storeField);
    await userEvent.type(storeField, "Книг");
    await userEvent.click(await screen.findByRole("option", { name: "Книгарня Є" }));

    expect(storeField).toHaveValue("Книгарня Є");

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toEqual({
      currency: "UAH",
      deliveryPrice: null,
      discount: null,
      note: null,
      orderDate: "2026-08-01",
      orderNumber: "QA-1",
      storeName: "Книгарня Є",
      totalAmount: null,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("prefills every order field from the loaded order, not from the card", async () => {
    loadedOrder = {
      ...updatedOrder,
      currency: "USD",
      deliveryPrice: 60,
      discount: 10,
      note: "Забрати після 18:00",
    };
    renderEditOrder();

    expect(await screen.findByLabelText("Коментар")).toHaveValue("Забрати після 18:00");
    expect(screen.getByLabelText("Вартість доставки")).toHaveValue(60);
    expect(screen.getByLabelText("Знижка")).toHaveValue(10);
    expect(screen.getByLabelText("Валюта")).toHaveTextContent("USD");
    expect(screen.getByRole("button", { name: "Дата замовлення" })).toHaveTextContent(
      "1 серпня 2026",
    );
  });

  it("saves the order date picked in the calendar", async () => {
    renderEditOrder();

    const dateField = await screen.findByRole("button", { name: "Дата замовлення" });
    await userEvent.click(dateField);
    await userEvent.click(await screen.findByRole("button", { name: /10-е серпня 2026/ }));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toMatchObject({ orderDate: "2026-08-10" });
  });

  it("calculates the total itself while every book has a price", async () => {
    loadedOrder = {
      ...updatedOrder,
      deliveryPrice: 60,
      discount: 10,
      items: [orderItem("item-1", 100), orderItem("item-2", 50)],
      totalAmount: 200,
    };
    renderEditOrder();

    expect(await screen.findByText("Сплачено всього")).toBeInTheDocument();
    expect(screen.getByText("200 UAH")).toBeInTheDocument();
    expect(screen.queryByLabelText("Фінальна сума")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Знижка"));
    await userEvent.type(screen.getByLabelText("Знижка"), "20");
    expect(screen.getByText("190 UAH")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).not.toHaveProperty("totalAmount");
    expect(patchBody()).toMatchObject({ deliveryPrice: 60, discount: 20 });
  });

  it("asks for the total by hand while a book has no price", async () => {
    loadedOrder = {
      ...updatedOrder,
      items: [orderItem("item-1", 100), orderItem("item-2", null)],
      totalAmount: 250,
    };
    renderEditOrder();

    expect(await screen.findByLabelText("Фінальна сума")).toHaveValue(250);
    expect(screen.queryByText("Сплачено всього")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Фінальна сума"));
    await userEvent.type(screen.getByLabelText("Фінальна сума"), "300");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toMatchObject({ totalAmount: 300 });
  });

  it("steps the money fields by a whole unit", async () => {
    loadedOrder = { ...updatedOrder, deliveryPrice: 65.5, discount: 230.04 };
    renderEditOrder();

    expect(await screen.findByLabelText("Знижка")).toHaveAttribute("step", "1");
    expect(screen.getByLabelText("Вартість доставки")).toHaveAttribute("step", "1");
    expect(screen.getByLabelText("Фінальна сума")).toHaveAttribute("step", "1");
  });

  it("refuses to save a discount that drives the total below zero", async () => {
    loadedOrder = {
      ...updatedOrder,
      items: [orderItem("item-1", 100)],
      totalAmount: 100,
    };
    renderEditOrder();

    await userEvent.clear(await screen.findByLabelText("Знижка"));
    await userEvent.type(screen.getByLabelText("Знижка"), "150");

    expect(screen.getByRole("alert")).toHaveTextContent("підсумок виходить від’ємним");

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));
    expect(patchBody()).toBeUndefined();
  });

  it("refuses to save an emptied store", async () => {
    renderEditOrder();

    await userEvent.clear(await screen.findByLabelText("Магазин"));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(screen.getByLabelText("Магазин")).toHaveAttribute("aria-invalid", "true");
    expect(patchBody()).toBeUndefined();
  });
});

describe("OrderShipmentActionDialog edit-shipment", () => {
  it("offers every dispatch detail the card shows, not just the tracking number", () => {
    renderWithProviders(
      <OrderShipmentActionDialog
        action={{ kind: "edit-shipment", shipment }}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Служба доставки")).toHaveValue("Нова Пошта");
    expect(screen.getByLabelText("Очікувана дата доставки")).toBeVisible();
    expect(screen.getByLabelText("Номер ТТН")).toHaveValue("TTN-1");
    expect(screen.getByLabelText("Посилання на відстеження")).toHaveValue("https://np.test/TTN-1");
    expect(screen.getByLabelText("Статус доставки")).toBeVisible();
    expect(screen.getByLabelText("Коментар")).toHaveValue("Лишити у відділенні");
  });

  it("saves an edited comment and clears it when emptied", async () => {
    renderWithProviders(
      <OrderShipmentActionDialog
        action={{ kind: "edit-shipment", shipment }}
        onOpenChange={vi.fn()}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Коментар"));
    await userEvent.type(screen.getByLabelText("Коментар"), "Дзвонити перед доставкою");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toMatchObject({ note: "Дзвонити перед доставкою" });
  });

  it("sends no comment when the field is left empty", async () => {
    renderWithProviders(
      <OrderShipmentActionDialog
        action={{ kind: "edit-shipment", shipment: { ...shipment, note: null } }}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Коментар")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toMatchObject({ note: null });
  });

  it("sends the whole shipment on save and closes once the server answers", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <OrderShipmentActionDialog
        action={{ kind: "edit-shipment", shipment }}
        onOpenChange={onOpenChange}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Номер ТТН"));
    await userEvent.type(screen.getByLabelText("Номер ТТН"), "TTN-2");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toEqual({
      deliveryService: "Нова Пошта",
      expectedDeliveryDate: "2026-08-22",
      note: "Лишити у відділенні",
      pickupUntil: null,
      status: "ordered",
      trackingNumber: "TTN-2",
      trackingUrl: "https://np.test/TTN-1",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the pickup deadline it was opened with and sends it back on save", async () => {
    renderWithProviders(
      <OrderShipmentActionDialog
        action={{
          kind: "edit-shipment",
          shipment: { ...shipment, pickupUntil: "2026-08-25", status: "ready_for_pickup" },
        }}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Зберігається до")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(patchBody()).toBeDefined());
    expect(patchBody()).toMatchObject({ pickupUntil: "2026-08-25" });
  });
});
