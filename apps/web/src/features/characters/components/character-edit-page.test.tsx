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
  OwnSpeciesView,
  SpeciesOptionView,
  SpeciesUsage,
} from "@app/shared";
import type { ReactNode } from "react";

import { SpeciesNameInputSchema, SpeciesOptionViewSchema } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookDetailsView } from "@/features/books/components/book-details.fixtures";
import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
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

type ToastOptions = { action?: { label: string; onClick: () => void }; id?: string };

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn<(message: string, options?: ToastOptions) => void>(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
);

vi.mock("sonner", () => ({ toast: toastMock }));

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

const SPECIES_OPTIONS = {
  created: {
    category: null,
    id: "00000000-0000-4000-8000-0000000000aa",
    isOwn: true,
    key: null,
    name: "Фримен",
  },
  mutant: { category: null, id: SPECIES_REFS.mutant.id, isOwn: true, key: null, name: "Мутант" },
  witcher: {
    category: null,
    id: SPECIES_REFS.witcher.id,
    isOwn: false,
    key: "witcher",
    name: "Відьмак",
  },
} as const satisfies Record<string, SpeciesOptionView>;

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
        jsonResponse(makeBookDetailsView({ id: "book-1", pagesCount: servedPagesCount })),
      );
    }
    const { pathname, searchParams } = new URL(url, "http://localhost");
    if (method === "POST" && pathname === "/api/species") {
      const { name } = SpeciesNameInputSchema.parse(JSON.parse(String(init?.body)));
      return Promise.resolve(jsonResponse({ ...SPECIES_OPTIONS.created, name }, 201));
    }
    if (method === "GET" && pathname === "/api/species/browse") {
      return Promise.resolve(
        jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 30, totalCount: 0 }),
      );
    }
    if (method === "GET" && pathname === "/api/species/candidates") {
      return Promise.resolve(jsonResponse({ exact: null, similar: [] }));
    }
    if (method === "GET" && pathname === "/api/species") {
      const term = searchParams.get("q")?.toLowerCase() ?? "";
      const items = [SPECIES_OPTIONS.witcher, SPECIES_OPTIONS.mutant].filter((option) =>
        option.name.toLowerCase().includes(term),
      );
      return Promise.resolve(jsonResponse({ items }));
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

describe("CharacterEditPage return to the details context", () => {
  it.each([
    { href: "/characters/char-1?view=global", search: "view=global" },
    { href: "/characters/char-1?bookId=book-1", search: "bookId=book-1" },
    { href: "/characters/char-1", search: "" },
  ])("returns to $href after a cancel without changes", async ({ href, search }) => {
    renderEdit(search);

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(push).toHaveBeenCalledWith(href);
  });

  it("refuses to open the general editor for a book the character is not in", async () => {
    renderEdit("bookId=book-404");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Ґеральт")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Відкрити загальний профіль" })).toHaveAttribute(
      "href",
      "/characters/char-1?view=global",
    );
  });
});

describe("CharacterEditPage without a book context", () => {
  it("shows only the shared section", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.queryByRole("heading", { name: "Описи в цій книзі" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Основне про персонажа" })).toBeInTheDocument();
  });

  it("asks for no custom roles or statuses, since no book section needs them", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(customLabelRequests()).toEqual([]);
  });
});

function inheritedField(label: string): HTMLElement {
  const [shell, ...others] = screen.getAllByText(label).flatMap((element) => {
    const container = element.closest('[data-slot="inherited-field"]');
    return container instanceof HTMLElement ? [container] : [];
  });
  if (shell === undefined || others.length > 0) {
    throw new Error(`expected one inherited field labelled ${label}`);
  }
  return shell;
}

