import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterEditPage } from "./character-edit-page";

const push = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const character = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({
      bookId: "book-1",
      description: "Опис у книзі",
      importance: "central",
      speciesOverride: "Мутант",
      status: "active",
    }),
  ],
  gender: "male",
  name: "Ґеральт",
  species: "Відьмак",
});

const fetchMock = vi.fn();

let bookPatchStatus: number;

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

function patchCount(): number {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH",
  ).length;
}

function renderEdit(search = "bookId=book-1") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <CharacterEditPage characterId="char-1" />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  bookPatchStatus = 200;

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(character));
    }
    if (method === "PATCH" && url.includes("/api/books/")) {
      return Promise.resolve(
        bookPatchStatus === 200
          ? jsonResponse(character)
          : jsonResponse({ message: "boom" }, bookPatchStatus),
      );
    }
    if (method === "PATCH") return Promise.resolve(jsonResponse(character));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterEditPage scope orchestration", () => {
  it("keeps save disabled until something actually changes", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it("sends only the global update when only a global field changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
    expect(bookPatchBody()).toBeUndefined();
  });

  it("sends only the book update when only a book field changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: "Дані в цій книзі" }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("description", "Опис у книзі ще трохи");
    expect(globalPatchBody()).toBeUndefined();
  });

  it("sends both updates when both scopes changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: "Дані в цій книзі" }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(globalPatchBody()).toBeDefined();
  });

  it("keeps the failed scope dirty and does not resend the saved one on retry", async () => {
    bookPatchStatus = 500;
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: "Дані в цій книзі" }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(screen.getByRole("textbox", { name: "Дані в цій книзі" })).toHaveValue(
      "Опис у книзі ще трохи",
    );
    expect(push).not.toHaveBeenCalled();

    bookPatchStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(3));
  });
});

describe("CharacterEditPage without a book context", () => {
  it("shows only the shared section", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
  });
});

function inheritedField(label: string): HTMLElement {
  const shell = screen.getByText(label).closest('[data-slot="inherited-field"]');
  if (!(shell instanceof HTMLElement)) throw new Error(`no inherited field labelled ${label}`);
  return shell;
}

describe("CharacterEditPage inheritance", () => {
  it("shows the effective global value while the book value is inherited", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const displayName = inheritedField("Ім’я в цій книзі");
    expect(within(displayName).getByText("Ґеральт")).toBeInTheDocument();
    expect(within(displayName).getByText("Використовується основне значення")).toBeInTheDocument();
    expect(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    ).toBeInTheDocument();
  });

  it("prefills the book value from the global one and sends it on save", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");

    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );

    const input = within(displayName).getByRole("textbox");
    expect(input).toHaveValue("Ґеральт");
    await userEvent.type(input, " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("displayName", "Ґеральт із Рівії");
    expect(globalPatchBody()).toBeUndefined();
  });

  it("writes no book value when the field is reset to the global one", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const species = inheritedField("Вид у цій книзі");

    expect(within(species).getByText("Лише для цієї книги")).toBeInTheDocument();
    await userEvent.click(
      within(species).getByRole("button", { name: "Використовувати основне значення" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("speciesOverride", null);
  });
});

describe("CharacterEditPage aliases", () => {
  function aliasGroup(title: string): HTMLElement {
    const heading = screen.getByRole("heading", { name: title });
    const group = heading.parentElement?.parentElement;
    if (!(group instanceof HTMLElement)) throw new Error(`no alias group titled ${title}`);
    return group;
  }

  it("saves each group into its own scope and sends no per-row request", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    await userEvent.click(
      within(aliasGroup("Альтернативні імена")).getByRole("button", { name: "Додати ім’я" }),
    );
    await userEvent.type(
      within(aliasGroup("Альтернативні імена")).getByRole("textbox", {
        name: "Альтернативне ім’я",
      }),
      "Білий Вовк",
    );

    await userEvent.click(
      within(aliasGroup("Інші імена в цій книзі")).getByRole("button", { name: "Додати ім’я" }),
    );
    await userEvent.type(
      within(aliasGroup("Інші імена в цій книзі")).getByRole("textbox", {
        name: "Альтернативне ім’я",
      }),
      "Різник",
    );

    expect(patchCount()).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Білий Вовк", position: 0, type: "other" },
    ]);
    expect(bookPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Різник", position: 0, type: "other" },
    ]);
  });

  it("refuses an alias that repeats the main name", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    await userEvent.click(
      within(aliasGroup("Альтернативні імена")).getByRole("button", { name: "Додати ім’я" }),
    );
    await userEvent.type(
      within(aliasGroup("Альтернативні імена")).getByRole("textbox", {
        name: "Альтернативне ім’я",
      }),
      "ґеральт",
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Це основне ім’я персонажа")).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });
});

describe("CharacterEditPage narrative metadata", () => {
  it("reveals the narrator control only while the character is a point of view", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(screen.queryByText("Тип наратора")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "POV-персонаж" }));

    expect(await screen.findByText("Тип наратора")).toBeInTheDocument();
  });

  it("refuses a page that is not a number and sends nothing", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: "Сторінка" }), "сорок");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть номер сторінки числом")).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });

  it("keeps a non-numeric chapter exactly as typed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: "Розділ" }), "Пролог");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("firstAppearanceChapter", "Пролог");
  });
});
