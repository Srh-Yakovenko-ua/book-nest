import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
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

let respondToCreate: () => Response;

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

function postCount(): number {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "POST")
    .length;
}

function renderDialog(props: Partial<Parameters<typeof CharacterFormDialog>[0]> = {}) {
  return renderWithProviders(
    <CharacterFormDialog
      bookId="book-1"
      onLinkExisting={vi.fn()}
      onOpenChange={vi.fn()}
      open
      {...props}
    />,
  );
}

beforeEach(() => {
  respondToCreate = () => jsonResponse(makeCharacterDetails(), 201);

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(editCharacter));
    }
    if (method === "PATCH") return Promise.resolve(jsonResponse(makeCharacterDetails()));
    if (method === "POST" && url.includes("/api/books/book-1/characters")) {
      return Promise.resolve(respondToCreate());
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterFormDialog add flow", () => {
  it("starts on the existing-character search instead of the full form", () => {
    renderDialog();

    expect(screen.getByLabelText("Пошук наявних персонажів")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити нового" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Ім'я")).not.toBeInTheDocument();
  });

  it("switches to the full form after choosing to create a new character", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));

    expect(screen.getByLabelText("Ім'я")).toBeInTheDocument();
  });
});

describe("CharacterFormDialog validation", () => {
  it("blocks submit and announces the missing name", async () => {
    renderDialog({ initialName: "" });

    await userEvent.click(screen.getByRole("button", { name: "Додати" }));

    expect(await screen.findByText("Вкажіть ім'я")).toBeInTheDocument();
    expect(screen.getByLabelText("Ім'я")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Ім'я")).toHaveFocus();
    expect(postCount()).toBe(0);
  });

  it("keeps the entered values when the server rejects the create", async () => {
    respondToCreate = () => jsonResponse({ message: "boom" }, 400);
    renderDialog({ initialName: "" });

    await userEvent.type(screen.getByLabelText("Ім'я"), "Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Додати" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Не вдалося зберегти. Спробуйте ще раз."),
    );
    expect(screen.getByLabelText("Ім'я")).toHaveValue("Ґеральт");
  });

  it("asks to confirm discarding a dirty form on close", async () => {
    renderDialog({ initialName: "" });

    await userEvent.type(screen.getByLabelText("Ім'я"), "Ґеральт");
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Відхилити зміни?")).toBeInTheDocument();
  });
});

describe("CharacterFormDialog scope separation", () => {
  it("sends global fields only to the global endpoint and book fields only to the book endpoint", async () => {
    renderDialog({ characterId: "char-1" });

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
  it("reveals the narrator type only after enabling the POV switch", async () => {
    renderDialog({ initialName: "" });

    expect(screen.queryByText("Тип наратора")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "POV-персонаж" }));

    expect(await screen.findByText("Тип наратора")).toBeInTheDocument();
  });
});
