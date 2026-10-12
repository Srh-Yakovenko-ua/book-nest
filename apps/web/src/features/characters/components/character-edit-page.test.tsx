import "@testing-library/jest-dom/vitest";
import type {
  BookChapterUsageView,
  BookCharacterStatus,
  BookCharacterView,
  CharacterAliasType,
  CharacterCustomLabelsView,
  CharacterDetailsView,
  MediaView,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { fireEvent, renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeBookCharacterView,
  makeCharacterDetails,
  SPECIES_REFS,
} from "../model/characters.fixtures";
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
      speciesOverride: SPECIES_REFS.mutant,
      status: "active",
    }),
  ],
  gender: "male",
  name: "Ґеральт",
  species: SPECIES_REFS.witcher,
});

const fetchMock = vi.fn();

let bookDetailGate: Promise<void>;
let bookPatchStatus: number;
let servedChapters: BookChapterUsageView[];
let servedCharacter: CharacterDetailsView;
let servedCustomLabels: CharacterCustomLabelsView;
let servedPagesCount: Nullable<number>;

function bookDetailRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.endsWith("/api/books/book-1"));
}

function bookPatchBody() {
  return patchBody((url) => url.includes("/api/books/"));
}

function customLabelRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.endsWith("/api/character-custom-labels"));
}

function firstAppearancePageField(): HTMLElement {
  return screen.getByRole("spinbutton", { name: /^Сторінка/ });
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

async function typeOver(combobox: HTMLElement, text: string) {
  await userEvent.clear(combobox);
  await userEvent.type(combobox, text);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  bookDetailGate = Promise.resolve();
  bookPatchStatus = 200;
  servedChapters = [];
  servedCharacter = character;
  servedCustomLabels = { roles: [], statuses: [] };
  servedPagesCount = 300;

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(servedCharacter));
    }
    if (method === "GET" && url.includes("/api/books/book-1/chapters")) {
      return Promise.resolve(jsonResponse({ chapters: servedChapters }));
    }
    if (method === "GET" && url.endsWith("/api/character-custom-labels")) {
      return Promise.resolve(jsonResponse(servedCustomLabels));
    }
    if (method === "GET" && url.endsWith("/api/books/book-1")) {
      return bookDetailGate.then(() =>
        jsonResponse(makeBookView({ id: "book-1", pagesCount: servedPagesCount })),
      );
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
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("description", "Опис у книзі ще трохи");
    expect(globalPatchBody()).toBeUndefined();
  });

  it("sends both updates when both scopes changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(globalPatchBody()).toBeDefined();
  });

  it("keeps the failed scope dirty and does not resend the saved one on retry", async () => {
    bookPatchStatus = 500;
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(screen.getByRole("textbox", { name: /^Дані в цій книзі/ })).toHaveValue(
      "Опис у книзі ще трохи",
    );
    expect(push).not.toHaveBeenCalled();

    bookPatchStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(3));
  });
});

describe("CharacterEditPage leaving a dirty form", () => {
  it("offers to keep editing instead of losing the changes", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(await screen.findByText("Відхилити зміни?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Так, вийти" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Продовжити редагування" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("CharacterEditPage without a book context", () => {
  it("shows only the shared section", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
  });

  it("asks for no custom roles or statuses, since no book section needs them", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(customLabelRequests()).toEqual([]);
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
    expect(bookPatchBody()).toHaveProperty("speciesOverrideId", null);
  });
});

describe("CharacterEditPage aliases", () => {
  function aliasGroup(title: string): HTMLElement {
    return screen.getByRole("group", { name: title });
  }

  function globalAliases(): HTMLElement {
    return aliasGroup("Альтернативні імена");
  }

  function serveGlobalAliases(aliases: { name: string; type: CharacterAliasType }[]) {
    servedCharacter = {
      ...character,
      aliases: aliases.map((alias, index) => ({
        bookId: null,
        id: `alias-${index}`,
        isSpoiler: false,
        name: alias.name,
        position: index,
        type: alias.type,
      })),
    };
  }

  async function openAliasEditor(group: HTMLElement) {
    await userEvent.click(within(group).getByRole("button", { name: "Додати ім’я…" }));
    return within(group).getByRole("textbox", { name: "Альтернативне ім’я" });
  }

  it("adds a name per group through the inline editor and saves each into its own scope", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const globalInput = await openAliasEditor(globalAliases());
    expect(globalInput).toHaveFocus();
    await userEvent.type(globalInput, "Білий Вовк{Enter}");

    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Білий Вовк» (Інше)" }),
    ).toBeInTheDocument();
    const nextGlobalInput = within(globalAliases()).getByRole("textbox", {
      name: "Альтернативне ім’я",
    });
    expect(nextGlobalInput).toHaveValue("");
    expect(nextGlobalInput).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    const bookGroup = aliasGroup("Інші імена в цій книзі");
    await userEvent.type(await openAliasEditor(bookGroup), "Різник");
    await userEvent.click(within(bookGroup).getByRole("button", { name: "Додати" }));

    expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();
    expect(patchCount()).toBe(0);

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Білий Вовк", position: 0, type: "other" },
    ]);
    expect(bookPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Різник", position: 0, type: "other" },
    ]);
  });

  it("cancels adding on Escape and returns focus to the add field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк{Escape}");

    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я…" })).toHaveFocus();
    expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it("edits a name in place and keeps its position", async () => {
    serveGlobalAliases([
      { name: "Білий Вовк", type: "nickname" },
      { name: "Різник", type: "other" },
    ]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    );

    const input = within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" });
    expect(input).toHaveValue("Білий Вовк");
    await userEvent.clear(input);
    await userEvent.type(input, "Вовк");
    await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
    await userEvent.click(await screen.findByRole("option", { name: "Титул" }));
    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Містить спойлер" }));
    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Готово" }));

    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Вовк» (Титул)" }),
    ).toHaveFocus();
    expect(within(globalAliases()).getByText("2 / 30")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Вовк", position: 0, type: "title" },
      { isSpoiler: false, name: "Різник", position: 1, type: "other" },
    ]);
  });

  it("leaves the name untouched when editing is cancelled", async () => {
    serveGlobalAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    );
    await userEvent.type(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
      " із Рівії",
    );
    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Скасувати" }));

    expect(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it("toggles the spoiler mark from the eye without opening the editor", async () => {
    serveGlobalAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", {
        name: "Позначити ім’я «Білий Вовк» як спойлер",
      }),
    );

    expect(
      within(globalAliases()).getByRole("button", {
        name: "Прибрати позначку спойлера з імені «Білий Вовк»",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Білий Вовк", position: 0, type: "nickname" },
    ]);
  });

  it("removes a name with its cross and moves focus to the next one", async () => {
    serveGlobalAliases([
      { name: "Білий Вовк", type: "nickname" },
      { name: "Різник", type: "other" },
    ]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Прибрати ім’я «Білий Вовк»" }),
    );

    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Різник» (Інше)" }),
    ).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Різник", position: 0, type: "other" },
    ]);
  });

  it("refuses the same name of the same type but accepts it under another type", async () => {
    serveGlobalAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const input = await openAliasEditor(globalAliases());
    await userEvent.type(input, "білий вовк");
    await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
    await userEvent.click(await screen.findByRole("option", { name: "Прізвисько" }));

    expect(within(globalAliases()).getByText("Таке ім’я з цим типом уже є")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(within(globalAliases()).getByRole("button", { name: "Додати" })).toBeDisabled();

    await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
    await userEvent.click(await screen.findByRole("option", { name: "Титул" }));

    expect(
      within(globalAliases()).queryByText("Таке ім’я з цим типом уже є"),
    ).not.toBeInTheDocument();
    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Додати" }));

    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «білий вовк» (Титул)" }),
    ).toBeInTheDocument();
  });

  it("refuses an alias that repeats the main name", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(await openAliasEditor(globalAliases()), " ґеральт {Enter}");

    expect(within(globalAliases()).getByText("Це основне ім’я персонажа")).toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати" })).toBeDisabled();
    expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
  });

  it("blocks adding at the limit but keeps editing and removing", async () => {
    serveGlobalAliases(
      Array.from({ length: 30 }, (_unused, index) => ({
        name: `Ім’я ${index + 1}`,
        type: "other" as const,
      })),
    );
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(globalAliases()).getByText("30 / 30")).toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я…" })).toBeDisabled();
    expect(
      within(globalAliases()).getByText("Ліміт вичерпано — видаліть зайве ім’я"),
    ).toBeInTheDocument();

    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Ім’я 1» (Інше)" }),
    );
    expect(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
    ).toHaveValue("Ім’я 1");
    await userEvent.keyboard("{Escape}");

    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Прибрати ім’я «Ім’я 30»" }),
    );

    expect(within(globalAliases()).getByText("29 / 30")).toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я…" })).toBeEnabled();
  });

  it("marks a saved name as soon as the main name repeats it and clears it once the name changes back", async () => {
    serveGlobalAliases([{ name: "Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const nameField = screen.getByRole("textbox", { name: /Ім’я/ });
    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Вовк");

    const message = within(globalAliases()).getByText("«Вовк»: Це основне ім’я персонажа");
    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Вовк» (Прізвисько)" }),
    ).toHaveAttribute("aria-describedby", message.id);

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
    expect(patchCount()).toBe(0);

    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Ґеральт із Рівії");

    expect(
      within(globalAliases()).queryByText("«Вовк»: Це основне ім’я персонажа"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
  });

  it("keeps the typed draft when an earlier name is removed during editing", async () => {
    serveGlobalAliases([
      { name: "Білий Вовк", type: "nickname" },
      { name: "Різник", type: "other" },
      { name: "Ґвинблейдд", type: "other" },
    ]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Ґвинблейдд» (Інше)" }),
    );
    await userEvent.type(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
      " з Рівії",
    );
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Прибрати ім’я «Білий Вовк»" }),
    );

    expect(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
    ).toHaveValue("Ґвинблейдд з Рівії");

    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Готово" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Різник", position: 0, type: "other" },
      { isSpoiler: false, name: "Ґвинблейдд з Рівії", position: 1, type: "other" },
    ]);
  });

  it("moves focus into the open add editor when the last name is removed", async () => {
    serveGlobalAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const input = await openAliasEditor(globalAliases());
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Прибрати ім’я «Білий Вовк»" }),
    );

    expect(input).toHaveFocus();
  });

  it("still saves a scope that already holds more names than the limit", async () => {
    serveGlobalAliases(
      Array.from({ length: 32 }, (_unused, index) => ({
        name: `Ім’я ${index + 1}`,
        type: "other" as const,
      })),
    );
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(globalAliases()).getByText("32 / 30")).toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я…" })).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
  });
});

