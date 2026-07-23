import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { createTestQueryClient } from "@/test-utils";

import { makeCharacterDetails, makeDeletionResult } from "./characters.fixtures";
import { useDeleteCharacterWithUndo } from "./use-delete-character-with-undo";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const copy = messages.characters.toast;
const fetchMock = vi.fn();

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

function setup() {
  const client = createTestQueryClient();
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="uk" messages={messages}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return renderHook(() => useDeleteCharacterWithUndo(), { wrapper });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/restore")) return Promise.resolve(jsonResponse(makeCharacterDetails()));
    return Promise.resolve(jsonResponse(makeDeletionResult()));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useDeleteCharacterWithUndo", () => {
  it("soft-deletes the character and confirms it with an undoable toast", async () => {
    const { result } = setup();

    act(() => result.current.deleteWithUndo("char-1"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/characters/char-1"),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith(copy.deleted, expect.anything()));
  });

  it("runs the passed callback once the delete succeeds", async () => {
    const { result } = setup();
    const onDeleted = vi.fn();

    act(() => result.current.deleteWithUndo("char-1", onDeleted));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it("restores the character when the undo action is used", async () => {
    const { result } = setup();

    act(() => result.current.deleteWithUndo("char-1"));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(copy.deleted, expect.anything()));

    act(() => lastUndoAction()?.onClick());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/characters/char-1/restore"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(copy.restored));
  });
});
