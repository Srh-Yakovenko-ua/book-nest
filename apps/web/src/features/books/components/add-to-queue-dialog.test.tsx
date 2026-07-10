import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { AddToQueueDialog } from "./add-to-queue-dialog";
import { makeBookView } from "./book-details.fixtures";

const add = messages.readingQueue.add;
const fetchMock = vi.fn();

let resolveQueue: (response: Response) => void;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function queueView(count: number) {
  return { count, items: [], totalPagesCount: 0 };
}

function renderDialog() {
  return renderWithProviders(
    <AddToQueueDialog
      book={makeBookView({ id: "book-1", isInReadingQueue: false })}
      onOpenChange={vi.fn()}
      open
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    if (String(input).includes("/api/reading-queue")) {
      return new Promise<Response>((resolve) => {
        resolveQueue = resolve;
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddToQueueDialog", () => {
  it("disables submitting until the queue count is known", async () => {
    renderDialog();

    expect(screen.getByRole("button", { name: add.submit })).toBeDisabled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      resolveQueue(jsonResponse(queueView(3)));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: add.submit })).not.toBeDisabled(),
    );
  });
});