describe("CharacterEditPage narrative metadata", () => {
  it("reveals the narration and unreliable narrator controls only while the character is a point of view", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(screen.queryByRole("combobox", { name: "Спосіб оповіді" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Ненадійний оповідач" })).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("switch", { name: "Персонаж із власною перспективою (POV)" }),
    );

    expect(await screen.findByRole("combobox", { name: "Спосіб оповіді" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Ненадійний оповідач" })).toBeInTheDocument();
  });

  it("lets no minus sign, exponent or letters into the page", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(firstAppearancePageField(), "-5");
    expect(firstAppearancePageField()).toHaveValue(5);

    await userEvent.clear(firstAppearancePageField());
    await userEvent.type(firstAppearancePageField(), "1e3");
    expect(firstAppearancePageField()).toHaveValue(13);

    await userEvent.clear(firstAppearancePageField());
    await userEvent.type(firstAppearancePageField(), "сорок");
    expect(firstAppearancePageField()).toHaveValue(null);

    await userEvent.paste("-7");
    expect(firstAppearancePageField()).toHaveValue(null);
  });

  it("refuses a page beyond the book and sends nothing", async () => {
    renderEdit();

    await waitFor(() => expect(firstAppearancePageField()).toHaveAttribute("max", "300"));
    await userEvent.type(firstAppearancePageField(), "301");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("У книзі лише 300 сторінок")).toBeInTheDocument();
    expect(firstAppearancePageField()).toHaveAccessibleDescription("У книзі лише 300 сторінок");
    expect(patchCount()).toBe(0);
  });

  it("flags a page typed before the book's page count arrived", async () => {
    let releaseBookDetail: () => void = () => undefined;
    bookDetailGate = new Promise((resolve) => {
      releaseBookDetail = resolve;
    });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(firstAppearancePageField(), "400");
    await userEvent.tab();
    expect(screen.queryByText("У книзі лише 300 сторінок")).not.toBeInTheDocument();

    releaseBookDetail();

    expect(await screen.findByText("У книзі лише 300 сторінок")).toBeInTheDocument();
    expect(firstAppearancePageField()).toHaveAttribute("max", "300");
  });

  it("sends the last page of the book as a number", async () => {
    renderEdit();

    await waitFor(() => expect(firstAppearancePageField()).toHaveAttribute("max", "300"));
    await userEvent.type(firstAppearancePageField(), "300");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("firstAppearancePage", 300);
  });

  it("keeps only the technical page limit when the book has no page count", async () => {
    servedPagesCount = null;
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await waitFor(() => expect(bookDetailRequests()).toEqual(["/api/books/book-1"]));
    expect(firstAppearancePageField()).toHaveAttribute("max", "2147483647");

    await userEvent.type(firstAppearancePageField(), "2147483648");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть номер сторінки числом")).toBeInTheDocument();
    expect(patchCount()).toBe(0);

    await userEvent.clear(firstAppearancePageField());
    await userEvent.type(firstAppearancePageField(), "5000");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("firstAppearancePage", 5000);
  });

  it("counts the characters of the first appearance note as they are typed", async () => {
    renderEdit();

    const note = await screen.findByRole("textbox", { name: /^Нотатка про першу появу/ });
    expect(note).toHaveAccessibleDescription("0/200");

    await userEvent.type(note, "У листі");

    expect(note).toHaveAccessibleDescription("7/200");
  });

  it("keeps a non-numeric chapter exactly as typed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /^Розділ/ }), "Пролог");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("firstAppearanceChapter", "Пролог");
  });

  it("lists the chapters the book already uses on focus and saves the picked one", async () => {
    servedChapters = [
      { chapter: "Голос розуму", count: 4 },
      { chapter: "Пролог", count: 2 },
    ];
    renderEdit();

    const chapterField = await screen.findByRole("combobox", { name: /^Розділ/ });
    await userEvent.click(chapterField);

    expect(
      await screen.findByRole("option", { name: "Голос розуму використано 4 рази" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await userEvent.click(screen.getByRole("option", { name: "Пролог використано 2 рази" }));
    expect(chapterField).toHaveValue("Пролог");

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("firstAppearanceChapter", "Пролог");
  });
});

describe("CharacterEditPage spoilers", () => {
  it("opens collapsed and keeps hide-presence separate from the granular switches", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(
      screen.getByRole("switch", { name: "Приховати сам факт появи персонажа" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Моє враження" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Налаштувати, що саме приховати" }));

    expect(await screen.findByRole("switch", { name: "Моє враження" })).toBeInTheDocument();
  });

  it("keeps the granular settings when hide presence is turned on", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Налаштувати, що саме приховати" }));
    await userEvent.click(screen.getByRole("switch", { name: "Моє враження" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Приховати сам факт появи персонажа" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      hidePresenceAsSpoiler: true,
      personalImpressionIsSpoiler: true,
    });
  });

  it("offers no spoiler switch for the point of view or the first appearance", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Налаштувати, що саме приховати" }));

    expect(screen.getAllByRole("switch")).toHaveLength(9);
    expect(screen.queryByRole("switch", { name: "Перша поява" })).not.toBeInTheDocument();
  });
});

function previewRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Попередній перегляд" });
}

describe("CharacterEditPage layout by mode", () => {
  it("lays out the six book sections in reading order", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const sectionTitles = [
      "У цій книзі",
      "Роль у розповіді",
      "Про персонажа",
      "Лише для цієї книги",
      "Інші імена",
      "Спойлери",
    ];
    const renderedTitles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent ?? "")
      .filter((title) => sectionTitles.includes(title));

    expect(renderedTitles).toEqual(sectionTitles);
  });

  it("renders only the shared sections without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("heading", { level: 2, name: "Про персонажа" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Інші імена" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Роль у розповіді" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Лише для цієї книги" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Спойлери" })).not.toBeInTheDocument();
  });

  it("shows the image panel with the book image choice next to the preview in a book context", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(imagesPanel()).toBeInTheDocument();
    expect(mainAvatarGroup()).toBeInTheDocument();
    expect(bookImageSource()).toBeInTheDocument();
    expect(previewRegion()).toBeInTheDocument();
  });

  it("shows only the main avatar in the image panel without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(previewRegion()).toBeInTheDocument();
    expect(within(mainAvatarGroup()).getByRole("button", { name: "Додати" })).toBeInTheDocument();
    expect(within(imagesPanel()).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(imagesPanel()).queryByText("Зображення в цій книзі")).not.toBeInTheDocument();
  });
});

