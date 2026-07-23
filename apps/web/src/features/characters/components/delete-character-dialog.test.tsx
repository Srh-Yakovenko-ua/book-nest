import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeDeletionPreview } from "../model/characters.fixtures";
import { DeleteCharacterDialog } from "./delete-character-dialog";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(props: Partial<Parameters<typeof DeleteCharacterDialog>[0]> = {}) {
  return renderWithProviders(
    <DeleteCharacterDialog
      characterId="char-1"
      isDeleting={false}
      onConfirm={vi.fn()}
      onOpenChange={vi.fn()}
      open
      {...props}
    />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/deletion-preview")) {
      return Promise.resolve(jsonResponse(makeDeletionPreview({ appearanceCount: 3 })));
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeleteCharacterDialog", () => {
  it("shows the impact preview once the counts load", async () => {
    renderDialog();

    expect(await screen.findByText("Появи в книгах: 3")).toBeInTheDocument();
  });

  it("confirms the permanent deletion", async () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await userEvent.click(await screen.findByRole("button", { name: "Видалити повністю" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
