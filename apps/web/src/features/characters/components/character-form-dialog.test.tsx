import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterFormDialog } from "./character-form-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const editCharacter = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({
      bookId: "book-1",
      description: "Опис у книзі",
      importance: "central",
      isPovCharacter: true,
      status: "active",
    }),
  ],
  gender: "male",
  name: "Ґеральт",
  species: "Відьмак",
});

const fetchMock = vi.fn();

function bookPatchBody() {
  return patchBody((url) => url.includes("/api/books/"));
}

function globalPatchBody() {
  return patchBody((url) => url.includes("/api/characters/") && !url.includes("/api/books/"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function patchBody(predicate: (url: string) => boolean): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH" && predicate(String(url)),
  ) as [string, RequestInit] | undefined;
  return call === undefined
    ? undefined
    : (JSON.parse(String(call[1].body)) as Record<string, unknown>);
}

function renderDialog(props: Partial<Parameters<typeof CharacterFormDialog>[0]> = {}) {
  return renderWithProviders(
    <CharacterFormDialog
      bookId="book-1"
      characterId="char-1"
      onOpenChange={vi.fn()}
      open
      {...props}
    />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(editCharacter));
    }
    if (method === "PATCH") return Promise.resolve(jsonResponse(makeCharacterDetails()));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterFormDialog scope separation", () => {
  it("sends global fields only to the global endpoint and book fields only to the book endpoint", async () => {
    renderDialog();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());

    expect(globalPatchBody()).toHaveProperty("name", "Ґеральт");
    expect(globalPatchBody()).not.toHaveProperty("importance");
    expect(globalPatchBody()).not.toHaveProperty("status");
    expect(globalPatchBody()).not.toHaveProperty("isPovCharacter");
    expect(globalPatchBody()).not.toHaveProperty("description");

    expect(bookPatchBody()).toHaveProperty("importance", "central");
    expect(bookPatchBody()).toHaveProperty("status", "active");
    expect(bookPatchBody()).toHaveProperty("isPovCharacter", true);
    expect(bookPatchBody()).not.toHaveProperty("name");
    expect(bookPatchBody()).not.toHaveProperty("gender");
    expect(bookPatchBody()).not.toHaveProperty("species");
    expect(bookPatchBody()).not.toHaveProperty("entityKind");
  });
});

describe("CharacterFormDialog point of view", () => {
  it("reveals the narrator type only while the POV switch is on", async () => {
    renderDialog();

    await screen.findByDisplayValue("Ґеральт");
    expect(screen.getByText("Тип наратора")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "POV-персонаж" }));

    await waitFor(() => expect(screen.queryByText("Тип наратора")).not.toBeInTheDocument());
  });
});

describe("CharacterFormDialog discard guard", () => {
  it("asks to confirm discarding a dirty form on close", async () => {
    renderDialog();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: "Ім'я" }), " із Рівії");
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Відхилити зміни?")).toBeInTheDocument();
  });
});
