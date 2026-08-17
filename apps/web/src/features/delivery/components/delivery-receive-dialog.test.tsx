import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { DeliveryReceiveDialog } from "./delivery-receive-dialog";

const receivedOrder = {
  createdAt: "2026-08-01T10:00:00.000Z",
  currency: "UAH",
  deliveryPrice: null,
  derivedStatus: "received",
  discount: null,
  id: "order-1",
  items: [],
  note: null,
  orderDate: "2026-08-01",
  orderNumber: "QA-1",
  shipments: [],
  storeName: "Yakaboo",
  totalAmount: null,
  updatedAt: "2026-08-17T10:00:00.000Z",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeliveryReceiveDialog", () => {
  it("focuses the confirm action when the dialog opens", async () => {
    renderWithProviders(
      <DeliveryReceiveDialog
        onOpenChange={vi.fn()}
        open
        target={{ bookCount: 1, kind: "shipment", shipmentId: "shipment-42" }}
      />,
    );

    const confirmButton = await screen.findByRole("button", { name: "Позначити як отримані" });
    await waitFor(() => expect(confirmButton).toHaveFocus());
  });

  it("confirms a shipment target through the shipment receive endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(receivedOrder), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onOpenChange = vi.fn();
    const onReceived = vi.fn();
    renderWithProviders(
      <DeliveryReceiveDialog
        onOpenChange={onOpenChange}
        onReceived={onReceived}
        open
        target={{ bookCount: 2, kind: "shipment", shipmentId: "shipment-42" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Позначити як отримані" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/delivery/shipments/shipment-42/receive");
    expect(init).toMatchObject({ method: "POST" });
    await waitFor(() => expect(onReceived).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps selected-book receipt on the bulk book endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ receivedBookIds: ["book-1", "book-2"], skipped: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderWithProviders(
      <DeliveryReceiveDialog
        onOpenChange={vi.fn()}
        open
        target={{ bookIds: ["book-1", "book-2"], kind: "books" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Позначити як отримані" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/delivery/books/receive");
    expect(init).toMatchObject({
      body: JSON.stringify({ bookIds: ["book-1", "book-2"] }),
      method: "POST",
    });
  });
});
