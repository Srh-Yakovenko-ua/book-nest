import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { act } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { createTestQueryClient, waitFor } from "@/test-utils";

import { makeStoreLink } from "../model/books-to-buy.fixtures";
import { useDeleteStoreLinkWithUndo } from "./use-delete-store-link-with-undo";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const copy = messages.booksToBuy.storeLinks;
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useDeleteStoreLinkWithUndo", () => {
  it("confirms the delete with an undo action when the hook unmounts before the server answers", async () => {
    let answerDelete: (response: Response) => void = () => {};
    fetchMock.mockImplementation((input, init) => {
      if (init?.method !== "DELETE") {
        return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
      }
      return new Promise<Response>((resolve) => {
        answerDelete = resolve;
      });
    });
    const client = createTestQueryClient();
    function Providers({ children }: { children: ReactNode }) {
      return (
        <NextIntlClientProvider locale="uk" messages={messages}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </NextIntlClientProvider>
      );
    }
    const { result, unmount } = renderHook(() => useDeleteStoreLinkWithUndo(BOOK_ID), {
      wrapper: Providers,
    });

    act(() => result.current.deleteWithUndo(makeStoreLink({ bookId: BOOK_ID, id: "link-1" })));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/books/${BOOK_ID}/store-links/link-1`),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    unmount();
    await act(async () => answerDelete(new Response(null, { status: 204 })));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(copy.deleted, {
        action: expect.objectContaining({ label: copy.undo, onClick: expect.any(Function) }),
      }),
    );
  });
});
