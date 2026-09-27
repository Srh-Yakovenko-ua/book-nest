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

describe("DeleteCharacterDialog impact truthfulness", () => {
  it("names every dependent resource the backend reports", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          makeDeletionPreview({
            appearanceCount: 2,
            formCount: 1,
            groupCount: 3,
            relationshipCount: 4,
            theoryCount: 5,
          }),
        ),
      ),
    );

    renderDialog();

    expect(await screen.findByText("Появи в книгах: 2")).toBeInTheDocument();
    expect(screen.getByText("Форми та втілення: 1")).toBeInTheDocument();
    expect(screen.getByText("Членство у групах: 3")).toBeInTheDocument();
    expect(screen.getByText("Зв’язки з іншими персонажами: 4")).toBeInTheDocument();
    expect(screen.getByText("Теорії: 5")).toBeInTheDocument();
  });

  it("omits the categories that are empty", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          makeDeletionPreview({ aliasCount: 0, appearanceCount: 1, roleCount: 0, tagCount: 0 }),
        ),
      ),
    );

    renderDialog();

    expect(await screen.findByText("Появи в книгах: 1")).toBeInTheDocument();
    expect(screen.queryByText(/^Ролі:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Імена:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Теги:/)).not.toBeInTheDocument();
  });

  it("says so plainly when nothing depends on the character", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          makeDeletionPreview({ aliasCount: 0, appearanceCount: 0, roleCount: 0, tagCount: 0 }),
        ),
      ),
    );

    renderDialog();

    expect(await screen.findByText("Пов’язаних даних немає.")).toBeInTheDocument();
  });

  it("keeps the confirmation usable when the preview cannot be loaded", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));

    renderDialog();

    expect(
      await screen.findByText("Не вдалося порахувати, що саме буде видалено."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити повністю" })).toBeEnabled();
  });
});