const uploadedPortrait: MediaView = {
  contentType: "image/png",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 512,
  id: "media-portrait-1",
  kind: "avatar",
  name: "portrait.png",
  sizeBytes: 2048,
  urls: {
    card: "https://media.dev.book-nest.net/portrait-card.webp",
    full: "https://media.dev.book-nest.net/portrait-full.webp",
    thumb: "https://media.dev.book-nest.net/portrait-thumb.webp",
  },
  width: 512,
};

class LoadedImage extends EventTarget {
  complete = true;
  crossOrigin: null | string = null;
  naturalWidth = 1;
  referrerPolicy = "";
  src = "";
}

function bookImageSource(): HTMLElement {
  return within(imagesPanel()).getByRole("radiogroup", { name: "Зображення в цій книзі" });
}

function bookPortraitGroup(): HTMLElement {
  return within(imagesPanel()).getByRole("group", { name: "Окремий портрет для цієї книги" });
}

async function chooseImageFile(group: HTMLElement, fileInputLabel = "Додати") {
  await userEvent.upload(
    within(group).getByLabelText(fileInputLabel),
    new File(["portrait-bytes"], "portrait.png", { type: "image/png" }),
  );
}

function imagesPanel(): HTMLElement {
  return screen.getByRole("region", { name: "Зображення персонажа" });
}

function mainAvatarGroup(): HTMLElement {
  return within(imagesPanel()).getByRole("group", { name: "Основний аватар" });
}

async function selectBookPortrait() {
  await userEvent.click(
    within(bookImageSource()).getByRole("radio", { name: "Окремий портрет для цієї книги" }),
  );
}

async function selectMainAvatar() {
  await userEvent.click(within(bookImageSource()).getByRole("radio", { name: "Основний аватар" }));
}

function serveMediaUpload(respond: () => Promise<Response>) {
  const pageFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && String(input).includes("/api/media")) return respond();
    return pageFetch?.(input, init);
  });
}

async function uploadBookPortrait() {
  await selectBookPortrait();
  await chooseImageFile(bookPortraitGroup());
  await within(bookPortraitGroup()).findByRole("button", { name: "Замінити" });
}

describe("CharacterEditPage live preview", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", LoadedImage);
    serveMediaUpload(() => Promise.resolve(jsonResponse(uploadedPortrait, 201)));
  });

  it("shows the global name while the display name is inherited", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("follows the global name as it is typed, before saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");

    expect(
      within(previewRegion()).getByRole("heading", { name: "Ґеральт із Рівії" }),
    ).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });

  it("shows the book display name once it is overridden", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Біловолосий");

    expect(
      within(previewRegion()).getByRole("heading", { name: "Біловолосий" }),
    ).toBeInTheDocument();
    expect(
      within(previewRegion()).queryByRole("heading", { name: "Ґеральт" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the global name while the overridden display name is blank", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "   ");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("returns to the global name when the display name is reset", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Біловолосий");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Використовувати основне значення" }),
    );

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(
      within(previewRegion()).queryByRole("heading", { name: "Біловолосий" }),
    ).not.toBeInTheDocument();
  });

  it("shows the book importance as the role and the book status as a trait", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByText("Центральний")).toBeInTheDocument();
    expect(within(previewRegion()).getByText("Живий")).toBeInTheDocument();
  });

  it("adds the POV trait once the character becomes a point of view", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(within(previewRegion()).queryByText("POV")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("switch", { name: "Персонаж із власною перспективою (POV)" }),
    );

    expect(within(previewRegion()).getByText("POV")).toBeInTheDocument();
  });

  it("shows no book role or trait without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(within(previewRegion()).queryByText("Центральний")).not.toBeInTheDocument();
    expect(within(previewRegion()).queryByText("Живий")).not.toBeInTheDocument();
  });

  it("shows an uploaded portrait in the preview before saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(within(previewRegion()).queryByRole("img")).not.toBeInTheDocument();

    await uploadBookPortrait();

    expect(within(previewRegion()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(patchCount()).toBe(0);
  });

  it("returns the preview to the initial fallback when the book goes back to the main avatar", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadBookPortrait();
    await selectMainAvatar();

    expect(within(previewRegion()).queryByRole("img")).not.toBeInTheDocument();
    expect(within(previewRegion()).getByText("Ґ")).toBeInTheDocument();
  });

  it("follows a new main avatar while the book inherits it", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());

    expect(await within(previewRegion()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(patchCount()).toBe(0);
  });

  it("follows a new main avatar without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());

    expect(await within(previewRegion()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
  });
});

