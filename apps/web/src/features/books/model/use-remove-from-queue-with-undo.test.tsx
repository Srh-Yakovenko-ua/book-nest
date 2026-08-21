import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { createTestQueryClient } from "@/test-utils";

import { useRemoveFromQueueWithUndo } from "./use-remove-from-queue-with-undo";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const copy = messages.readingQueue;
const fetchMock = vi.fn();

function emptyQueue() {
  return { count: 0, items: [], totalCount: 0, totalPagesCount: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastUndoAction() {
  const options = vi.mocked(toast).mock.lastCall?.[1];
  if (options === undefined || typeof options.action !== "object" || options.action === null) {
    return undefined;
  }
  return options.action as unknown as { onClick: () => void };
}

function readdBody() {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/reading-queue") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
  return call === undefined ? undefined : JSON.parse(String(call[1].body));
}

function setup() {
  const client = createTestQueryClient();
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="uk" messages={messages}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return renderHook(() => useRemoveFromQueueWithUndo(), { wrapper });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(emptyQueue()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRemoveFromQueueWithUndo", () => {
  it("removes the book and offers an undo that re-adds it at the captured position", async () => {
    const { result } = setup();

    act(() => result.current.remove("book-1", 3));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/reading-queue/book-1"),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith(copy.remove.toast, expect.anything()));

    act(() => lastUndoAction()?.onClick());

    await waitFor(() =>
      expect(readdBody()).toEqual({ bookId: "book-1", placement: "specific", position: 3 }),
    );
  });

  it("removes the book without an undo action when the position is unknown", async () => {
    const { result } = setup();

    act(() => result.current.remove("book-1", null));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(copy.remove.toast, undefined));
    expect(lastUndoAction()).toBeUndefined();
  });
});