async function pickBookSpecies(option: string) {
  await userEvent.click(within(inheritedField("Вид у цій книзі")).getByRole("combobox"));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("CharacterEditPage inheritance", () => {
  it("shows the effective global value while the book value is inherited", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const displayName = inheritedField("Ім’я в цій книзі");
    expect(within(displayName).getByText("Ґеральт")).toBeInTheDocument();
    expect(within(displayName).getByText("Основне")).toBeInTheDocument();
    expect(
      within(displayName).getByRole("button", { name: "Змінити для книги" }),
    ).toBeInTheDocument();
  });

  it("prefills the book value from the global one and sends it on save", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");

    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));

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

    expect(within(species).getByText("Для книги")).toBeInTheDocument();
    await userEvent.click(within(species).getByRole("button", { name: "Повернути основне" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("speciesOverrideId", null);
  });

  it("moves focus into the book name editor prefilled with the main name once it opens", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));

    const input = within(displayName).getByRole("textbox");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Ґеральт");
    expect(within(displayName).getByText("Редагування")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it.each<{ dismiss: () => Promise<void>; how: string }>([
    {
      dismiss: () =>
        userEvent.click(
          within(inheritedField("Ім’я в цій книзі")).getByRole("button", {
            name: "Скасувати редагування",
          }),
        ),
      how: "its cancel action",
    },
    {
      dismiss: async () => {
        await userEvent.keyboard("{Escape}");
      },
      how: "Escape",
    },
  ])(
    "returns an unchanged book name editor to the main name on $how and focuses the action",
    async ({ dismiss }) => {
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const displayName = inheritedField("Ім’я в цій книзі");
      await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
      await dismiss();

      expect(within(displayName).queryByRole("textbox")).not.toBeInTheDocument();
      expect(within(displayName).getByText("Ґеральт")).toBeInTheDocument();
      expect(within(displayName).getByText("Основне")).toBeInTheDocument();
      expect(within(displayName).getByRole("button", { name: "Змінити для книги" })).toHaveFocus();
      expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
      expect(patchCount()).toBe(0);
    },
  );

  it("returns an unchanged book name editor to the main name once focus leaves it", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    await userEvent.tab();
    expect(within(displayName).getByRole("textbox")).toBeInTheDocument();
    await userEvent.tab();

    expect(within(displayName).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(displayName).getByText("Ґеральт")).toBeInTheDocument();
    expect(within(displayName).getByText("Основне")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it.each(["  Ґеральт  ", "   "])(
    "keeps the book name inherited and the editor open while the draft is %j",
    async (draft) => {
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const displayName = inheritedField("Ім’я в цій книзі");
      await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
      const input = within(displayName).getByRole("textbox");
      await userEvent.clear(input);
      await userEvent.type(input, draft);

      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
      expect(input).toHaveValue(draft);
      expect(within(displayName).getByText("Редагування")).toBeInTheDocument();
      expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    },
  );

  it("keeps typing in the editor and the form clean when a different draft is typed back to the main name", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    const input = within(displayName).getByRole("textbox");
    await typeOver(input, "Біловолосий");
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeEnabled();

    await typeOver(input, "Ґеральт");

    expect(input).toHaveFocus();
    expect(input).toHaveValue("Ґеральт");
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it("drops a typed book name when the editing is cancelled, before the blur can keep it", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    await typeOver(within(displayName).getByRole("textbox"), "Біловолосий");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Скасувати редагування" }),
    );

    expect(within(displayName).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(displayName).getByText("Основне")).toBeInTheDocument();
    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it("ends the editing on Enter with a typed book name kept editable, without saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    const input = within(displayName).getByRole("textbox");
    await typeOver(input, "Біловолосий");
    await userEvent.keyboard("{Enter}");

    expect(input).toHaveFocus();
    expect(input).toHaveValue("Біловолосий");
    expect(within(displayName).getByText("Для книги")).toBeInTheDocument();
    expect(
      within(displayName).getByRole("button", { name: "Повернути основне" }),
    ).toBeInTheDocument();
    expect(patchCount()).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("ends an unchanged editing on Enter back on the main name, without saving the changed form", async () => {
    renderEdit();

    await userEvent.type(
      await screen.findByRole("textbox", { name: /^Дані в цій книзі/ }),
      " ще трохи",
    );
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    await userEvent.keyboard("{Enter}");

    expect(within(displayName).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(displayName).getByRole("button", { name: "Змінити для книги" })).toHaveFocus();
    expect(patchCount()).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps a saved book name that equals the main name as the book's own, directly editable", async () => {
    serveBookValues({ displayName: "Ґеральт" });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const displayName = inheritedField("Ім’я в цій книзі");

    expect(within(displayName).getByRole("textbox")).toHaveValue("Ґеральт");
    expect(within(displayName).getByText("Для книги")).toBeInTheDocument();
    expect(
      within(displayName).getByRole("button", { name: "Повернути основне" }),
    ).toBeInTheDocument();
  });

  it("sends a saved book name that equals the main name unchanged when another book field is saved", async () => {
    serveBookValues({ displayName: "Ґеральт" });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("displayName", "Ґеральт");
  });

  it("resets a saved book name and its spoiler mark in the form only, until the form is saved", async () => {
    serveBookValues({ displayName: "Вовк із Рівії", displayNameIsSpoiler: true });
    renderEdit();

    await screen.findByDisplayValue("Вовк із Рівії");
    await userEvent.click(
      within(inheritedField("Ім’я в цій книзі")).getByRole("button", { name: "Повернути основне" }),
    );

    expect(patchCount()).toBe(0);
    expect(screen.getByRole("switch", { name: "Ім’я в цій книзі" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Ім’я в цій книзі" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({ displayName: null, displayNameIsSpoiler: false });
  });

  it("keeps the spoiler mark of a saved book name whose text is edited", async () => {
    serveBookValues({ displayName: "Вовк із Рівії", displayNameIsSpoiler: true });
    renderEdit();

    await userEvent.type(await screen.findByDisplayValue("Вовк із Рівії"), ", Білий Вовк");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      displayName: "Вовк із Рівії, Білий Вовк",
      displayNameIsSpoiler: true,
    });
  });

  it("shows the main name as it is typed in the inherited book name and the preview, sending nothing", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");

    expect(
      within(inheritedField("Ім’я в цій книзі")).getByText("Ґеральт із Рівії"),
    ).toBeInTheDocument();
    expect(
      within(previewRegion()).getByRole("heading", { name: "Ґеральт із Рівії" }),
    ).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });

  it("keeps the book species inherited when a search over no main species is dismissed", async () => {
    serveBookValues({ speciesOverride: null });
    servedCharacter = { ...servedCharacter, species: null };
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    expect(within(species).getByText("Не вказано")).toBeInTheDocument();
    await userEvent.click(within(species).getByRole("button", { name: "Вказати для книги" }));
    const picker = within(species).getByRole("combobox");
    expect(picker).toHaveFocus();
    expect(picker).toHaveValue("");
    await userEvent.type(picker, "Мут");
    await screen.findByRole("option", { name: "Мутант" });
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");

    expect(within(species).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(species).getByText("Не вказано")).toBeInTheDocument();
    expect(within(species).getByRole("button", { name: "Вказати для книги" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it("closes only the species list on the first Escape and keeps the book species editor open", async () => {
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    await userEvent.click(within(species).getByRole("combobox"));
    await screen.findByRole("option", { name: "Мутант" });
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(within(species).getByRole("combobox")).toHaveFocus();
    expect(within(species).getByText("Редагування")).toBeInTheDocument();
    expect(
      within(species).getByRole("button", { name: "Скасувати редагування" }),
    ).toBeInTheDocument();
  });

  it("shows the main species in the open book picker without copying it into the book", async () => {
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    expect(within(species).getByRole("combobox")).toHaveValue("Відьмак");
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();

    await userEvent.click(within(species).getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Відьмак" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(species).getByRole("button", { name: "Скасувати редагування" }));

    expect(within(species).getByText("Відьмак")).toBeInTheDocument();
    expect(within(species).getByText("Основне")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it("returns the open book picker to the main species when it is cleared or tabbed out of", async () => {
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    await userEvent.click(within(species).getByRole("button", { name: "Очистити вид" }));

    expect(within(species).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(species).getByText("Основне")).toBeInTheDocument();
    expect(within(species).getByRole("button", { name: "Змінити для книги" })).toHaveFocus();

    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    expect(within(species).getByRole("combobox")).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    expect(within(species).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(species).getByText("Відьмак")).toBeInTheDocument();
    expect(within(species).getByText("Основне")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it("saves a different species picked in the open book picker for this book only", async () => {
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    await pickBookSpecies("Мутант");

    expect(within(species).getByRole("combobox")).toHaveValue("Мутант");
    expect(within(species).getByText("Для книги")).toBeInTheDocument();
    expect(within(species).getByRole("button", { name: "Повернути основне" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("speciesOverrideId", SPECIES_REFS.mutant.id);
    expect(globalPatchBody()).toBeUndefined();
  });

  it("stays inherited when the main species is picked again under another label", async () => {
    const pageFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input), "http://localhost").pathname !== "/api/species") {
        return pageFetch?.(input, init);
      }
      return Promise.resolve(
        jsonResponse({ items: [{ ...SPECIES_OPTIONS.witcher, name: "Witcher" }] }),
      );
    });
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    await pickBookSpecies("Witcher");

    expect(within(species).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(species).getByText("Відьмак")).toBeInTheDocument();
    expect(within(species).getByText("Основне")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    expect(patchCount()).toBe(0);
  });

  it("assigns a species created in the open book picker in the form only, until the form is saved", async () => {
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    await typeOver(within(species).getByRole("combobox"), "Фримен");
    await userEvent.click(await screen.findByRole("option", { name: "Створити вид «Фримен»" }));

    expect(await within(species).findByDisplayValue("Фримен")).toBeInTheDocument();
    expect(within(species).getByText("Для книги")).toBeInTheDocument();
    expect(patchCount()).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("speciesOverrideId", SPECIES_OPTIONS.created.id);
  });

  it("never submits a changed form on Enter in the open book species list", async () => {
    serveBookValues({ speciesOverride: null });
    renderEdit();

    await userEvent.type(
      await screen.findByRole("textbox", { name: /^Дані в цій книзі/ }),
      " ще трохи",
    );
    const species = inheritedField("Вид у цій книзі");
    await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
    await userEvent.click(within(species).getByRole("combobox"));
    await screen.findByRole("option", { name: "Мутант" });
    await userEvent.keyboard("{Enter}");

    expect(patchCount()).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });

  describe("while own species change in the manage dialog", () => {
    const unused: SpeciesUsage = {
      bookOverrides: 0,
      characters: 0,
      trashed: 0,
      trashedBookOverrides: 0,
      trashedCharacters: 0,
    };

    beforeEach(() => {
      let ownSpecies: OwnSpeciesView[] = [
        { ...SPECIES_OPTIONS.mutant, usage: unused },
        { ...SPECIES_OPTIONS.created, usage: unused },
      ];
      const pageFetch = fetchMock.getMockImplementation();
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const { pathname } = new URL(String(input), "http://localhost");
        const method = (init?.method ?? "GET").toUpperCase();
        const speciesId = pathname.split("/")[3] ?? "";
        if (pathname === "/api/species/own") {
          return Promise.resolve(jsonResponse({ items: ownSpecies }));
        }
        if (pathname.endsWith("/deletion-preview")) {
          return Promise.resolve(jsonResponse({ ...unused, canDelete: true }));
        }
        if (method === "PATCH" && pathname.startsWith("/api/species/")) {
          const { name } = SpeciesNameInputSchema.parse(JSON.parse(String(init?.body)));
          ownSpecies = ownSpecies.map((own) => (own.id === speciesId ? { ...own, name } : own));
          const renamed = ownSpecies.find((own) => own.id === speciesId);
          return Promise.resolve(jsonResponse(SpeciesOptionViewSchema.parse(renamed)));
        }
        if (method === "DELETE" && pathname.startsWith("/api/species/")) {
          ownSpecies = ownSpecies.filter((own) => own.id !== speciesId);
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return pageFetch?.(input, init);
      });
    });

    it("keeps the book species inherited and shows the main species under its new name once it is renamed mid-edit", async () => {
      serveBookValues({ speciesOverride: null });
      servedCharacter = { ...servedCharacter, species: SPECIES_REFS.mutant };
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const species = inheritedField("Вид у цій книзі");
      await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
      expect(within(species).getByRole("combobox")).toHaveValue("Мутант");
      await userEvent.click(screen.getByRole("button", { name: "Керування власними видами" }));
      const dialog = await screen.findByRole("dialog", { name: "Керування власними видами" });
      await userEvent.click(
        await within(dialog).findByRole("button", { name: "Дії з видом «Мутант»" }),
      );
      await userEvent.click(await screen.findByRole("menuitem", { name: "Перейменувати" }));
      await typeOver(within(dialog).getByRole("textbox", { name: "Нова назва" }), "Мутантка");
      await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));
      expect(await within(dialog).findByText("Мутантка")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");

      expect(within(species).getByText("Мутантка")).toBeInTheDocument();
      expect(within(species).queryByText("Мутант")).not.toBeInTheDocument();
      expect(within(species).getByText("Основне")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
      expect(bookPatchBody()).toBeUndefined();

      await userEvent.click(within(species).getByRole("button", { name: "Змінити для книги" }));
      expect(within(species).getByRole("combobox")).toHaveValue("Мутантка");
    });

    it("follows a rename of the book's own species and keeps its spoiler mark", async () => {
      serveBookValues({ speciesOverride: SPECIES_REFS.mutant, speciesOverrideIsSpoiler: true });
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const species = inheritedField("Вид у цій книзі");
      await userEvent.click(
        within(species).getByRole("button", { name: "Керування власними видами" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Керування власними видами" });
      await userEvent.click(
        await within(dialog).findByRole("button", { name: "Дії з видом «Мутант»" }),
      );
      await userEvent.click(await screen.findByRole("menuitem", { name: "Перейменувати" }));
      await typeOver(within(dialog).getByRole("textbox", { name: "Нова назва" }), "Мутантка");
      await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));
      expect(await within(dialog).findByText("Мутантка")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");

      expect(within(species).getByRole("combobox")).toHaveValue("Мутантка");
      expect(within(species).getByText("Для книги")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Вид у цій книзі" })).toBeChecked();
    });

    it("returns the book species to the main one and clears its spoiler mark once its own species is deleted", async () => {
      serveBookValues({ speciesOverride: SPECIES_REFS.mutant, speciesOverrideIsSpoiler: true });
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const species = inheritedField("Вид у цій книзі");
      await userEvent.click(
        within(species).getByRole("button", { name: "Керування власними видами" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Керування власними видами" });
      await userEvent.click(
        await within(dialog).findByRole("button", { name: "Дії з видом «Мутант»" }),
      );
      await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));
      await within(dialog).findByText("Вид «Мутант» ніде не використовується. Видалити назавжди?");
      await userEvent.click(within(dialog).getByRole("button", { name: "Видалити" }));

      expect(await within(species).findByText("Відьмак")).toBeInTheDocument();
      expect(within(species).queryByRole("combobox")).not.toBeInTheDocument();
      expect(within(species).getByText("Основне")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Вид у цій книзі" })).toBeDisabled();
      expect(screen.getByRole("switch", { name: "Вид у цій книзі" })).not.toBeChecked();

      await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      await waitFor(() => expect(bookPatchBody()).toBeDefined());
      expect(bookPatchBody()).toMatchObject({
        speciesOverrideId: null,
        speciesOverrideIsSpoiler: false,
      });
    });
  });

  it("keeps the old wording on the attitude in this book while it inherits the main attitude", async () => {
    servedCharacter = { ...character, globalAttitude: "like" };
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const attitude = inheritedField("Моє ставлення в цій книзі");

    expect(within(attitude).getByText("Подобається")).toBeInTheDocument();
    expect(within(attitude).getByText("Використовується основне значення")).toBeInTheDocument();
    expect(
      within(attitude).getByRole("button", { name: "Змінити лише для цієї книги" }),
    ).toBeInTheDocument();
  });

  it("writes the main attitude into the book at once when the attitude is overridden", async () => {
    servedCharacter = { ...character, globalAttitude: "like" };
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const attitude = inheritedField("Моє ставлення в цій книзі");
    await userEvent.click(
      within(attitude).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );

    expect(within(attitude).getByText("Лише для цієї книги")).toBeInTheDocument();
    expect(
      within(attitude).getByRole("button", { name: "Використовувати основне значення" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("attitude", "like");
  });

  const MASKED_BOOK_FIELDS = [
    {
      field: "displayName",
      label: "Ім’я в цій книзі",
      mainValue: "Ґеральт",
      omitted: ["displayName", "displayNameIsSpoiler"],
    },
    {
      field: "speciesOverride",
      label: "Вид у цій книзі",
      mainValue: "Відьмак",
      omitted: ["speciesOverrideId", "speciesOverrideIsSpoiler"],
    },
  ] as const;

  it.each(MASKED_BOOK_FIELDS)(
    "leaves $label masked by the server out of an unrelated book save",
    async ({ field, omitted }) => {
      serveBookValues({ displayName: null, hiddenFields: [field], speciesOverride: null });
      renderEdit();

      await userEvent.type(
        await screen.findByRole("textbox", { name: /^Дані в цій книзі/ }),
        " ще трохи",
      );
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      await waitFor(() => expect(bookPatchBody()).toBeDefined());
      const body = bookPatchBody();
      for (const key of omitted) expect(body).not.toHaveProperty(key);
      expect(body).toHaveProperty("description", "Опис у книзі ще трохи");
    },
  );

  describe("with previews too narrow for their text", () => {
    const LONG_NAME = "Ґеральт із Рівії, Білий Вовк, Різник із Блавікену, відьмак школи Вовка";

    let restoreMetrics: () => void = () => undefined;

    beforeEach(() => {
      restoreMetrics = stubTextMetrics({ clientWidth: 200, scrollWidth: 400 });
    });

    afterEach(() => {
      restoreMetrics();
      restoreMetrics = () => undefined;
    });

    it.each(MASKED_BOOK_FIELDS)(
      "shows $label masked by the server as hidden, with no value, tooltip or control",
      async ({ field, label, mainValue }) => {
        serveBookValues({ displayName: null, hiddenFields: [field], speciesOverride: null });
        renderEdit();

        await screen.findByDisplayValue("Опис у книзі");
        const basics = editCard("Основне про персонажа");

        expect(within(basics).getByText(label)).toBeInTheDocument();
        expect(within(basics).getByText("Приховано (спойлер)")).toBeInTheDocument();
        expect(within(basics).queryByText(mainValue)).not.toBeInTheDocument();
        expect(within(basics).queryByRole("button", { name: mainValue })).not.toBeInTheDocument();
        expect(
          within(basics).queryByRole("textbox", { name: new RegExp(`^${label}`) }),
        ).not.toBeInTheDocument();
        expect(
          within(basics).queryByRole("combobox", { name: new RegExp(`^${label}`) }),
        ).not.toBeInTheDocument();
      },
    );

    it("lets a cut-off main name be reached from the keyboard and read in full in a tooltip", async () => {
      servedCharacter = { ...character, name: LONG_NAME };
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const displayName = inheritedField("Ім’я в цій книзі");
      act(() => within(displayName).getByRole("button", { name: "Змінити для книги" }).focus());
      await userEvent.tab({ shift: true });

      expect(within(displayName).getByRole("button", { name: LONG_NAME })).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_NAME);
    });

    it("shows a cut-off main name in full in a tooltip on tap", async () => {
      servedCharacter = { ...character, name: LONG_NAME };
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const preview = within(inheritedField("Ім’я в цій книзі")).getByRole("button", {
        name: LONG_NAME,
      });
      await userEvent.pointer({ keys: "[TouchA]", target: preview });

      expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_NAME);
    });

    it("keeps the whole cut-off main name in the opened book name editor", async () => {
      servedCharacter = { ...character, name: LONG_NAME };
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const displayName = inheritedField("Ім’я в цій книзі");
      await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));

      expect(within(displayName).getByRole("textbox")).toHaveValue(LONG_NAME);
    });

    it("keeps the whole saved book name in its directly editable input", async () => {
      serveBookValues({ displayName: LONG_NAME });
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");

      expect(within(inheritedField("Ім’я в цій книзі")).getByRole("textbox")).toHaveValue(
        LONG_NAME,
      );
    });
  });

  describe("with previews wide enough for their text", () => {
    let restoreMetrics: () => void = () => undefined;

    beforeEach(() => {
      restoreMetrics = stubTextMetrics({ clientWidth: 400, scrollWidth: 400 });
    });

    afterEach(() => {
      restoreMetrics();
      restoreMetrics = () => undefined;
    });

    it("leaves a main name that fits out of the tab order", async () => {
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      const displayName = inheritedField("Ім’я в цій книзі");
      act(() => within(displayName).getByRole("button", { name: "Змінити для книги" }).focus());
      await userEvent.tab({ shift: true });

      expect(
        within(displayName).queryByRole("button", { name: "Ґеральт" }),
      ).not.toBeInTheDocument();
      expect(displayName.contains(document.activeElement)).toBe(false);
    });

    it("shows no tooltip when a main name that fits is tapped", async () => {
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      await userEvent.pointer({
        keys: "[TouchA]",
        target: within(inheritedField("Ім’я в цій книзі")).getByText("Ґеральт"),
      });

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});

describe("CharacterEditPage aliases", () => {
  function aliasGroup(title: string): HTMLElement {
    return screen.getByRole("group", { name: title });
  }

  function aliasEditor(title: string): HTMLElement {
    return screen.getByRole("group", { name: title });
  }

  function bookAliases(): HTMLElement {
    return aliasGroup("Інші імена в цій книзі");
  }

  function globalAliases(): HTMLElement {
    return aliasGroup("Альтернативні імена");
  }

  function lastUndo(): () => void {
    const action = toastMock.mock.lastCall?.[1]?.action;
    if (action === undefined) throw new Error("expected the last toast to offer an undo");
    return action.onClick;
  }

  function serveAliases(
    aliases: {
      bookId?: Nullable<string>;
      isSpoiler?: boolean;
      name: string;
      type: CharacterAliasType;
    }[],
  ) {
    servedCharacter = {
      ...character,
      aliases: aliases.map((alias, index) => ({
        bookId: alias.bookId ?? null,
        id: `alias-${index}`,
        isSpoiler: alias.isSpoiler ?? false,
        name: alias.name,
        position: index,
        type: alias.type,
      })),
    };
  }

  function numberedAliases(count: number) {
    return Array.from({ length: count }, (_unused, index) => ({
      name: `Ім’я ${index + 1}`,
      type: "other" as const,
    }));
  }

  async function openAliasEditor(group: HTMLElement) {
    await userEvent.click(within(group).getByRole("button", { name: "Додати ім’я" }));
    return within(group).getByRole("textbox", { name: "Альтернативне ім’я" });
  }

  function undo(restore: () => void) {
    act(() => restore());
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
    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toHaveFocus();

    await userEvent.type(await openAliasEditor(bookAliases()), "Різник");
    await userEvent.click(
      within(aliasEditor("Додавання імені")).getByRole("button", { name: "Додати ім’я" }),
    );

    expect(
      within(bookAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();
    expect(within(bookAliases()).getByText("1 / 30")).toBeInTheDocument();
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

  it("cancels adding on Escape and returns focus to the add field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк{Escape}");

    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toHaveFocus();
    expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it("edits a name in place and keeps its position", async () => {
    serveAliases([
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
    await userEvent.click(
      within(globalAliases()).getByRole("checkbox", { name: "Це ім’я містить спойлер" }),
    );
    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Застосувати" }));

    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Вовк» (Титул)" }),
    ).toHaveFocus();
    expect(within(globalAliases()).getByText("2 / 30")).toBeInTheDocument();
    expect(patchCount()).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Вовк", position: 0, type: "title" },
      { isSpoiler: false, name: "Різник", position: 1, type: "other" },
    ]);
  });

  it("leaves the name untouched when editing is cancelled", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
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
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
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
    serveAliases([
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
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const input = await openAliasEditor(globalAliases());
    await userEvent.type(input, "білий вовк");
    await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
    await userEvent.click(await screen.findByRole("option", { name: "Прізвисько" }));

    expect(within(globalAliases()).getByText("Таке ім’я з цим типом уже є")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toBeDisabled();

    await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
    await userEvent.click(await screen.findByRole("option", { name: "Титул" }));

    expect(
      within(globalAliases()).queryByText("Таке ім’я з цим типом уже є"),
    ).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Додати ім’я" }));

    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «білий вовк» (Титул)" }),
    ).toBeInTheDocument();
  });

  it("refuses an alias that repeats the main name", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(await openAliasEditor(globalAliases()), " ґеральт {Enter}");

    expect(within(globalAliases()).getByText("Це основне ім’я персонажа")).toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toBeDisabled();
    expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
  });

  it("refuses a book alias that repeats the name the character goes by in this book", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(await openAliasEditor(bookAliases()), "ҐЕРАЛЬТ{Enter}");

    expect(within(bookAliases()).getByText("Це ім’я персонажа в цій книзі")).toBeInTheDocument();
    expect(within(bookAliases()).getByRole("button", { name: "Додати ім’я" })).toBeDisabled();
    expect(within(bookAliases()).getByText("0 / 30")).toBeInTheDocument();
  });

  it("asks for a name only after an attempt to add an empty one and clears the error once typed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const input = await openAliasEditor(globalAliases());

    expect(within(globalAliases()).queryByText("Вкажіть ім’я")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");

    await userEvent.keyboard("{Enter}");

    expect(within(globalAliases()).getByText("Вкажіть ім’я")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toBeDisabled();

    await userEvent.type(input, "Вовк");

    expect(within(globalAliases()).queryByText("Вкажіть ім’я")).not.toBeInTheDocument();
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toBeEnabled();
  });

  it("hides adding at the limit but keeps editing and removing", async () => {
    serveAliases(numberedAliases(30));
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(globalAliases()).getByText("30 / 30")).toBeInTheDocument();
    expect(
      within(globalAliases()).queryByRole("button", { name: "Додати ім’я" }),
    ).not.toBeInTheDocument();
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
    expect(within(globalAliases()).getByRole("button", { name: "Додати ім’я" })).toBeEnabled();
  });

  it("hides adding once a new name fills the last slot and moves focus to that name", async () => {
    serveAliases(numberedAliases(29));
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк{Enter}");

    expect(within(globalAliases()).getByText("30 / 30")).toBeInTheDocument();
    expect(
      within(globalAliases()).queryByRole("button", { name: "Додати ім’я" }),
    ).not.toBeInTheDocument();
    expect(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Білий Вовк» (Інше)" }),
    ).toHaveFocus();
  });

  it("marks a saved name as soon as the main name repeats it and clears it once the name changes back", async () => {
    serveAliases([{ name: "Вовк", type: "nickname" }]);
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
    serveAliases([
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
    expect(aliasEditor("Редагування: Ґвинблейдд")).toBeInTheDocument();

    await userEvent.click(within(globalAliases()).getByRole("button", { name: "Застосувати" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Різник", position: 0, type: "other" },
      { isSpoiler: false, name: "Ґвинблейдд з Рівії", position: 1, type: "other" },
    ]);
  });

  it("moves focus into the open add editor when the last name is removed", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const input = await openAliasEditor(globalAliases());
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Прибрати ім’я «Білий Вовк»" }),
    );

    expect(input).toHaveFocus();
  });

  it("still saves a scope that already holds more names than the limit", async () => {
    serveAliases(numberedAliases(32));
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(globalAliases()).getByText("32 / 30")).toBeInTheDocument();
    expect(
      within(globalAliases()).queryByRole("button", { name: "Додати ім’я" }),
    ).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
  });

  it("edits a name in a scope over the limit and saves every name", async () => {
    serveAliases(numberedAliases(32));
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Ім’я 32» (Інше)" }),
    );
    await userEvent.type(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
      " з Рівії{Enter}",
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    const aliases = globalPatchBody()?.aliases;
    expect(aliases).toHaveLength(32);
    expect(aliases).toContainEqual({
      isSpoiler: false,
      name: "Ім’я 32 з Рівії",
      position: 31,
      type: "other",
    });
  });

  it("says that a group has no names yet", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(bookAliases()).getByText("Імена ще не додані")).toBeInTheDocument();
    expect(within(globalAliases()).queryByText("Імена ще не додані")).not.toBeInTheDocument();
  });

  it("puts the edit, spoiler and remove actions on each name in that order, before the add button", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const [edit, spoiler, remove, add, ...rest] = within(globalAliases()).getAllByRole("button");

    expect(edit).toHaveAccessibleName("Змінити ім’я «Білий Вовк» (Прізвисько)");
    expect(spoiler).toHaveAccessibleName("Позначити ім’я «Білий Вовк» як спойлер");
    expect(remove).toHaveAccessibleName("Прибрати ім’я «Білий Вовк»");
    expect(add).toHaveAccessibleName("Додати ім’я");
    expect(rest).toEqual([]);
  });

  it("explains the edit action of a name in a tooltip", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.hover(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Змінити ім’я");
  });

  it("keeps the edited name visible and highlighted above its editor until editing ends", async () => {
    serveAliases([
      { name: "Білий Вовк", type: "nickname" },
      { name: "Різник", type: "other" },
    ]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const edit = within(globalAliases()).getByRole("button", {
      name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
    });
    await userEvent.click(edit);

    const editor = aliasEditor("Редагування: Білий Вовк");
    const otherEdit = within(globalAliases()).getByRole("button", {
      name: "Змінити ім’я «Різник» (Інше)",
    });
    expect(edit).toBeInTheDocument();
    expect(edit.closest("[data-active]")).not.toBeNull();
    expect(otherEdit.closest("[data-active]")).toBeNull();
    expect(edit.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.keyboard("{Escape}");

    expect(edit.closest("[data-active]")).toBeNull();
  });

  it("titles the edit form with the original name and its scope while the name is retyped", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
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

    const editor = aliasEditor("Редагування: Білий Вовк");
    expect(globalAliases()).toContainElement(editor);
    expect(within(editor).getByText("Для всіх книг")).toBeInTheDocument();
  });

  it("titles the add form of the book group with the book scope", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await openAliasEditor(bookAliases());

    const editor = aliasEditor("Додавання імені");
    expect(bookAliases()).toContainElement(editor);
    expect(within(editor).getByText("Лише в цій книзі")).toBeInTheDocument();
  });

  it("ignores Enter and Escape that only finish an input method composition", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const input = await openAliasEditor(globalAliases());
    await userEvent.type(input, "Ґвинблейдд");
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape", keyCode: 229 });

    expect(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
    ).toHaveValue("Ґвинблейдд");
    expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");

    expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();
  });

  it("switches from an unchanged editor in one group to adding in the other at once", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    );
    await openAliasEditor(bookAliases());

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: "Альтернативне ім’я" })).toHaveLength(1);
    expect(bookAliases()).toContainElement(aliasEditor("Додавання імені"));
  });

  it("switches from an add editor holding only a chosen type without asking", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await openAliasEditor(globalAliases());
    await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
    await userEvent.click(await screen.findByRole("option", { name: "Титул" }));
    await openAliasEditor(bookAliases());

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: "Альтернативне ім’я" })).toHaveLength(1);
    expect(bookAliases()).toContainElement(aliasEditor("Додавання імені"));
  });

  it("asks before dropping a changed draft for another name and keeps the draft and focus on refusal", async () => {
    serveAliases([
      { name: "Білий Вовк", type: "nickname" },
      { bookId: "book-1", name: "Різник", type: "other" },
    ]);
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
    await userEvent.click(
      within(bookAliases()).getByRole("button", { name: "Змінити ім’я «Різник» (Інше)" }),
    );

    const dialog = await screen.findByRole("alertdialog", { name: "Відхилити зміни в імені?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Продовжити редагування" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const input = within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" });
    expect(input).toHaveValue("Білий Вовк із Рівії");
    await waitFor(() => expect(input).toHaveFocus());
    expect(
      within(bookAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
  });

  it("drops the changed draft and opens the other name once the user agrees", async () => {
    serveAliases([
      { name: "Білий Вовк", type: "nickname" },
      { bookId: "book-1", name: "Різник", type: "other" },
    ]);
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
    await userEvent.click(
      within(bookAliases()).getByRole("button", { name: "Змінити ім’я «Різник» (Інше)" }),
    );
    const dialog = await screen.findByRole("alertdialog", { name: "Відхилити зміни в імені?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Відхилити зміни" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(bookAliases()).toContainElement(aliasEditor("Редагування: Різник"));
    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it("asks before removing the name whose changed draft is open", async () => {
    serveAliases([
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
    await userEvent.type(
      within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
      " із Рівії",
    );
    await userEvent.click(
      within(globalAliases()).getByRole("button", { name: "Прибрати ім’я «Білий Вовк»" }),
    );

    const dialog = await screen.findByRole("alertdialog", { name: "Відхилити зміни в імені?" });
    expect(toastMock).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Відхилити зміни" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();
    expect(
      within(globalAliases()).queryByRole("textbox", { name: "Альтернативне ім’я" }),
    ).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenLastCalledWith("Ім’я «Білий Вовк» прибрано", expect.anything());
  });

  it("keeps the eye of the edited name and the spoiler checkbox on one draft that Cancel throws away", async () => {
    serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(
      within(globalAliases()).getByRole("button", {
        name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
      }),
    );
    await userEvent.click(
      within(globalAliases()).getByRole("button", {
        name: "Позначити ім’я «Білий Вовк» як спойлер",
      }),
    );

    const checkbox = within(globalAliases()).getByRole("checkbox", {
      name: "Це ім’я містить спойлер",
    });
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(
      within(globalAliases()).getByRole("button", {
        name: "Позначити ім’я «Білий Вовк» як спойлер",
      }),
    ).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(checkbox);

    expect(
      within(globalAliases()).getByRole("button", {
        name: "Прибрати позначку спойлера з імені «Білий Вовк»",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      within(aliasEditor("Редагування: Білий Вовк")).getByRole("button", { name: "Скасувати" }),
    );

    expect(
      within(globalAliases()).getByRole("button", {
        name: "Позначити ім’я «Білий Вовк» як спойлер",
      }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  describe("undoing a removal", () => {
    const EXPIRED = "Це видалення вже не можна скасувати";

    function holdPatches(): () => void {
      const serve = fetchMock.getMockImplementation();
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const respond = () => serve?.(input, init);
        return (init?.method ?? "GET").toUpperCase() === "PATCH" ? gate.then(respond) : respond();
      });
      return () => release();
    }

    async function removeAlias(group: HTMLElement, name: string) {
      await userEvent.click(within(group).getByRole("button", { name: `Прибрати ім’я «${name}»` }));
    }

    it("offers to undo a removal in a toast without sending anything", async () => {
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");

      expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
      expect(toastMock).toHaveBeenLastCalledWith("Ім’я «Білий Вовк» прибрано", {
        action: { label: "Скасувати", onClick: expect.any(Function) },
        id: "character-alias-undo",
      });
      expect(patchCount()).toBe(0);
    });

    it("restores a removed book name with its type and spoiler mark in its original place", async () => {
      serveAliases([
        { name: "Різник", type: "other" },
        { bookId: "book-1", name: "Ґвинблейдд", type: "other" },
        { bookId: "book-1", isSpoiler: true, name: "Різник із Блавікену", type: "title" },
        { bookId: "book-1", name: "Вовк", type: "nickname" },
      ]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(bookAliases(), "Різник із Блавікену");
      undo(lastUndo());

      const editButtons = within(bookAliases()).getAllByRole("button", { name: /^Змінити ім’я/ });
      expect(editButtons).toHaveLength(3);
      expect(editButtons[1]).toHaveAccessibleName("Змінити ім’я «Різник із Блавікену» (Титул)");
      expect(editButtons[1]).toHaveFocus();
      expect(
        within(bookAliases()).getByRole("button", {
          name: "Прибрати позначку спойлера з імені «Різник із Блавікену»",
        }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    });

    it("keeps an edit made after the removal when the removal is undone", async () => {
      serveAliases([
        { name: "Білий Вовк", type: "nickname" },
        { name: "Різник", type: "other" },
        { name: "Ґвинблейдд", type: "other" },
      ]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restore = lastUndo();
      await userEvent.click(
        within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Ґвинблейдд» (Інше)" }),
      );
      await userEvent.type(
        within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
        " з Рівії{Enter}",
      );
      undo(restore);
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      await waitFor(() => expect(globalPatchBody()).toBeDefined());
      expect(globalPatchBody()).toHaveProperty("aliases", [
        { isSpoiler: false, name: "Білий Вовк", position: 0, type: "nickname" },
        { isSpoiler: false, name: "Різник", position: 1, type: "other" },
        { isSpoiler: false, name: "Ґвинблейдд з Рівії", position: 2, type: "other" },
      ]);
    });

    it("lets only the latest removal be undone", async () => {
      serveAliases([
        { name: "Білий Вовк", type: "nickname" },
        { name: "Різник", type: "other" },
        { name: "Ґвинблейдд", type: "other" },
      ]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restoreFirst = lastUndo();
      await removeAlias(globalAliases(), "Різник");
      const restoreSecond = lastUndo();

      undo(restoreFirst);

      expect(toastMock.warning).toHaveBeenLastCalledWith(EXPIRED);
      expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();

      undo(restoreSecond);

      expect(within(globalAliases()).getByText("2 / 30")).toBeInTheDocument();
      expect(
        within(globalAliases()).queryByRole("button", {
          name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
        }),
      ).not.toBeInTheDocument();
      expect(
        within(globalAliases()).getByRole("button", { name: "Змінити ім’я «Різник» (Інше)" }),
      ).toBeInTheDocument();
    });

    it("refuses to undo a removal that would repeat a name added since", async () => {
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restore = lastUndo();
      await userEvent.type(await openAliasEditor(globalAliases()), "білий вовк");
      await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
      await userEvent.click(await screen.findByRole("option", { name: "Прізвисько" }));
      await userEvent.click(within(globalAliases()).getByRole("button", { name: "Додати ім’я" }));

      expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();

      undo(restore);

      expect(toastMock.warning).toHaveBeenLastCalledWith(
        "Не вдалося повернути «Білий Вовк»: таке ім’я з цим типом уже є",
      );
      expect(within(globalAliases()).getByText("1 / 30")).toBeInTheDocument();
    });

    it("refuses to undo a removal once a new name has taken the last slot", async () => {
      serveAliases(numberedAliases(30));
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Ім’я 30");
      const restore = lastUndo();
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк{Enter}");
      undo(restore);

      expect(toastMock.warning).toHaveBeenLastCalledWith(
        "Не вдалося повернути «Ім’я 30»: ліміт імен вичерпано",
      );
      expect(within(globalAliases()).getByText("30 / 30")).toBeInTheDocument();
    });

    it("restores a removed name into a scope that was already over the limit", async () => {
      serveAliases(numberedAliases(32));
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Ім’я 5");

      expect(within(globalAliases()).getByText("31 / 30")).toBeInTheDocument();

      undo(lastUndo());

      expect(within(globalAliases()).getByText("32 / 30")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
    });

    it("refuses to undo a removal once it is saved", async () => {
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restore = lastUndo();
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
      await waitFor(() => expect(push).toHaveBeenCalled());

      undo(restore);

      expect(toastMock.warning).toHaveBeenLastCalledWith(EXPIRED);
      expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
    });

    it("refuses to undo a global removal once only the global update is saved", async () => {
      bookPatchStatus = 500;
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      renderEdit();

      await screen.findByDisplayValue("Опис у книзі");
      await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restore = lastUndo();
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
      await waitFor(() => expect(patchCount()).toBe(2));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

      undo(restore);

      expect(toastMock.warning).toHaveBeenLastCalledWith(EXPIRED);
      expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();
    });

    it("still undoes a book removal when only the global update is saved", async () => {
      bookPatchStatus = 500;
      serveAliases([{ bookId: "book-1", name: "Різник", type: "other" }]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
      await removeAlias(bookAliases(), "Різник");
      const restore = lastUndo();
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
      await waitFor(() => expect(patchCount()).toBe(2));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

      undo(restore);

      expect(toastMock.warning).not.toHaveBeenCalledWith(EXPIRED);
      expect(within(bookAliases()).getByText("1 / 30")).toBeInTheDocument();
      expect(
        within(bookAliases()).getByRole("button", { name: "Змінити ім’я «Різник» (Інше)" }),
      ).toBeInTheDocument();
    });

    it("refuses to undo a removal while the form is saving", async () => {
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      const release = holdPatches();
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restore = lastUndo();
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
      await waitFor(() => expect(patchCount()).toBe(1));

      undo(restore);

      expect(toastMock.warning).toHaveBeenLastCalledWith(EXPIRED);
      expect(within(globalAliases()).getByText("0 / 30")).toBeInTheDocument();

      release();
      await waitFor(() => expect(push).toHaveBeenCalled());
    });

    it("refuses to undo a removal once the page is gone", async () => {
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      const { unmount } = renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await removeAlias(globalAliases(), "Білий Вовк");
      const restore = lastUndo();
      unmount();

      restore();

      expect(toastMock.warning).toHaveBeenLastCalledWith(EXPIRED);
    });
  });

  describe("with an unapplied name draft", () => {
    const SAVE_BLOCKED = "Застосуйте або скасуйте зміни в імені, щоб зберегти персонажа.";

    function pageCancelButton(): HTMLElement {
      const button = screen
        .getAllByRole("button", { name: "Скасувати" })
        .find((candidate) => !editCard("Інші імена").contains(candidate));
      if (button === undefined) throw new Error("expected the page cancel button");
      return button;
    }

    function unloadIsWarned(): boolean {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }

    it("enables Save for the draft alone and explains in the editor instead of saving", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк");
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      const input = within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" });
      expect(input).toHaveAccessibleDescription(SAVE_BLOCKED);
      expect(input).toHaveFocus();
      expect(patchCount()).toBe(0);
    });

    it("sends nothing while a draft is unapplied even though the other changes are valid", async () => {
      serveAliases([{ bookId: "book-1", name: "Різник", type: "other" }]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
      await userEvent.click(
        within(bookAliases()).getByRole("button", { name: "Змінити ім’я «Різник» (Інше)" }),
      );
      await userEvent.type(
        within(bookAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
        " із Блавікену",
      );
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      expect(within(bookAliases()).getByText(SAVE_BLOCKED)).toBeInTheDocument();
      expect(patchCount()).toBe(0);
    });

    it("points at the draft rather than an invalid field when Save is pressed", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.clear(screen.getByRole("textbox", { name: /Ім’я/ }));
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк");
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      expect(
        within(globalAliases()).getByRole("textbox", { name: "Альтернативне ім’я" }),
      ).toHaveFocus();
      expect(within(globalAliases()).getByText(SAVE_BLOCKED)).toBeInTheDocument();
      expect(patchCount()).toBe(0);
    });

    it("saves normally once the blocked draft is added", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк");
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
      await userEvent.click(
        within(aliasEditor("Додавання імені")).getByRole("button", { name: "Додати ім’я" }),
      );
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      await waitFor(() => expect(globalPatchBody()).toBeDefined());
      expect(globalPatchBody()).toHaveProperty("aliases", [
        { isSpoiler: false, name: "Білий Вовк", position: 0, type: "other" },
      ]);
    });

    it("lets an open but unchanged editor stay out of the way of a normal save", async () => {
      serveAliases([{ name: "Білий Вовк", type: "nickname" }]);
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
      await userEvent.click(
        within(globalAliases()).getByRole("button", {
          name: "Змінити ім’я «Білий Вовк» (Прізвисько)",
        }),
      );
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      await waitFor(() => expect(globalPatchBody()).toBeDefined());
      expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
      expect(screen.queryByText(SAVE_BLOCKED)).not.toBeInTheDocument();
    });

    it("asks before leaving when only the draft has changes", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк");
      await userEvent.click(pageCancelButton());

      expect(
        await screen.findByRole("alertdialog", { name: "Відхилити зміни?" }),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it("leaves without asking while the open add editor is still empty", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await openAliasEditor(globalAliases());
      await userEvent.click(pageCancelButton());

      expect(push).toHaveBeenCalledWith("/characters/char-1?bookId=book-1");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("treats an add editor without a name as empty even with a type and spoiler chosen", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await openAliasEditor(globalAliases());
      await userEvent.click(within(globalAliases()).getByRole("combobox", { name: "Тип імені" }));
      await userEvent.click(await screen.findByRole("option", { name: "Титул" }));
      await userEvent.click(
        within(globalAliases()).getByRole("checkbox", { name: "Це ім’я містить спойлер" }),
      );

      expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
      expect(unloadIsWarned()).toBe(false);

      await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

      await waitFor(() => expect(globalPatchBody()).toBeDefined());
      expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
      expect(screen.queryByText(SAVE_BLOCKED)).not.toBeInTheDocument();
    });

    it("warns before the page unloads only while the draft has changes", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      const input = await openAliasEditor(globalAliases());

      expect(unloadIsWarned()).toBe(false);

      await userEvent.type(input, "Білий Вовк");

      expect(unloadIsWarned()).toBe(true);

      await userEvent.keyboard("{Escape}");

      expect(unloadIsWarned()).toBe(false);
    });

    it("stops warning before unload once leaving is confirmed", async () => {
      renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк");
      await userEvent.click(pageCancelButton());
      const dialog = await screen.findByRole("alertdialog", { name: "Відхилити зміни?" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Так, вийти" }));

      expect(push).toHaveBeenCalledWith("/characters/char-1?bookId=book-1");
      expect(unloadIsWarned()).toBe(false);
    });

    it("stops warning before unload once the page is gone", async () => {
      const { unmount } = renderEdit();

      await screen.findByDisplayValue("Ґеральт");
      await userEvent.type(await openAliasEditor(globalAliases()), "Білий Вовк");
      unmount();

      expect(unloadIsWarned()).toBe(false);
    });
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

const SPOILER_SWITCH_NAMES = [
  "Ім’я в цій книзі",
  "Зображення в цій книзі",
  "Статус",
  "Вид у цій книзі",
  "Дані в цій книзі",
  "Моє враження",
  "Зовнішність у цій книзі",
];

describe("CharacterEditPage spoilers", () => {
  it("lists all seven spoiler switches in their groups with no disclosure step", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const expected = SPOILER_SWITCH_NAMES.map((name) => screen.getByRole("switch", { name }));
    expect(screen.getAllByRole("switch").filter((element) => expected.includes(element))).toEqual(
      expected,
    );
    expect(
      within(screen.getByRole("group", { name: "На картках і сторінці персонажа" })).getAllByRole(
        "switch",
      ),
    ).toEqual(expected.slice(0, 3));
    expect(
      within(screen.getByRole("group", { name: "Тільки на сторінці деталей" })).getAllByRole(
        "switch",
      ),
    ).toEqual(expected.slice(3));
    expect(
      screen.queryByRole("button", { name: "Налаштувати, що саме приховати" }),
    ).not.toBeInTheDocument();
  });

  it("offers no way to hide the character's presence in the book", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.queryByRole("switch", { name: /факт появи/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/не з’явиться у списках цієї книги/)).not.toBeInTheDocument();
  });

  it("saves a granular spoiler switch without any presence flag", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("switch", { name: "Дані в цій книзі" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("descriptionIsSpoiler", true);
    expect(bookPatchBody()).not.toHaveProperty("hidePresenceAsSpoiler");
  });

  it("offers no spoiler switch for the point of view or the first appearance", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getAllByRole("switch")).toHaveLength(8);
    expect(screen.queryByRole("switch", { name: "Перша поява" })).not.toBeInTheDocument();
  });
});

function editCard(title: string): HTMLElement {
  const card = screen.getByRole("heading", { level: 2, name: title }).closest("section");
  if (!(card instanceof HTMLElement)) throw new Error(`expected a card titled ${title}`);
  return card;
}

function groupTitles(card: string): string[] {
  return within(editCard(card))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent ?? "");
}

function previewRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Попередній перегляд" });
}

function scopeChips(card: string): string[] {
  return within(editCard(card))
    .queryAllByText(/^(Ця книга|Усі книги)$/)
    .map((chip) => chip.textContent ?? "");
}

function sectionTitles(): string[] {
  const sidePanels = [imagesPanel(), previewRegion()];
  return screen
    .getAllByRole("heading", { level: 2 })
    .filter((heading) => !sidePanels.some((panel) => panel.contains(heading)))
    .map((heading) => heading.textContent ?? "");
}

describe("CharacterEditPage layout by mode", () => {
  it("lays out the six book sections in reading order", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(sectionTitles()).toEqual([
      "Основне про персонажа",
      "Описи в цій книзі",
      "Роль у розповіді",
      "Моє ставлення та враження",
      "Інші імена",
      "Спойлери",
    ]);
    expect(groupTitles("Основне про персонажа")).toEqual([
      "Загальна інформація",
      "Особливості в цій книзі",
    ]);
    expect(groupTitles("Роль у розповіді")).toEqual(["Перша поява", "Перспектива та оповідь"]);
    expect(groupTitles("Моє ставлення та враження")).toEqual([
      "Загальне ставлення",
      "Враження від цієї книги",
    ]);
    expect(groupTitles("Інші імена")).toEqual(["Альтернативні імена", "Інші імена в цій книзі"]);
  });

  it("marks each card or group with the scope it edits", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(scopeChips("Основне про персонажа")).toEqual(["Усі книги", "Ця книга"]);
    expect(scopeChips("Описи в цій книзі")).toEqual(["Ця книга"]);
    expect(scopeChips("Роль у розповіді")).toEqual(["Ця книга"]);
    expect(scopeChips("Моє ставлення та враження")).toEqual(["Усі книги", "Ця книга"]);
    expect(scopeChips("Інші імена")).toEqual(["Усі книги", "Ця книга"]);
    expect(scopeChips("Спойлери")).toEqual(["Ця книга"]);
  });

  it("places each moved field once, in its card", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const fieldsByCard = [
      {
        card: "Основне про персонажа",
        fields: [
          ["textbox", "Ім’я"],
          ["combobox", "Важливість"],
          ["combobox", "Статус"],
          ["combobox", "Ролі"],
        ],
      },
      {
        card: "Описи в цій книзі",
        fields: [
          ["textbox", /^Дані в цій книзі/],
          ["textbox", /^Зовнішність у цій книзі/],
        ],
      },
      {
        card: "Роль у розповіді",
        fields: [
          ["spinbutton", /^Сторінка/],
          ["switch", "Персонаж із власною перспективою (POV)"],
        ],
      },
      {
        card: "Моє ставлення та враження",
        fields: [
          ["combobox", "Моє ставлення"],
          ["textbox", /^Моє враження/],
        ],
      },
    ] as const;

    for (const { card, fields } of fieldsByCard) {
      for (const [role, name] of fields) {
        expect(screen.getAllByRole(role, { name })).toHaveLength(1);
        expect(within(editCard(card)).getByRole(role, { name })).toBeInTheDocument();
      }
    }
    expect(inheritedField("Ім’я в цій книзі")).toBeInTheDocument();
    expect(inheritedField("Вид у цій книзі")).toBeInTheDocument();
    expect(inheritedField("Моє ставлення в цій книзі")).toBeInTheDocument();
  });

  it("renders only the shared sections without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(sectionTitles()).toEqual([
      "Основне про персонажа",
      "Моє ставлення та враження",
      "Інші імена",
    ]);
    expect(groupTitles("Основне про персонажа")).toEqual(["Загальна інформація"]);
    expect(groupTitles("Моє ставлення та враження")).toEqual(["Загальне ставлення"]);
    expect(groupTitles("Інші імена")).toEqual(["Альтернативні імена"]);
    expect(screen.queryByText("Ім’я в цій книзі")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Важливість" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Статус" })).not.toBeInTheDocument();
    expect(screen.queryByText("Моє ставлення в цій книзі")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^Моє враження/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Ця книга")).not.toBeInTheDocument();
    expect(customLabelRequests()).toEqual([]);
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
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
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
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "   ");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("returns to the global name when the display name is reset", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(within(displayName).getByRole("button", { name: "Змінити для книги" }));
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Біловолосий");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.click(within(displayName).getByRole("button", { name: "Повернути основне" }));

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

    servedCharacter = makeCharacterDetails({
      aliases: aliases.filter(
        (alias) =>
          !characterHiddenFields.includes(alias.bookId === null ? "globalAliases" : "bookAliases"),
      ),
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
      characterHiddenFields: ["bookAliases"],
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
      characterHiddenFields: ["globalAliases"],
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

  it("keeps sending the book aliases while only the global aliases are masked", async () => {
    serveWithHiddenFields({ appearanceHiddenFields: [], characterHiddenFields: ["globalAliases"] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" },
    ]);
  });

  it("asks the server to reveal every spoiler field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const detailsUrl = fetchMock.mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes("/api/characters/char-1"));
    expect(
      new URL(String(detailsUrl), "http://localhost").searchParams.getAll("revealFieldIds").sort(),
    ).toEqual([
      "appearanceNotes",
      "bookAliases",
      "description",
      "displayName",
      "forms",
      "globalAliases",
      "personalImpression",
      "portrait",
      "roles",
      "speciesOverride",
      "status",
      "unreliableNarrator",
    ]);
  });

  it("keeps every spoiler value of the book when an unrelated book field is saved", async () => {
    servedCharacter = makeCharacterDetails({
      aliases,
      appearances: [makeBookCharacterView({ bookId: "book-1", ...filledSpoilerValues(), roles })],
      name: "Ґеральт",
      species: SPECIES_REFS.witcher,
    });
    renderEdit();

    await userEvent.type(
      await screen.findByRole("textbox", { name: /^Нотатка про першу появу/ }),
      "Корчма в Блавікені",
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      ...ALL_SPOILER_FLAGS_ON,
      aliases: [{ isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" }],
      appearanceNotes: "Шрам через ліве око",
      description: "Мутант, що полює на чудовиськ",
      displayName: "Вовк із Рівії",
      firstAppearanceNote: "Корчма в Блавікені",
      personalImpression: "Похмурий, але чесний",
      portraitMediaId: savedPortrait.id,
      roles: [
        { customRole: null, isSpoiler: false, position: 0, roleType: "protagonist" },
        { customRole: null, isSpoiler: true, position: 1, roleType: "love_interest" },
      ],
      speciesOverrideId: SPECIES_REFS.mutant.id,
      status: "dead",
    });
  });

  it("keeps the spoiler global alias when an unrelated global field is saved", async () => {
    serveWithHiddenFields({ appearanceHiddenFields: [], characterHiddenFields: [] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByDisplayValue("Ґеральт"), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Білий Вовк", position: 0, type: "title" },
    ]);
  });
});

const ALL_SPOILER_FLAGS_ON = {
  appearanceNotesIsSpoiler: true,
  descriptionIsSpoiler: true,
  displayNameIsSpoiler: true,
  personalImpressionIsSpoiler: true,
  portraitIsSpoiler: true,
  speciesOverrideIsSpoiler: true,
  statusIsSpoiler: true,
};

function filledSpoilerValues(): Partial<BookCharacterView> {
  return {
    ...ALL_SPOILER_FLAGS_ON,
    appearanceNotes: "Шрам через ліве око",
    description: "Мутант, що полює на чудовиськ",
    displayName: "Вовк із Рівії",
    personalImpression: "Похмурий, але чесний",
    portrait: savedPortrait,
    speciesOverride: SPECIES_REFS.mutant,
    status: "dead",
  };
}

async function pickStatus(option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Статус" }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function serveBookValues(values: Partial<BookCharacterView>) {
  servedCharacter = {
    ...character,
    appearances: character.appearances.map((appearance) => ({ ...appearance, ...values })),
  };
}

const SPOILER_SWITCH_HINTS = {
  "Вид у цій книзі": "Замість нього — основний вид, якщо він є",
  "Дані в цій книзі": "Лише опис для цієї книги",
  "Зображення в цій книзі": "Замість нього — основний аватар або заглушка",
  "Зовнішність у цій книзі": "Лише текст про зовнішність, не зображення",
  "Ім’я в цій книзі": "Замість нього — основне ім’я",
  "Моє враження": "Ваші особисті нотатки",
  Статус: "Прихований на картці, розкривається в деталях",
} as const satisfies Record<(typeof SPOILER_SWITCH_NAMES)[number], string>;

function spoilerSwitch(name: string): HTMLElement {
  return screen.getByRole("switch", { name });
}

describe("CharacterEditPage spoiler switches follow their values", () => {
  it("keeps the switch of every filled field enabled and on", async () => {
    serveBookValues(filledSpoilerValues());
    renderEdit();

    await screen.findByDisplayValue("Вовк із Рівії");

    for (const name of SPOILER_SWITCH_NAMES) {
      expect(spoilerSwitch(name)).toBeEnabled();
      expect(spoilerSwitch(name)).toBeChecked();
    }
  });

  it("describes the switch of every filled field with its own hint", async () => {
    serveBookValues(filledSpoilerValues());
    renderEdit();

    await screen.findByDisplayValue("Вовк із Рівії");

    for (const [name, hint] of Object.entries(SPOILER_SWITCH_HINTS)) {
      expect(spoilerSwitch(name)).toHaveAccessibleDescription(hint);
    }
  });

  it("leaves the switch of every empty field disabled and off even over a stale flag", async () => {
    serveBookValues({
      ...ALL_SPOILER_FLAGS_ON,
      appearanceNotes: null,
      description: null,
      displayName: null,
      personalImpression: null,
      portrait: null,
      speciesOverride: null,
      status: "not_specified",
    });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    for (const name of SPOILER_SWITCH_NAMES) {
      expect(spoilerSwitch(name)).toBeDisabled();
      expect(spoilerSwitch(name)).not.toBeChecked();
      expect(spoilerSwitch(name)).toHaveAccessibleDescription("Спочатку заповніть поле");
    }
    expect(screen.getAllByText("Спочатку заповніть поле")).toHaveLength(7);
  });

  it("saves a stale flag over an empty value as off", async () => {
    serveBookValues({
      ...ALL_SPOILER_FLAGS_ON,
      appearanceNotes: null,
      description: null,
      displayName: null,
      personalImpression: null,
      portrait: null,
      speciesOverride: null,
      status: "not_specified",
    });
    renderEdit();

    await userEvent.type(
      await screen.findByRole("textbox", { name: /^Нотатка про першу появу/ }),
      "Корчма",
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      appearanceNotesIsSpoiler: false,
      descriptionIsSpoiler: false,
      displayNameIsSpoiler: false,
      personalImpressionIsSpoiler: false,
      portraitIsSpoiler: false,
      speciesOverrideIsSpoiler: false,
      statusIsSpoiler: false,
    });
  });

  it("enables the status switch for an unknown status and disables it for an unset one", async () => {
    serveBookValues({ status: "not_specified" });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(spoilerSwitch("Статус")).toBeDisabled();

    await pickStatus("Невідомо");
    expect(spoilerSwitch("Статус")).toBeEnabled();

    await pickStatus("Не вказано");
    expect(spoilerSwitch("Статус")).toBeDisabled();
  });

  it.each<{ clear: () => Promise<void>; flag: string; name: string; refill: () => Promise<void> }>([
    {
      clear: () => userEvent.clear(within(inheritedField("Ім’я в цій книзі")).getByRole("textbox")),
      flag: "displayNameIsSpoiler",
      name: "Ім’я в цій книзі",
      refill: () =>
        userEvent.type(
          within(inheritedField("Ім’я в цій книзі")).getByRole("textbox"),
          "Біловолосий",
        ),
    },
    {
      clear: selectMainAvatar,
      flag: "portraitIsSpoiler",
      name: "Зображення в цій книзі",
      refill: selectBookPortrait,
    },
    {
      clear: () => pickStatus("Не вказано"),
      flag: "statusIsSpoiler",
      name: "Статус",
      refill: () => pickStatus("Мертвий"),
    },
    {
      clear: () =>
        userEvent.click(
          within(inheritedField("Вид у цій книзі")).getByRole("button", {
            name: "Повернути основне",
          }),
        ),
      flag: "speciesOverrideIsSpoiler",
      name: "Вид у цій книзі",
      refill: async () => {
        await userEvent.click(
          within(inheritedField("Вид у цій книзі")).getByRole("button", {
            name: "Змінити для книги",
          }),
        );
        await pickBookSpecies("Мутант");
      },
    },
    {
      clear: () => userEvent.clear(screen.getByRole("textbox", { name: /^Дані в цій книзі/ })),
      flag: "descriptionIsSpoiler",
      name: "Дані в цій книзі",
      refill: () =>
        userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), "Новий опис"),
    },
    {
      clear: () => userEvent.clear(screen.getByRole("textbox", { name: /^Моє враження/ })),
      flag: "personalImpressionIsSpoiler",
      name: "Моє враження",
      refill: () =>
        userEvent.type(screen.getByRole("textbox", { name: /^Моє враження/ }), "Нове враження"),
    },
    {
      clear: () =>
        userEvent.clear(screen.getByRole("textbox", { name: /^Зовнішність у цій книзі/ })),
      flag: "appearanceNotesIsSpoiler",
      name: "Зовнішність у цій книзі",
      refill: () =>
        userEvent.type(
          screen.getByRole("textbox", { name: /^Зовнішність у цій книзі/ }),
          "Нова зовнішність",
        ),
    },
  ])(
    "turns $name off for good once its value is cleared",
    async ({ clear, flag, name, refill }) => {
      serveBookValues(filledSpoilerValues());
      renderEdit();

      await screen.findByDisplayValue("Вовк із Рівії");
      expect(spoilerSwitch(name)).toBeChecked();

      await clear();
      expect(spoilerSwitch(name)).toBeDisabled();
      expect(spoilerSwitch(name)).not.toBeChecked();

      await refill();
      expect(spoilerSwitch(name)).toBeEnabled();
      expect(spoilerSwitch(name)).not.toBeChecked();

      await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
      await waitFor(() => expect(bookPatchBody()).toBeDefined());
      expect(bookPatchBody()).toHaveProperty(flag, false);
    },
  );
});
