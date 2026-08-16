import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeDeliveryShipmentGroupModel } from "./delivery.fixtures";
import { OrderShipmentActionDialog } from "./order-shipment-action-dialog";

const shipment = makeDeliveryShipmentGroupModel({
  expectedDate: "2026-08-22",
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

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) =>
    Promise.resolve(
      new Response(
        JSON.stringify(String(input).includes("delivery-services") ? [] : updatedOrder),
        { headers: { "Content-Type": "application/json" } },
      ),
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
      status: "ordered",
      trackingNumber: "TTN-2",
      trackingUrl: "https://np.test/TTN-1",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
