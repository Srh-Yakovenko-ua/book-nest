import type { BookOrderView, CreateBookOrderInput } from "@app/shared";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { genresKeys } from "@/features/genres/api/genres-keys";
import { createTestQueryClient } from "@/test-utils";

import { useCreateBookOrder } from "./use-create-book-order";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const createMock = vi.fn();

const SEEDED_KEYS = {
  delivery: ["/api/delivery/in-transit"],
  genreSummary: genresKeys.summary,
  settings: ["/api/settings"],
} as const;

vi.mock("@/shared/api/generated/endpoints/book-orders/book-orders", () => ({
  bookOrdersControllerCreate: (...args: unknown[]) => createMock(...args),
}));

const payload: CreateBookOrderInput = {
  currency: "UAH",
  isFree: false,
  items: [{ bookId: BOOK_ID, price: 480 }],
  storeName: "Yakaboo",
};

const response: BookOrderView = {
  createdAt: "2026-08-14T10:00:00.000Z",
  currency: null,
  deliveryPrice: null,
  derivedStatus: "active",
  discount: null,
  id: ORDER_ID,
  isFree: false,
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

  it("invalidates delivery data and Genre analytics but leaves unrelated queries intact", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, {});
    const { result } = renderHook(() => useCreateBookOrder(), { wrapper: makeWrapper(client) });

    act(() => result.current.mutate(payload));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(isInvalidated(client, SEEDED_KEYS.delivery)).toBe(true);
    expect(isInvalidated(client, SEEDED_KEYS.genreSummary)).toBe(true);
    expect(isInvalidated(client, SEEDED_KEYS.settings)).toBe(false);
  });
});

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}