const globalAvatar: MediaView = {
  ...uploadedPortrait,
  id: "media-avatar-1",
  name: "avatar.png",
  urls: {
    card: "https://media.dev.book-nest.net/avatar-card.webp",
    full: "https://media.dev.book-nest.net/avatar-full.webp",
    thumb: "https://media.dev.book-nest.net/avatar-thumb.webp",
  },
};

const savedPortrait: MediaView = {
  ...uploadedPortrait,
  id: "media-saved-portrait-1",
  name: "saved-portrait.png",
  urls: {
    card: "https://media.dev.book-nest.net/saved-portrait-card.webp",
    full: "https://media.dev.book-nest.net/saved-portrait-full.webp",
    thumb: "https://media.dev.book-nest.net/saved-portrait-thumb.webp",
  },
};

function bookPatchUrls(): string[] {
  return fetchMock.mock.calls
    .filter(
      ([url, init]) =>
        (init?.method ?? "GET").toUpperCase() === "PATCH" && String(url).includes("/api/books/"),
    )
    .map(([url]) => String(url));
}

function holdImageUpload(response = jsonResponse(uploadedPortrait, 201)): () => void {
  let respond: (response: Response) => void = () => undefined;
  serveMediaUpload(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  return () => respond(response);
}

function imageFile(): File {
  return new File(["portrait-bytes"], "portrait.png", { type: "image/png" });
}

function mediaUploadCount(): number {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      (init?.method ?? "GET").toUpperCase() === "POST" && String(url).includes("/api/media"),
  ).length;
}

function serveCharacterImages({
  avatar = null,
  hiddenFields = [],
  portrait = null,
}: {
  avatar?: Nullable<MediaView>;
  hiddenFields?: string[];
  portrait?: Nullable<MediaView>;
}) {
  servedCharacter = {
    ...character,
    appearances: character.appearances.map((appearance) => ({
      ...appearance,
      hiddenFields,
      portrait,
    })),
    avatar,
  };
}

