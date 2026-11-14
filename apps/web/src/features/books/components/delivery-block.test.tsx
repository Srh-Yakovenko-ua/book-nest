import type { DeliveryView } from "@app/shared";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { DeliveryBlock } from "./delivery-block";

const deliveryMessages = messages.books.details.delivery;
const SERVER_MESSAGE = "Delivery not found";

const activeDelivery: DeliveryView = {
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-06-01T10:00:00.000Z",
  currency: "UAH",
  deliveryService: "Нова пошта",
  expectedDeliveryDate: null,
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  isFree: false,
  note: null,
  orderDate: "2026-06-01",
  orderNumber: "100500",
  price: 420,
  receivedAt: null,
  status: "ordered",
  storeName: "Книгарня «Є»",
  trackingNumber: null,
  trackingUrl: null,
  updatedAt: "2026-06-01T10:00:00.000Z",
};

const book = makeBookView({
  delivery: { active: activeDelivery, latest: activeDelivery, totalCount: 1 },
  loanInfo: null,
  ownershipStatus: "in_transit",
  purchaseInfo: null,
});

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (
      url.includes(`/api/books/${book.id}/deliveries/${activeDelivery.id}/receive`) &&
      method === "POST"
    )
      return Promise.resolve(jsonResponse({ message: SERVER_MESSAGE }, 404));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeliveryBlock receive", () => {
  it("tells in Ukrainian that the delivery is gone when receiving it answers 404", async () => {
    renderWithProviders(<DeliveryBlock book={book} />);

    await userEvent.click(screen.getByRole("button", { name: deliveryMessages.actions.receive }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(deliveryMessages.errors.notFound));
    expect(toast.error).not.toHaveBeenCalledWith(SERVER_MESSAGE);
  });
});
