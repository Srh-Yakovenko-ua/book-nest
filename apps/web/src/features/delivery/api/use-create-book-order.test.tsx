import type { BookOrderView, CreateBookOrderInput } from "@app/shared";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import { useCreateBookOrder } from "./use-create-book-order";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const createMock = vi.fn();

vi.mock("@/shared/api/generated/endpoints/book-orders/book-orders", () => ({
  bookOrdersControllerCreate: (...args: unknown[]) => createMock(...args),
}));

const payload: CreateBookOrderInput = {
  items: [{ bookId: BOOK_ID }],
  storeName: "Yakaboo",
};

const response: BookOrderView = {
  createdAt: "2026-08-14T10:00:00.000Z",
  currency: null,
  deliveryPrice: null,
  derivedStatus: "active",
  discount: null,
  id: ORDER_ID,
  items: [
    {
      bookId: BOOK_ID,
      cancelledAt: null,
      cancelReason: null,
      id: "33333333-3333-4333-8333-333333333333",
      orderId: ORDER_ID,
      price: null,
      receivedAt: null,
      shipmentId: null,
    },
  ],
  note: null,
  orderDate: null,
  orderNumber: null,
  shipments: [],
  storeName: "Yakaboo",
  totalAmount: null,
  updatedAt: "2026-08-14T10:00:00.000Z",
};

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue(response);
});

describe("useCreateBookOrder", () => {
  it("posts the payload and parses the created order", async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCreateBookOrder(), { wrapper: makeWrapper(client) });

    act(() => result.current.mutate(payload));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(createMock).toHaveBeenCalledWith(payload);
    expect(result.current.data).toEqual(response);
  });

  it("invalidates delivery data but leaves unrelated queries intact", async () => {
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateBookOrder(), { wrapper: makeWrapper(client) });

    act(() => result.current.mutate(payload));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledOnce();
    const options = invalidateSpy.mock.calls[0]?.[0];
    expect(options?.predicate?.({ queryKey: ["/api/delivery/in-transit"] } as never)).toBe(true);
    expect(options?.predicate?.({ queryKey: ["/api/settings"] } as never)).toBe(false);
  });
});
