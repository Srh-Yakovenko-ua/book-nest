import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterDetailsSheet } from "./character-details-sheet";

const fetchMock = vi.fn();

const hiddenCharacter = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({ bookId: "book-1", description: null, hiddenFields: ["description"] }),
  ],
  name: "Ґеральт",
});

const revealedCharacter = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({ bookId: "book-1", description: "Таємний опис", hiddenFields: [] }),
  ],
  name: "Ґеральт",
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderSheet(props: Partial<Parameters<typeof CharacterDetailsSheet>[0]> = {}) {
  return renderWithProviders(
    <CharacterDetailsSheet
      characterId="char-1"
      contextBookId="book-1"
      onEdit={vi.fn()}
      onOpenChange={vi.fn()}
      open
      {...props}
    />,
  );
}

function revealRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes("revealFieldIds=description"));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("revealFieldIds=description")) {
      return Promise.resolve(jsonResponse(revealedCharacter));
    }
    if (url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(hiddenCharacter));
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterDetailsSheet spoilers", () => {
  it("hides a spoiler field as a locked placeholder without leaking its value", async () => {
    renderSheet();

    expect(await screen.findByText("Приховано (спойлер)")).toBeInTheDocument();
    expect(screen.queryByText("Таємний опис")).not.toBeInTheDocument();
  });

  it("refetches with the reveal parameter and shows the value only after revealing", async () => {
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: /Показати поле/ }));

    await waitFor(() => expect(revealRequests().length).toBeGreaterThan(0));
    expect(await screen.findByText("Таємний опис")).toBeInTheDocument();
  });
});

describe("CharacterDetailsSheet accessibility", () => {
  it("names the reveal control by the field it unlocks", async () => {
    renderSheet();

    expect(
      await screen.findByRole("button", { name: "Показати поле: Опис у книзі" }),
    ).toBeInTheDocument();
  });

  it("opens the editor from the sheet via the keyboard", async () => {
    const onEdit = vi.fn();
    renderSheet({ onEdit });

    const editButton = await screen.findByRole("button", { name: "Редагувати" });
    editButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(onEdit).toHaveBeenCalledWith("char-1");
  });
});
