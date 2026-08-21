import type { CancelledFollowUpView } from "@app/shared";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import { useCancelledFollowUp } from "./use-cancelled-follow-up";

const readMock = vi.fn();

vi.mock("@/shared/api/generated/endpoints/delivery-read/delivery-read", () => ({
  cancelledFollowUpControllerRead: (...args: unknown[]) => readMock(...args),
  cancelledFollowUpControllerReturnAllToWishlist: vi.fn(),
}));

const view: CancelledFollowUpView = {
  outcomes: {
    borrowed: 4,
    inLibrary: 3,
    reordered: 1,
    totalBooksCount: 11,
    unresolved: 1,
    wishlist: 2,
  },
  plans: null,
  unresolved: null,
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  readMock.mockReset();
});

describe("useCancelledFollowUp", () => {
  it("asks the server for the tally without passing a single list parameter", async () => {
    readMock.mockResolvedValue(view);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useCancelledFollowUp({ enabled: true }), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.data).toEqual(view));
    expect(readMock).toHaveBeenCalledOnce();
    expect(readMock.mock.calls[0]).toEqual([]);
  });

  it("keeps one cache entry, so search and filters cannot fork the tally", async () => {
    readMock.mockResolvedValue(view);
    const client = createTestQueryClient();

    renderHook(() => useCancelledFollowUp({ enabled: true }), { wrapper: wrapper(client) });
    await waitFor(() => expect(readMock).toHaveBeenCalledOnce());

    renderHook(() => useCancelledFollowUp({ enabled: true }), { wrapper: wrapper(client) });
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1));

    expect(readMock).toHaveBeenCalledOnce();
  });

  it("stays quiet while the reader is not on the cancelled tab", async () => {
    const client = createTestQueryClient();

    renderHook(() => useCancelledFollowUp({ enabled: false }), { wrapper: wrapper(client) });

    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1));
    expect(readMock).not.toHaveBeenCalled();
  });
});