describe("CharacterEditPage main avatar", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", LoadedImage);
    serveMediaUpload(() => Promise.resolve(jsonResponse(uploadedPortrait, 201)));
  });

  function addButton(): HTMLElement {
    return within(mainAvatarGroup()).getByRole("button", { name: "Додати" });
  }

  it("shows the fallback and an add button while the character has no main avatar", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(mainAvatarGroup()).getByText("Ґ")).toBeInTheDocument();
    expect(within(mainAvatarGroup()).queryByRole("img")).not.toBeInTheDocument();
    expect(addButton()).toBeInTheDocument();
    expect(
      within(mainAvatarGroup()).queryByRole("button", { name: "Прибрати" }),
    ).not.toBeInTheDocument();
    expect(within(imagesPanel()).getByText("Основний аватар не додано")).toBeInTheDocument();
  });

  it("offers to replace or remove an existing main avatar", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(await within(mainAvatarGroup()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      globalAvatar.urls.card,
    );
    expect(within(mainAvatarGroup()).getByRole("button", { name: "Замінити" })).toBeInTheDocument();
    expect(within(mainAvatarGroup()).getByRole("button", { name: "Прибрати" })).toBeInTheDocument();
    expect(within(imagesPanel()).queryByText("Основний аватар не додано")).not.toBeInTheDocument();
  });

  it("saves a newly added main avatar through the global update only", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());
    await within(mainAvatarGroup()).findByRole("button", { name: "Замінити" });
    expect(patchCount()).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("avatarMediaId", uploadedPortrait.id);
    expect(bookPatchBody()).toBeUndefined();
  });

  it("saves a replaced main avatar", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup(), "Замінити");
    expect(await within(mainAvatarGroup()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("avatarMediaId", uploadedPortrait.id);
  });

  it("clears the main avatar on save once it is removed and moves focus to the add button", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(within(mainAvatarGroup()).getByRole("button", { name: "Прибрати" }));

    expect(within(mainAvatarGroup()).queryByRole("img")).not.toBeInTheDocument();
    expect(addButton()).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("avatarMediaId", null);
    expect(bookPatchBody()).toBeUndefined();
  });

  it("saves the main avatar without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());
    await within(mainAvatarGroup()).findByRole("button", { name: "Замінити" });
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("avatarMediaId", uploadedPortrait.id);
    expect(bookPatchBody()).toBeUndefined();
  });

  it("announces the upload and locks the button while the image is uploading", async () => {
    holdImageUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());

    await waitFor(() =>
      expect(within(mainAvatarGroup()).getByRole("status")).toHaveTextContent(
        "Завантажуємо зображення…",
      ),
    );
    expect(addButton()).toBeDisabled();
  });

  it("keeps the status region mounted and empty until the upload starts", async () => {
    holdImageUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const status = within(mainAvatarGroup()).getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await chooseImageFile(mainAvatarGroup());

    await waitFor(() => expect(status).toHaveTextContent("Завантажуємо зображення…"));
  });

  it("drops the upload status and shows the image once the upload finishes", async () => {
    const finishUpload = holdImageUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());
    await within(mainAvatarGroup()).findByText("Завантажуємо зображення…");
    finishUpload();

    expect(await within(mainAvatarGroup()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(
      within(mainAvatarGroup()).queryByText("Завантажуємо зображення…"),
    ).not.toBeInTheDocument();
  });

  it("leaves focus on the field the user moved to while the upload was running", async () => {
    const finishUpload = holdImageUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());
    await within(mainAvatarGroup()).findByText("Завантажуємо зображення…");
    const nameField = screen.getByRole("textbox", { name: "Ім’я" });
    await userEvent.click(nameField);
    finishUpload();

    await within(mainAvatarGroup()).findByRole("button", { name: "Замінити" });
    expect(nameField).toHaveFocus();
  });

  it("returns focus to the re-enabled button when the upload fails", async () => {
    const failUpload = holdImageUpload(jsonResponse({ message: "boom" }, 500));
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());
    await waitFor(() => expect(addButton()).toBeDisabled());
    failUpload();

    await waitFor(() => expect(addButton()).toHaveFocus());
    expect(addButton()).toBeEnabled();
  });

  it("moves focus to the replace button once the upload finishes", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup());

    expect(
      await within(mainAvatarGroup()).findByRole("button", { name: "Замінити" }),
    ).toHaveFocus();
  });

  it("locks the remove button while a replacement upload is in flight", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    holdImageUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await chooseImageFile(mainAvatarGroup(), "Замінити");

    await waitFor(() =>
      expect(within(mainAvatarGroup()).getByRole("button", { name: "Прибрати" })).toBeDisabled(),
    );
  });

  it("describes the add button with the clipboard shortcut", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(addButton()).toHaveAccessibleDescription("або вставте зображення з буфера (Ctrl/Cmd+V)");
  });

  it("highlights the row while an image is dragged over it and calms down when it leaves", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    fireEvent.dragEnter(addButton(), { dataTransfer: { types: ["Files"] } });

    expect(within(mainAvatarGroup()).getByText("Відпустіть, щоб завантажити")).toBeVisible();

    fireEvent.dragLeave(addButton());

    expect(
      within(mainAvatarGroup()).queryByText("Відпустіть, щоб завантажити"),
    ).not.toBeInTheDocument();
    expect(mediaUploadCount()).toBe(0);
  });

  it("stays calm while dragged text rather than a file passes over the row", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    fireEvent.dragEnter(addButton(), { dataTransfer: { types: ["text/plain"] } });

    expect(
      within(mainAvatarGroup()).queryByText("Відпустіть, щоб завантажити"),
    ).not.toBeInTheDocument();
  });

  it("explains on hover that removing the main avatar leaves inheriting books with a placeholder", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.hover(within(mainAvatarGroup()).getByRole("button", { name: "Прибрати" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Прибрати основний аватар. Книги без окремого портрета використовуватимуть заглушку.",
    );
  });

  it("uploads an image dropped onto the main avatar and saves it", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    fireEvent.dragEnter(addButton(), { dataTransfer: { types: ["Files"] } });
    fireEvent.drop(addButton(), { dataTransfer: { files: [imageFile()] } });

    expect(await within(mainAvatarGroup()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(
      within(mainAvatarGroup()).queryByText("Відпустіть, щоб завантажити"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("avatarMediaId", uploadedPortrait.id);
  });

  it("uploads an image pasted while the main avatar block has focus", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    addButton().focus();
    fireEvent.paste(addButton(), { clipboardData: { files: [imageFile()] } });

    expect(await within(mainAvatarGroup()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
  });

  it("ignores a paste that carries no image", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    fireEvent.paste(addButton(), {
      clipboardData: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] },
    });

    expect(mediaUploadCount()).toBe(0);
    expect(within(mainAvatarGroup()).queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("CharacterEditPage book image", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", LoadedImage);
    serveMediaUpload(() => Promise.resolve(jsonResponse(uploadedPortrait, 201)));
  });

  function saveButton(): HTMLElement {
    return screen.getByRole("button", { name: /Зберегти/ });
  }

  it("uses the main avatar while the book has no portrait of its own", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(bookImageSource()).getByRole("radio", { name: "Основний аватар" })).toBeChecked();
    expect(
      within(imagesPanel()).queryByRole("group", { name: "Окремий портрет для цієї книги" }),
    ).not.toBeInTheDocument();
    expect(
      within(bookImageSource()).getByRole("radio", { name: "Основний аватар" }),
    ).toHaveAccessibleDescription("Основний аватар не додано");
    expect(within(imagesPanel()).queryByText("Діє тільки для цієї книги")).not.toBeInTheDocument();
  });

  it("describes only the active source and follows it when the source changes", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const mainOption = within(bookImageSource()).getByRole("radio", { name: "Основний аватар" });
    const bookOption = within(bookImageSource()).getByRole("radio", {
      name: "Окремий портрет для цієї книги",
    });

    expect(mainOption).toHaveAccessibleDescription("Використовується основний аватар");
    expect(bookOption).not.toHaveAccessibleDescription();
    expect(within(imagesPanel()).queryByText("Діє тільки для цієї книги")).not.toBeInTheDocument();

    await selectBookPortrait();

    expect(bookOption).toHaveAccessibleDescription("Діє тільки для цієї книги");
    expect(mainOption).not.toHaveAccessibleDescription();
    expect(
      within(imagesPanel()).queryByText("Використовується основний аватар"),
    ).not.toBeInTheDocument();
  });

  it("tells the main source that no main avatar is left once it is removed", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(within(mainAvatarGroup()).getByRole("button", { name: "Прибрати" }));

    expect(
      within(bookImageSource()).getByRole("radio", { name: "Основний аватар" }),
    ).toHaveAccessibleDescription("Основний аватар не додано");
    expect(within(previewRegion()).queryByRole("img")).not.toBeInTheDocument();
  });

  it("picks the separate image when the book already has its own portrait", async () => {
    serveCharacterImages({ avatar: globalAvatar, portrait: savedPortrait });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(
      within(bookImageSource()).getByRole("radio", { name: "Окремий портрет для цієї книги" }),
    ).toBeChecked();
    expect(
      await within(bookPortraitGroup()).findByRole("img", { name: "Ґеральт" }),
    ).toHaveAttribute("src", savedPortrait.urls.card);
    expect(
      within(bookPortraitGroup()).getByRole("button", { name: "Замінити" }),
    ).toBeInTheDocument();
    expect(
      within(bookPortraitGroup()).queryByRole("button", { name: "Прибрати" }),
    ).not.toBeInTheDocument();
  });

  it("shows the uploader without overriding the main avatar until a file is chosen", async () => {
    serveCharacterImages({ avatar: globalAvatar });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await selectBookPortrait();

    expect(within(bookPortraitGroup()).getByRole("button", { name: "Додати" })).toBeInTheDocument();
    expect(within(bookPortraitGroup()).queryByRole("img")).not.toBeInTheDocument();
    expect(await within(previewRegion()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      globalAvatar.urls.card,
    );
    expect(saveButton()).toBeDisabled();
  });

  it("saves an uploaded book portrait for this book only", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadBookPortrait();
    expect(patchCount()).toBe(0);
    await userEvent.click(saveButton());

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("portraitMediaId", uploadedPortrait.id);
    expect(globalPatchBody()).toBeUndefined();
    expect(bookPatchUrls()).toEqual([
      expect.stringContaining("/api/books/book-1/characters/char-1"),
    ]);
  });

  it("restores the temporary book portrait after switching back before saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadBookPortrait();
    await selectMainAvatar();

    expect(
      within(imagesPanel()).queryByRole("group", { name: "Окремий портрет для цієї книги" }),
    ).not.toBeInTheDocument();
    expect(within(previewRegion()).queryByRole("img")).not.toBeInTheDocument();

    await selectBookPortrait();

    expect(within(bookPortraitGroup()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(within(previewRegion()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
  });

  it("keeps the form clean when a temporary book portrait is dropped before saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadBookPortrait();
    expect(saveButton()).toBeEnabled();

    await selectMainAvatar();

    expect(saveButton()).toBeDisabled();
  });

  it("resets a saved book portrait to the main avatar on save", async () => {
    serveCharacterImages({ avatar: globalAvatar, portrait: savedPortrait });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await selectMainAvatar();

    expect(within(previewRegion()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      globalAvatar.urls.card,
    );

    await userEvent.click(saveButton());

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("portraitMediaId", null);
    expect(globalPatchBody()).toBeUndefined();
  });

  it("brings back the saved book portrait with nothing left to save", async () => {
    serveCharacterImages({ portrait: savedPortrait });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await selectMainAvatar();
    expect(saveButton()).toBeEnabled();

    await selectBookPortrait();

    expect(
      await within(bookPortraitGroup()).findByRole("img", { name: "Ґеральт" }),
    ).toHaveAttribute("src", savedPortrait.urls.card);
    expect(saveButton()).toBeDisabled();
  });

  it("keeps the book portrait in the preview while the main avatar changes", async () => {
    serveCharacterImages({ avatar: globalAvatar, portrait: savedPortrait });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(await within(previewRegion()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      savedPortrait.urls.card,
    );

    await chooseImageFile(mainAvatarGroup(), "Замінити");
    await within(mainAvatarGroup()).findByRole("img", { name: "Ґеральт" });

    expect(within(previewRegion()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      savedPortrait.urls.card,
    );
  });

  it("keeps a spoiler-masked book portrait hidden and out of the save", async () => {
    serveCharacterImages({ avatar: globalAvatar, hiddenFields: ["portrait"] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");

    expect(within(imagesPanel()).getByText("Приховано (спойлер)")).toBeInTheDocument();
    expect(within(imagesPanel()).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(mainAvatarGroup()).getByRole("button", { name: "Замінити" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(saveButton());

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).not.toHaveProperty("portraitMediaId");
  });

  it("uploads a dropped image as the book portrait without touching the main avatar", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await selectBookPortrait();
    fireEvent.drop(within(bookPortraitGroup()).getByRole("button", { name: "Додати" }), {
      dataTransfer: { files: [imageFile()] },
    });

    expect(
      await within(bookPortraitGroup()).findByRole("img", { name: "Ґеральт" }),
    ).toHaveAttribute("src", uploadedPortrait.urls.card);
    expect(within(mainAvatarGroup()).queryByRole("img")).not.toBeInTheDocument();

    await userEvent.click(saveButton());

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("portraitMediaId", uploadedPortrait.id);
    expect(globalPatchBody()).toBeUndefined();
  });

  it("pastes into the block that has focus only", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await selectBookPortrait();
    const bookAddButton = within(bookPortraitGroup()).getByRole("button", { name: "Додати" });
    bookAddButton.focus();
    fireEvent.paste(bookAddButton, { clipboardData: { files: [imageFile()] } });

    expect(
      await within(bookPortraitGroup()).findByRole("img", { name: "Ґеральт" }),
    ).toHaveAttribute("src", uploadedPortrait.urls.card);
    expect(within(mainAvatarGroup()).queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("CharacterEditPage preview card", () => {
  it("renders the preview card without a link or any action button", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(within(previewRegion()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(previewRegion()).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("CharacterEditPage field requirements", () => {
  it("marks the name as required for assistive technology", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveAttribute("aria-required", "true");
  });

  it("refuses an emptied name and links the error to the field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const name = screen.getByRole("textbox", { name: "Ім’я" });
    expect(name).toHaveAttribute("aria-invalid", "false");

    await userEvent.clear(name);
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть ім'я")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Вкажіть ім'я");
    expect(patchCount()).toBe(0);
  });

  it("marks the optional text fields as optional in their accessible names", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("combobox", { name: "Вид (необов’язково)" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Займенники (необов’язково)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа (необов’язково)" }),
    ).toBeInTheDocument();
  });

  it("keeps the optional marker off the required name and the selects", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Важливість" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Гендер" })).toBeInTheDocument();
  });

  it("suggests an example in each text field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveAttribute(
      "placeholder",
      "Наприклад, Ґеральт із Рівії",
    );
    expect(screen.getByRole("combobox", { name: "Вид (необов’язково)" })).toHaveAttribute(
      "placeholder",
      "Пошук, наприклад «ельф»",
    );
    expect(screen.getByRole("combobox", { name: "Займенники (необов’язково)" })).toHaveAttribute(
      "placeholder",
      "Оберіть зі списку або введіть свій…",
    );
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа (необов’язково)" }),
    ).toHaveAttribute("placeholder", "Хто цей персонаж поза межами окремої книги…");
  });

  it("caps each text field at its own length", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveAttribute("maxlength", "200");
    expect(screen.getByRole("combobox", { name: "Вид (необов’язково)" })).toHaveAttribute(
      "maxlength",
      "60",
    );
    expect(screen.getByRole("combobox", { name: "Займенники (необов’язково)" })).toHaveAttribute(
      "maxlength",
      "60",
    );
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа (необов’язково)" }),
    ).toHaveAttribute("maxlength", "5000");
  });

  it("describes a long-text field with a live character count", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const description = screen.getByRole("textbox", { name: "Дані в цій книзі (необов’язково)" });
    expect(description).toHaveAccessibleDescription("12/5000");

    await userEvent.type(description, " ще трохи");

    expect(description).toHaveAccessibleDescription("21/5000");
  });

  it("names the roles picker once, with a visible caption that is neither a label nor announced", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getAllByRole("combobox", { name: "Ролі" })).toHaveLength(1);
    expect(screen.getByText("Ролі", { ignore: "label, script, style" })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("CharacterEditPage text over the limit", () => {
  async function saveAfterRenamingTheCharacter() {
    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
  }

  it("refuses a saved global description longer than 5000 characters", async () => {
    servedCharacter = { ...character, neutralDescription: "а".repeat(5001) };
    renderEdit();

    await saveAfterRenamingTheCharacter();

    expect(await screen.findByText("Текст задовгий (макс. 5000)")).toBeInTheDocument();
    const description = screen.getByRole("textbox", {
      name: "Коротко про персонажа (необов’язково)",
    });
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAccessibleDescription(/^Текст задовгий \(макс\. 5000\)/);
    expect(patchCount()).toBe(0);
  });

  it("shows the error inside an overridden book field that is too long", async () => {
    servedCharacter = {
      ...character,
      appearances: character.appearances.map((appearance) => ({
        ...appearance,
        displayName: "м".repeat(201),
      })),
    };
    renderEdit();

    await saveAfterRenamingTheCharacter();

    const displayNameInBook = inheritedField("Ім’я в цій книзі");
    expect(
      await within(displayNameInBook).findByText("Текст задовгий (макс. 200)"),
    ).toBeInTheDocument();
    const input = within(displayNameInBook).getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Текст задовгий (макс. 200)");
    expect(patchCount()).toBe(0);
  });

  it("caps the species in this book at the same length as the shared species", async () => {
    renderEdit();

    await screen.findByDisplayValue("Мутант");

    expect(within(inheritedField("Вид у цій книзі")).getByRole("combobox")).toHaveAttribute(
      "maxlength",
      "60",
    );
    expect(screen.getByRole("combobox", { name: "Вид (необов’язково)" })).toHaveAttribute(
      "maxlength",
      "60",
    );
  });
});

describe("CharacterEditPage status", () => {
  function servedWithBookStatus(
    status: BookCharacterStatus,
    statusCustomText: Nullable<string>,
  ): CharacterDetailsView {
    return {
      ...character,
      appearances: character.appearances.map((appearance) => ({
        ...appearance,
        status,
        statusCustomText,
      })),
    };
  }

  function statusCombobox(): HTMLElement {
    return screen.getByRole("combobox", { name: "Статус" });
  }

  it("sends a picked standard status with no custom text in the book update only", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(statusCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Мертвий" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({ status: "dead", statusCustomText: null });
    expect(globalPatchBody()).toBeUndefined();
  });

  it("sends a created custom status with its text", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await typeOver(statusCombobox(), "У полоні{Enter}");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({ status: "other", statusCustomText: "У полоні" });
  });

  it("shows an existing custom status as its text", async () => {
    servedCharacter = servedWithBookStatus("other", "Зник безвісти");
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(statusCombobox()).toHaveValue("Зник безвісти");
    expect(screen.queryByDisplayValue("Інше")).not.toBeInTheDocument();
  });

  it("sends a standard status without the old custom text once a custom status is replaced", async () => {
    servedCharacter = servedWithBookStatus("other", "Зник безвісти");
    renderEdit();

    await screen.findByDisplayValue("Зник безвісти");
    await userEvent.click(statusCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Живий" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({ status: "active", statusCustomText: null });
  });

  it("offers the matching standard status instead of a use-custom option for its name typed in lower case", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await typeOver(statusCombobox(), "живий");

    expect(await screen.findByRole("option", { name: "Живий" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Використати/ })).not.toBeInTheDocument();
  });

  it("does not save the form when Enter uses a custom status", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await typeOver(statusCombobox(), "У полоні{Enter}");

    expect(statusCombobox()).toHaveValue("У полоні");
    expect(patchCount()).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps a picked custom status local and marked not saved, sending nothing, until the form is saved", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await typeOver(statusCombobox(), "У полоні");
    await userEvent.click(await screen.findByRole("option", { name: "Використати «У полоні»" }));
    await userEvent.click(statusCombobox());

    expect(
      await screen.findByRole("option", { name: "У полоні", selected: true }),
    ).toHaveAccessibleDescription("Не збережено");
    expect(
      fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET").toUpperCase() !== "GET"),
    ).toEqual([]);
  });

  it("has no separate custom status field", async () => {
    servedCharacter = servedWithBookStatus("other", "Зник безвісти");
    renderEdit();

    await screen.findByDisplayValue("Зник безвісти");

    expect(screen.queryByRole("textbox", { name: /Свій статус/ })).not.toBeInTheDocument();
  });

  it("shows a legacy custom status without text as «Інше»", async () => {
    servedCharacter = servedWithBookStatus("other", null);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(statusCombobox()).toHaveValue("Інше");
  });

  it("keeps a legacy custom status without text when an unrelated book field is saved", async () => {
    servedCharacter = servedWithBookStatus("other", null);
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      description: "Опис у книзі ще трохи",
      status: "other",
      statusCustomText: null,
    });
  });

  it("offers your statuses with counts and sends a picked one as the custom status with its text", async () => {
    servedCustomLabels = { roles: [], statuses: [{ count: 2, label: "У полоні" }] };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(statusCombobox());
    const yourStatuses = await screen.findByRole("group", { name: "Ваші статуси" });
    await userEvent.click(
      within(yourStatuses).getByRole("option", { name: "У полоні використано 2 рази" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({ status: "other", statusCustomText: "У полоні" });
  });

  it("shows a created custom status in the preview instead of «Інше»", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await typeOver(statusCombobox(), "У полоні{Enter}");

    expect(within(previewRegion()).getByText("У полоні")).toBeInTheDocument();
    expect(within(previewRegion()).queryByText("Інше")).not.toBeInTheDocument();
  });
});

describe("CharacterEditPage your roles", () => {
  function rolesCombobox(): HTMLElement {
    return screen.getByRole("combobox", { name: "Ролі" });
  }

  beforeEach(() => {
    servedCustomLabels = { roles: [{ count: 3, label: "Наставник Цірі" }], statuses: [] };
  });

  it("offers your roles with counts and sends a picked one as a custom role", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(rolesCombobox());
    const yourRoles = await screen.findByRole("group", { name: "Ваші ролі" });
    await userEvent.click(
      within(yourRoles).getByRole("option", { name: "Наставник Цірі використано 3 рази" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      roles: [{ customRole: "Наставник Цірі", isSpoiler: false, position: 0, roleType: "custom" }],
    });
  });

  it("offers your role instead of creating it again when typed in another case with stray spaces", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await waitFor(() => expect(customLabelRequests()).toHaveLength(1));
    await userEvent.type(rolesCombobox(), "  наставник   ЦІРІ ");

    expect(
      await screen.findByRole("option", { name: "Наставник Цірі використано 3 рази" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });
});

describe("CharacterEditPage gender", () => {
  const customGenderCharacter: CharacterDetailsView = {
    ...character,
    customGender: "Гендерфлюїдна",
    gender: "custom",
  };

  function genderCombobox(): HTMLElement {
    return screen.getByRole("combobox", { name: "Гендер" });
  }

  it("sends a created custom gender with its text in the global update only", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await typeOver(genderCombobox(), "Гендерфлюїдна{Enter}");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toMatchObject({ customGender: "Гендерфлюїдна", gender: "custom" });
    expect(bookPatchBody()).toBeUndefined();
  });

  it("shows an existing custom gender as its text", async () => {
    servedCharacter = customGenderCharacter;
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(genderCombobox()).toHaveValue("Гендерфлюїдна");
    expect(screen.queryByDisplayValue("Свій варіант")).not.toBeInTheDocument();
  });

  it("sends a standard gender without the old custom text once a custom gender is replaced", async () => {
    servedCharacter = customGenderCharacter;
    renderEdit();

    await screen.findByDisplayValue("Гендерфлюїдна");
    await userEvent.click(genderCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Жіноча" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toMatchObject({ customGender: null, gender: "female" });
  });

  it("offers no custom sentinel in the open gender list", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(genderCombobox());

    expect(await screen.findByRole("option", { name: "Жіноча" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Свій варіант" })).not.toBeInTheDocument();
  });

  it("keeps your statuses and roles out of the gender list", async () => {
    servedCustomLabels = {
      roles: [{ count: 3, label: "Наставник Цірі" }],
      statuses: [{ count: 2, label: "У полоні" }],
    };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await waitFor(() => expect(customLabelRequests()).toHaveLength(1));
    await userEvent.click(genderCombobox());

    const genders = await screen.findByRole("listbox", { name: "Гендер" });
    expect(within(genders).queryByRole("group")).not.toBeInTheDocument();
    expect(within(genders).queryByRole("option", { name: /У полоні|Наставник/ })).toBeNull();
  });

  it("has no separate custom gender field", async () => {
    servedCharacter = customGenderCharacter;
    renderEdit();

    await screen.findByDisplayValue("Гендерфлюїдна");

    expect(screen.queryByRole("textbox", { name: "Свій варіант" })).not.toBeInTheDocument();
  });

  it("requires the text of a custom gender, describes the gender combobox with the error and sends nothing", async () => {
    servedCharacter = { ...character, customGender: null, gender: "custom" };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть свій гендер")).toBeInTheDocument();
    expect(genderCombobox()).toHaveAccessibleDescription("Вкажіть свій гендер");
    expect(patchCount()).toBe(0);
  });

  describe("with a legacy custom gender that has no text", () => {
    async function saveAfterRenaming() {
      servedCharacter = { ...character, customGender: null, gender: "custom" };
      renderEdit();
      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), " із Рівії");
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
    }

    it("focuses the gender combobox on save and sends nothing", async () => {
      await saveAfterRenaming();

      await waitFor(() => expect(genderCombobox()).toHaveFocus());
      expect(patchCount()).toBe(0);
    });

    it("clears the error once a custom gender text is created", async () => {
      await saveAfterRenaming();
      expect(await screen.findByText("Вкажіть свій гендер")).toBeInTheDocument();
      expect(genderCombobox()).toHaveAttribute("aria-invalid", "true");

      await typeOver(genderCombobox(), "Гендерфлюїдна{Enter}");

      await waitFor(() =>
        expect(screen.queryByText("Вкажіть свій гендер")).not.toBeInTheDocument(),
      );
      expect(genderCombobox()).not.toHaveAttribute("aria-invalid", "true");
    });

    it("clears the error once a standard gender is picked", async () => {
      await saveAfterRenaming();
      expect(await screen.findByText("Вкажіть свій гендер")).toBeInTheDocument();
      expect(genderCombobox()).toHaveAttribute("aria-invalid", "true");

      await userEvent.click(genderCombobox());
      await userEvent.click(await screen.findByRole("option", { name: "Жіноча" }));

      await waitFor(() =>
        expect(screen.queryByText("Вкажіть свій гендер")).not.toBeInTheDocument(),
      );
      expect(genderCombobox()).not.toHaveAttribute("aria-invalid", "true");
    });
  });
});

describe("CharacterEditPage pronouns", () => {
  function pronounsCombobox(): HTMLElement {
    return screen.getByRole("combobox", { name: "Займенники (необов’язково)" });
  }

  it("loads stored pronouns in another language as their preset and saves a newly picked preset as its label", async () => {
    servedCharacter = { ...character, pronouns: "he/him" };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(pronounsCombobox()).toHaveValue("він/його");
    await userEvent.click(pronounsCombobox());
    expect(await screen.findByRole("option", { name: "він/його" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(screen.getByRole("option", { name: "вона/її" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toMatchObject({ pronouns: "вона/її" });
  });

  it("saves typed pronouns that match no preset as free text", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(pronounsCombobox(), "  ксе/їх ");
    await userEvent.click(await screen.findByRole("option", { name: "Використати «ксе/їх»" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toMatchObject({ pronouns: "ксе/їх" });
    expect(pronounsCombobox()).toHaveValue("ксе/їх");
  });

  it("shows legacy pronouns as they are and sends them unchanged when another field is saved", async () => {
    servedCharacter = { ...character, pronouns: "Він (у другій книзі — вона)" };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(pronounsCombobox()).toHaveValue("Він (у другій книзі — вона)");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toMatchObject({ pronouns: "Він (у другій книзі — вона)" });
  });
});

describe("CharacterEditPage spoiler collections round trip", () => {
  const roles: BookCharacterView["roles"] = [
    { customRole: null, id: "role-plain", isSpoiler: false, position: 0, roleType: "protagonist" },
    {
      customRole: null,
      id: "role-spoiler",
      isSpoiler: true,
      position: 1,
      roleType: "love_interest",
    },
  ];

  const aliases: CharacterDetailsView["aliases"] = [
    {
      bookId: null,
      id: "alias-global",
      isSpoiler: true,
      name: "Білий Вовк",
      position: 0,
      type: "title",
    },
    {
      bookId: "book-1",
      id: "alias-book",
      isSpoiler: true,
      name: "Різник із Блавікену",
      position: 0,
      type: "title",
    },
  ];

  function serveWithHiddenFields({
    appearanceHiddenFields,
    characterHiddenFields,
  }: {
    appearanceHiddenFields: string[];
    characterHiddenFields: string[];
  }) {
    const isRolesMasked = appearanceHiddenFields.includes("roles");
    const isAliasesMasked = characterHiddenFields.includes("aliases");

    servedCharacter = makeCharacterDetails({
      aliases: isAliasesMasked ? [] : aliases,
      appearances: [
        makeBookCharacterView({
          bookId: "book-1",
          description: "Опис у книзі",
          hiddenFields: appearanceHiddenFields,
          importance: "central",
          roles: isRolesMasked ? [] : roles,
          speciesOverride: SPECIES_REFS.mutant,
          status: "active",
        }),
      ],
      gender: "male",
      hiddenFields: characterHiddenFields,
      name: "Ґеральт",
      species: SPECIES_REFS.witcher,
    });
  }

  it("sends the revealed spoiler role back untouched when another book field changes", async () => {
    serveWithHiddenFields({ appearanceHiddenFields: [], characterHiddenFields: [] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("roles", [
      { customRole: null, isSpoiler: false, position: 0, roleType: "protagonist" },
      { customRole: null, isSpoiler: true, position: 1, roleType: "love_interest" },
    ]);
  });

  it("sends the revealed spoiler alias of the book back untouched when another book field changes", async () => {
    serveWithHiddenFields({ appearanceHiddenFields: [], characterHiddenFields: [] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" },
    ]);
  });

  it("sends no roles and no aliases for the book while the server masks them", async () => {
    serveWithHiddenFields({
      appearanceHiddenFields: ["roles"],
      characterHiddenFields: ["aliases"],
    });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    const body = bookPatchBody();
    expect(body).not.toHaveProperty("roles");
    expect(body).not.toHaveProperty("aliases");
    expect(body).toHaveProperty("description", "Опис у книзі ще трохи");
  });

  it("sends no aliases for the character while the server masks them", async () => {
    serveWithHiddenFields({
      appearanceHiddenFields: ["roles"],
      characterHiddenFields: ["aliases"],
    });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    const body = globalPatchBody();
    expect(body).not.toHaveProperty("aliases");
    expect(body).toHaveProperty("name", "Ґеральт із Рівії");
  });
});
