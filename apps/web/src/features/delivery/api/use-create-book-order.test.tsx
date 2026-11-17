import type { BookOrderView, CreateBookOrderInput } from "@app/shared";

import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { genresKeys } from "@/features/genres/api/genres-keys";
import { queryClientWrapper } from "@/test-query-cache";
import { createTestQueryClient } from "@/test-utils";

import { useCreateBookOrder } from "./use-create-book-order";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const ORDERS_PATH = "/api/delivery/orders";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const SEEDED_KEYS = {
  delivery: ["/api/delivery/in-transit"],
  genreSummary: genresKeys.summary,
  settings: ["/api/settings"],
} as const;

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

function parseJsonBody(body: RequestInit["body"]): unknown {
  return typeof body === "string" ? JSON.parse(body) : body;
}

function requestPath(input: RequestInfo | URL): string {
  return new URL(String(input), "http://localhost").pathname;
}

function sentRequests() {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: parseJsonBody(init?.body),
    method: init?.method,
    path: requestPath(input),
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) =>
    init?.method === "POST" && requestPath(input) === ORDERS_PATH
      ? Promise.resolve(
          new Response(JSON.stringify(response), {
            headers: { "Content-Type": "application/json" },
            status: 201,
          }),
        )
      : Promise.reject(new Error(`unexpected fetch: ${init?.method} ${String(input)}`)),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCreateBookOrder", () => {
  it("posts the payload and parses the created order", async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCreateBookOrder(), {
      wrapper: queryClientWrapper(client),
    });

    act(() => result.current.mutate(payload));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sentRequests()).toEqual([{ body: payload, method: "POST", path: ORDERS_PATH }]);
    expect(result.current.data).toEqual(response);
  });

  it("invalidates delivery data and Genre analytics but leaves unrelated queries intact", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, {});
    const { result } = renderHook(() => useCreateBookOrder(), {
      wrapper: queryClientWrapper(client),
    });

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
