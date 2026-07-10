import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { StartReadingDialog } from "./start-reading-dialog";

const copy = messages.readingQueue.start;
const fetchMock = vi.fn();

function emptyQueue() {
  return { count: 0, items: [], totalPagesCount: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastRequestBody() {
  const [, init] = fetchMock.mock.lastCall as [string, RequestInit];
  return JSON.parse(String(init.body));
}

function renderDialog(onOpenChange: (open: boolean) => void = vi.fn()) {
  renderWithProviders(
    <StartReadingDialog book={{ id: "book-1", title: "Перша" }} onOpenChange={onOpenChange} />,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(emptyQueue()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StartReadingDialog", () => {
  it("opens with the remove-from-queue checkbox checked by default", () => {
    renderDialog();

    expect(screen.getByRole("checkbox", { name: copy.removeLabel })).toBeChecked();
  });

  it("starts reading and removes the book from the queue by default", async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await userEvent.click(screen.getByRole("button", { name: copy.confirm }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.lastCall as [string, RequestInit];
    expect(url).toContain("/api/reading-queue/book-1/start-reading");
    expect(init.method).toBe("POST");
    expect(lastRequestBody()).toEqual({ removeFromQueue: true });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the book in the queue when the checkbox is unchecked", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("checkbox", { name: copy.removeLabel }));
    await userEvent.click(screen.getByRole("button", { name: copy.confirm }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastRequestBody()).toEqual({ removeFromQueue: false });
  });

  it("closes without starting when cancelled", async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await userEvent.click(screen.getByRole("button", { name: copy.cancel }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
