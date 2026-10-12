import "@testing-library/jest-dom/vitest";
import type {
  Nullable,
  OwnSpeciesView,
  SpeciesCandidates,
  SpeciesDeletionPreview,
  SpeciesOptionView,
  SpeciesUsage,
} from "@app/shared";

import {
  MergeSpeciesInputSchema,
  SPECIES_ERROR_CODES,
  SPECIES_SEARCH,
  SpeciesNameInputSchema,
  SpeciesOptionViewSchema,
} from "@app/shared";
import { QueryClient } from "@tanstack/react-query";
import { fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { OwnSpeciesChange } from "../model/own-species-change";

import { ManageOwnSpeciesButton } from "./manage-own-species-button";
import { ManageOwnSpeciesDialog } from "./manage-own-species-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type RowAction = "Видалити" | "Об’єднати" | "Перейменувати";

type SentRequest = { body: unknown; method: string; path: string };

type SpeciesServer = {
  candidates: SpeciesCandidates;
  deleteOwn: (speciesId: string) => Promise<Response>;
  listOwn: () => Promise<Response>;
  merge: (sourceId: string, targetId: string) => Promise<Response>;
  own: OwnSpeciesView[];
  preview: (speciesId: string) => Promise<Response>;
  rename: (speciesId: string, name: string) => Promise<Response>;
};

const UNUSED: SpeciesUsage = {
  bookOverrides: 0,
  characters: 0,
  trashed: 0,
  trashedBookOverrides: 0,
  trashedCharacters: 0,
};

const HUMAN: SpeciesOptionView = {
  category: { key: "humanoid", name: "Люди та людиноподібні" },
  id: "00000000-0000-4000-8000-000000000001",
  isOwn: false,
  key: "human",
  name: "Людина",
};

const OWN = {
  forestWitch: ownSpecies("00000000-0000-4000-8000-000000000010", "Лісова відьма", UNUSED),
  sandworm: ownSpecies("00000000-0000-4000-8000-000000000009", "Шаї-Хулуд", UNUSED),
  witcher: ownSpecies("00000000-0000-4000-8000-000000000008", "Відьмак", {
    bookOverrides: 1,
    characters: 3,
    trashed: 1,
    trashedBookOverrides: 0,
    trashedCharacters: 1,
  }),
} as const satisfies Record<string, OwnSpeciesView>;

const MERGE_REASSIGNED = { bookOverrides: 2, characters: 5 } as const;

const UNBROKEN_NAME = "Ксеноморф".repeat(SPECIES_SEARCH.nameMax).slice(0, SPECIES_SEARCH.nameMax);

const TEXT = {
  emptyCatalog:
    "Ви ще не створили жодного власного виду. Нові види з’являться тут, щойно ви створите їх у полі «Вид».",
  noMatches: "За цими фільтрами нічого не знайдено.",
  search: "Пошук серед ваших видів",
  similar: "Схожі види вже є. Переконайтеся, що це справді інший вид:",
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let server: SpeciesServer;

function asOption(species: OwnSpeciesView): SpeciesOptionView {
  return SpeciesOptionViewSchema.parse(species);
}

function chip(name: string): HTMLElement {
  return within(dialog()).getByRole("radio", { name });
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "Керування власними видами" });
}

function errorResponse(status: number, code: string, details: Record<string, unknown>): Response {
  return jsonResponse({ code, details, message: code }, status);
}

function findOwnSpeciesList(): Promise<HTMLElement> {
  return within(dialog()).findByRole("list", { name: "Власні види" });
}

function findRowMenu(name: string): Promise<HTMLElement> {
  return within(dialog()).findByRole("button", { name: `Дії з видом «${name}»` });
}

function findSearch(): Promise<HTMLElement> {
  return within(dialog()).findByRole("searchbox", { name: TEXT.search });
}

function focusedElement(): Nullable<HTMLElement> {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mergeTargetInput(): HTMLInputElement {
  return within(dialog()).getByRole<HTMLInputElement>("combobox", { name: "Об’єднати з" });
}

function newNameInput(): HTMLInputElement {
  return within(dialog()).getByRole<HTMLInputElement>("textbox", { name: "Нова назва" });
}

async function openFromTrigger(): Promise<HTMLElement> {
  renderWithProviders(<ManageOwnSpeciesButton onSpeciesChange={vi.fn()} />);
  const trigger = screen.getByRole("button", { name: "Керування власними видами" });
  await userEvent.click(trigger);
  await findOwnSpeciesList();
  return trigger;
}

async function openRowAction(name: string, action: RowAction) {
  await userEvent.click(await findRowMenu(name));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

function ownSpecies(id: string, name: string, usage: SpeciesUsage): OwnSpeciesView {
  return { category: null, id, isOwn: true, key: null, name, usage };
}

async function pickMergeTarget(name: string) {
  await userEvent.click(mergeTargetInput());
  await userEvent.click(await screen.findByRole("option", { name }));
}

function previewResponse(preview: SpeciesDeletionPreview): () => Promise<Response> {
  return () => Promise.resolve(jsonResponse(preview));
}

async function renameTo(name: string) {
  const input = newNameInput();
  await userEvent.clear(input);
  await userEvent.type(input, name);
  await userEvent.click(within(dialog()).getByRole("button", { name: "Зберегти" }));
}

function requestsMatching(method: string, path: RegExp): SentRequest[] {
  return sentRequests().filter((request) => request.method === method && path.test(request.path));
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();
  const speciesId = url.pathname.split("/")[3] ?? "";

  if (url.pathname === "/api/species/own") return server.listOwn();
  if (url.pathname === "/api/species/candidates") {
    return Promise.resolve(jsonResponse(server.candidates));
  }
  if (url.pathname === "/api/species") {
    const term = url.searchParams.get("q")?.toLowerCase() ?? "";
    const items = [HUMAN, ...server.own.map(asOption)].filter((option) =>
      option.name.toLowerCase().includes(term),
    );
    return Promise.resolve(jsonResponse({ items }));
  }
  if (url.pathname.endsWith("/deletion-preview")) return server.preview(speciesId);
  if (url.pathname.endsWith("/merge") && method === "POST") {
    const { targetId } = MergeSpeciesInputSchema.parse(JSON.parse(String(init?.body)));
    return server.merge(speciesId, targetId);
  }
  if (method === "PATCH") {
    const { name } = SpeciesNameInputSchema.parse(JSON.parse(String(init?.body)));
    return server.rename(speciesId, name);
  }
  if (method === "DELETE") return server.deleteOwn(speciesId);
  return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
}

function sentRequests(): SentRequest[] {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    method: (init?.method ?? "GET").toUpperCase(),
    path: new URL(String(input), "http://localhost").pathname,
  }));
}

function setupDialog(options: { queryClient?: QueryClient } = {}) {
  const onChange = vi.fn<(change: OwnSpeciesChange) => void>();
  renderWithProviders(
    <ManageOwnSpeciesDialog
      onChange={onChange}
      onOpenChange={vi.fn()}
      open
      trigger={<button type="button">Відкрити</button>}
    />,
    options,
  );
  return onChange;
}

function similarOption(id: string, name: string): SpeciesOptionView {
  return asOption(ownSpecies(id, name, UNUSED));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  server = {
    candidates: { exact: null, similar: [] },
    deleteOwn: (speciesId) => {
      server.own = server.own.filter((species) => species.id !== speciesId);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    listOwn: () => Promise.resolve(jsonResponse({ items: server.own })),
    merge: (sourceId, targetId) => {
      const target = [HUMAN, ...server.own.map(asOption)].find(
        (species) => species.id === targetId,
      );
      server.own = server.own.filter((species) => species.id !== sourceId);
      return Promise.resolve(jsonResponse({ reassigned: MERGE_REASSIGNED, target }));
    },
    own: [OWN.witcher, OWN.sandworm],
    preview: previewResponse({ ...UNUSED, canDelete: true }),
    rename: (speciesId, name) => {
      server.own = server.own.map((species) =>
        species.id === speciesId ? { ...species, name } : species,
      );
      const renamed = server.own.find((species) => species.id === speciesId);
      return Promise.resolve(jsonResponse(renamed === undefined ? {} : asOption(renamed)));
    },
  };
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  vi.mocked(toast.success).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ManageOwnSpeciesDialog focus", () => {
  it("moves focus into the dialog when it opens", async () => {
    await openFromTrigger();

    expect(dialog()).toHaveFocus();
  });

  it("keeps Shift+Tab inside the dialog", async () => {
    await openFromTrigger();

    await userEvent.tab({ shift: true });
    expect(dialog()).toContainElement(focusedElement());

    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(dialog()).toContainElement(focusedElement());
    expect(within(dialog()).getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("returns focus to the button that opened it when closed with Escape", async () => {
    const trigger = await openFromTrigger();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("moves focus to the deletion check and back to the row menu it came from", async () => {
    setupDialog();

    await openRowAction("Відьмак", "Видалити");
    await within(dialog()).findByText("Вид «Відьмак» ніде не використовується. Видалити назавжди?");
    expect(focusedElement()).toHaveTextContent("Вид «Відьмак» ніде не використовується.");

    await userEvent.click(within(dialog()).getByRole("button", { name: "Скасувати" }));

    const rowMenu = await findRowMenu("Відьмак");
    await waitFor(() => expect(rowMenu).toHaveFocus());
  });

  it("returns focus to the renamed species' row menu after saving", async () => {
    setupDialog();

    await openRowAction("Відьмак", "Перейменувати");
    await renameTo("Відьмачка");

    const rowMenu = await findRowMenu("Відьмачка");
    await waitFor(() => expect(rowMenu).toHaveFocus());
  });

  it("falls back to the search when the renamed species no longer matches it", async () => {
    setupDialog();

    await userEvent.type(await findSearch(), "Відьмак");
    await openRowAction("Відьмак", "Перейменувати");
    await renameTo("Ельф");

    expect(await within(dialog()).findByText(TEXT.noMatches)).toBeInTheDocument();
    const search = await findSearch();
    expect(search).toHaveValue("Відьмак");
    await waitFor(() => expect(search).toHaveFocus());
  });
});

describe("ManageOwnSpeciesDialog list", () => {
  it("is titled as the place to manage the user's own species", async () => {
    setupDialog();

    expect(
      await screen.findByRole("dialog", { name: "Керування власними видами" }),
    ).toBeInTheDocument();
  });

  it("lists only the user's own species, each with its usage", async () => {
    setupDialog();

    const list = await findOwnSpeciesList();

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Відьмак")).toBeInTheDocument();
    expect(within(list).getByText("Шаї-Хулуд")).toBeInTheDocument();
    expect(within(dialog()).queryByText("Людина")).not.toBeInTheDocument();
    expect(within(list).getByText("Персонажів: 3 · Призначень у книгах: 1")).toBeInTheDocument();
    expect(within(list).getByText("Із них пов’язані з кошиком: 1 персонаж")).toBeInTheDocument();
    expect(within(list).getByText("Ніде не використовується")).toBeInTheDocument();
  });

  it("offers rename, merge and delete from a single menu per row", async () => {
    setupDialog();

    const list = await findOwnSpeciesList();
    expect(
      within(list)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Дії з видом «Відьмак»", "Дії з видом «Шаї-Хулуд»"]);

    await userEvent.click(await findRowMenu("Відьмак"));
    const items = await screen.findAllByRole("menuitem");

    expect(items.map((item) => item.textContent)).toEqual([
      "Перейменувати",
      "Об’єднати",
      "Видалити",
    ]);
    expect(screen.getByRole("menuitem", { name: "Видалити" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });

  it("clamps a long unbroken name and reveals it in full in a tooltip or while its row has focus", async () => {
    server.own = [ownSpecies("00000000-0000-4000-8000-000000000011", UNBROKEN_NAME, UNUSED)];
    setupDialog();

    const list = await findOwnSpeciesList();
    const name = within(list).getByText(UNBROKEN_NAME);

    expect(name).toHaveClass("line-clamp-2", "min-w-0", "wrap-anywhere");
    expect(name).toHaveClass("group-focus-within:line-clamp-none");
    expect(within(list).getByRole("listitem")).toHaveClass("group");
    expect(await findRowMenu(UNBROKEN_NAME)).toBeInTheDocument();

    await userEvent.hover(name);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(UNBROKEN_NAME);
  });

  it("searches by trimmed name regardless of case within the chosen usage filter", async () => {
    server.own = [OWN.witcher, OWN.sandworm, OWN.forestWitch];
    setupDialog();

    await userEvent.type(await findSearch(), "  ВІДЬМ ");

    const searched = await findOwnSpeciesList();
    expect(within(searched).getAllByRole("listitem")).toHaveLength(2);
    expect(within(searched).getByText("Відьмак")).toBeInTheDocument();
    expect(within(searched).getByText("Лісова відьма")).toBeInTheDocument();

    await userEvent.click(chip("Не використовуються 2"));

    const filtered = await findOwnSpeciesList();
    expect(within(filtered).getAllByRole("listitem")).toHaveLength(1);
    expect(within(filtered).getByText("Лісова відьма")).toBeInTheDocument();
  });

  it("counts every chip over all own species, whatever the search", async () => {
    server.own = [OWN.witcher, OWN.sandworm, OWN.forestWitch];
    setupDialog();

    await findOwnSpeciesList();
    expect(chip("Усі 3")).toBeChecked();
    expect(chip("Використовуються 1")).toBeInTheDocument();
    expect(chip("Не використовуються 2")).toBeInTheDocument();

    await userEvent.type(await findSearch(), "Шаї");

    expect(chip("Усі 3")).toBeInTheDocument();
    expect(chip("Використовуються 1")).toBeInTheDocument();
    expect(chip("Не використовуються 2")).toBeInTheDocument();
  });

  it("keeps the search and filter across an action and resets them after closing", async () => {
    const trigger = await openFromTrigger();

    await userEvent.type(await findSearch(), "Відь");
    await userEvent.click(chip("Використовуються 1"));
    await openRowAction("Відьмак", "Перейменувати");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Назад" }));

    const rowMenu = await findRowMenu("Відьмак");
    await waitFor(() => expect(rowMenu).toHaveFocus());
    expect(await findSearch()).toHaveValue("Відь");
    expect(chip("Використовуються 1")).toBeChecked();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(trigger);
    await findOwnSpeciesList();

    expect(await findSearch()).toHaveValue("");
    expect(chip("Усі 2")).toBeChecked();
  });

  it("shows only a loading state until the user's species arrive", async () => {
    server.listOwn = () => new Promise<Response>(() => undefined);
    setupDialog();

    expect(await within(dialog()).findByText("Завантажуємо ваші види…")).toBeInTheDocument();
    expect(within(dialog()).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole("list", { name: "Власні види" })).not.toBeInTheDocument();
  });

  it("offers a retry when the user's species fail to load and lists them once it succeeds", async () => {
    server.listOwn = () => Promise.resolve(errorResponse(500, "internal_error", {}));
    setupDialog();

    const failure = await within(dialog()).findByRole("alert");
    expect(failure).toHaveTextContent("Не вдалося завантажити ваші види.");

    server.listOwn = () => Promise.resolve(jsonResponse({ items: server.own }));
    await userEvent.click(within(failure).getByRole("button", { name: "Повторити" }));

    const list = await findOwnSpeciesList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(requestsMatching("GET", /^\/api\/species\/own$/)).toHaveLength(2);
  });

  it("says the user has no species yet when the catalog is empty", async () => {
    server.own = [];
    setupDialog();

    expect(await within(dialog()).findByText(TEXT.emptyCatalog)).toBeInTheDocument();
    expect(within(dialog()).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(TEXT.noMatches)).not.toBeInTheDocument();
  });

  it("says nothing matches when the search excludes every species", async () => {
    setupDialog();

    await userEvent.type(await findSearch(), "Ксеноморф");

    expect(within(dialog()).getByText(TEXT.noMatches)).toBeInTheDocument();
    expect(within(dialog()).queryByRole("list", { name: "Власні види" })).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(TEXT.emptyCatalog)).not.toBeInTheDocument();
  });

  it("asks for no category anywhere while managing species", async () => {
    setupDialog();

    await findOwnSpeciesList();
    expect(within(dialog()).queryByText(/категорі/i)).not.toBeInTheDocument();
    await openRowAction("Відьмак", "Перейменувати");

    expect(within(dialog()).getAllByRole("textbox")).toHaveLength(1);
    expect(within(dialog()).queryByText(/категорі/i)).not.toBeInTheDocument();
    expect(within(dialog()).queryByLabelText(/категорі/i)).not.toBeInTheDocument();
  });
});

describe("ManageOwnSpeciesDialog rename", () => {
  it("shows the current name apart from a prefilled, selected new-name field", async () => {
    setupDialog();

    await openRowAction("Відьмак", "Перейменувати");

    expect(
      within(dialog()).getByRole("heading", { name: "Перейменувати вид" }),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole("term")).toHaveTextContent("Поточна назва");
    expect(within(dialog()).getByRole("definition")).toHaveTextContent("Відьмак");
    const input = newNameInput();
    expect(input).toHaveValue("Відьмак");
    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Відьмак".length]);
  });

  it("renames a species and returns to the updated list", async () => {
    const onChange = setupDialog();

    await openRowAction("Відьмак", "Перейменувати");
    await renameTo("Відьмачка");

    const list = await findOwnSpeciesList();
    expect(await within(list).findByText("Відьмачка")).toBeInTheDocument();
    expect(within(list).queryByText("Відьмак")).not.toBeInTheDocument();
    expect(requestsMatching("PATCH", /^\/api\/species\//)).toEqual([
      { body: { name: "Відьмачка" }, method: "PATCH", path: `/api/species/${OWN.witcher.id}` },
    ]);
    expect(onChange).toHaveBeenCalledWith({
      kind: "renamed",
      species: { ...asOption(OWN.witcher), name: "Відьмачка" },
    });
    expect(toast.success).toHaveBeenCalledWith("Вид перейменовано на «Відьмачка»");
  });

  it("turns a rename onto a taken name into an offer to merge with the holder", async () => {
    server.rename = () =>
      Promise.resolve(errorResponse(409, "species_duplicate", { species: asOption(OWN.sandworm) }));
    const onChange = setupDialog();

    await openRowAction("Відьмак", "Перейменувати");
    await renameTo("Шай Хулуд");

    expect(
      await within(dialog()).findByText(
        "Вид «Шаї-Хулуд» уже є. Замість перейменування можна об’єднати з ним.",
      ),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(within(dialog()).getByRole("button", { name: "Об’єднати з ним" }));

    expect(within(dialog()).getByRole("combobox", { name: "Об’єднати з" })).toHaveValue(
      "Шаї-Хулуд",
    );
  });

  it("warns about at most three similar species, one per row, without blocking the save", async () => {
    server.candidates = {
      exact: null,
      similar: [
        similarOption("00000000-0000-4000-8000-000000000012", "Відьмачий кіт"),
        similarOption("00000000-0000-4000-8000-000000000013", "Відьма"),
        similarOption("00000000-0000-4000-8000-000000000014", "Відьмолов"),
        similarOption("00000000-0000-4000-8000-000000000015", "Відьмачка"),
      ],
    };
    setupDialog();

    await openRowAction("Відьмак", "Перейменувати");
    const input = newNameInput();
    await userEvent.clear(input);
    await userEvent.type(input, "Відьмачок");

    expect(await within(dialog()).findByText(TEXT.similar)).toBeInTheDocument();
    expect(
      within(dialog())
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Відьмачий кіт", "Відьма", "Відьмолов"]);
    expect(within(dialog()).getByRole("button", { name: "Зберегти" })).toBeEnabled();
  });
});

describe("ManageOwnSpeciesDialog delete", () => {
  it("offers no delete while it checks where the species is used", async () => {
    server.preview = () => new Promise<Response>(() => undefined);
    setupDialog();

    await openRowAction("Відьмак", "Видалити");

    expect(within(dialog()).getByText("Перевіряємо, де використовується вид…")).toBeInTheDocument();
    expect(within(dialog()).queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();
  });

  it("offers a retry and no delete when the usage check fails", async () => {
    server.preview = () => Promise.resolve(errorResponse(500, "internal_error", {}));
    setupDialog();

    await openRowAction("Відьмак", "Видалити");

    expect(
      await within(dialog()).findByText("Не вдалося перевірити, де використовується вид."),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Повторити" })).toBeInTheDocument();
    expect(within(dialog()).queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();
  });

  it("blocks deleting a species in use, counting trashed links within the totals and offering only back or merge", async () => {
    server.preview = previewResponse({
      bookOverrides: 2,
      canDelete: false,
      characters: 4,
      trashed: 3,
      trashedBookOverrides: 1,
      trashedCharacters: 2,
    });
    setupDialog();

    await openRowAction("Шаї-Хулуд", "Видалити");

    expect(await within(dialog()).findByText("Вид використовується")).toBeInTheDocument();
    expect(
      within(dialog()).getByText("Персонажів: 4 · Призначень у книгах: 2"),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByText("Із них пов’язані з кошиком: 2 персонажі · 1 призначення"),
    ).toBeInTheDocument();
    expect(
      within(dialog())
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Назад", "Об’єднати з іншим видом", "Close"]);
  });

  it("moves from a blocked delete to merging that same species with no target chosen", async () => {
    server.preview = previewResponse({
      bookOverrides: 1,
      canDelete: false,
      characters: 3,
      trashed: 1,
      trashedBookOverrides: 0,
      trashedCharacters: 1,
    });
    setupDialog();

    await openRowAction("Відьмак", "Видалити");
    await userEvent.click(
      await within(dialog()).findByRole("button", { name: "Об’єднати з іншим видом" }),
    );

    expect(within(dialog()).getByText("Вид, який об’єднуємо")).toBeInTheDocument();
    expect(within(dialog()).getByText("Відьмак")).toBeInTheDocument();
    expect(mergeTargetInput()).toHaveValue("");
  });

  it("deletes an unused species once, after a destructive confirmation, and returns to the search", async () => {
    const onChange = setupDialog();

    await openRowAction("Шаї-Хулуд", "Видалити");

    expect(
      await within(dialog()).findByText(
        "Вид «Шаї-Хулуд» ніде не використовується. Видалити назавжди?",
      ),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Скасувати" })).toBeEnabled();
    expect(requestsMatching("DELETE", /^\/api\/species\//)).toEqual([]);

    const confirm = within(dialog()).getByRole("button", { name: "Видалити" });
    expect(confirm).toHaveAttribute("data-variant", "destructive");
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    const list = await findOwnSpeciesList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Відьмак")).toBeInTheDocument();
    expect(requestsMatching("DELETE", /^\/api\/species\//)).toEqual([
      { body: undefined, method: "DELETE", path: `/api/species/${OWN.sandworm.id}` },
    ]);
    expect(onChange).toHaveBeenCalledWith({ kind: "deleted", speciesId: OWN.sandworm.id });
    const search = await findSearch();
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("decides from a fresh usage check, never from an earlier one that allowed deleting", async () => {
    setupDialog({
      queryClient: new QueryClient({
        defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
      }),
    });

    await openRowAction("Шаї-Хулуд", "Видалити");
    await within(dialog()).findByText(
      "Вид «Шаї-Хулуд» ніде не використовується. Видалити назавжди?",
    );
    await userEvent.click(within(dialog()).getByRole("button", { name: "Скасувати" }));

    let finishPreview: (response: Response) => void = () => undefined;
    server.preview = () =>
      new Promise<Response>((resolve) => {
        finishPreview = resolve;
      });
    await openRowAction("Шаї-Хулуд", "Видалити");

    expect(within(dialog()).getByText("Перевіряємо, де використовується вид…")).toBeInTheDocument();
    expect(within(dialog()).queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();

    finishPreview(jsonResponse({ ...UNUSED, canDelete: false, characters: 2 }));

    expect(await within(dialog()).findByText("Вид використовується")).toBeInTheDocument();
    expect(within(dialog()).queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();
    expect(requestsMatching("GET", /\/deletion-preview$/)).toHaveLength(2);
  });

  it("keeps the dialog open and the choice locked while the delete is pending", async () => {
    let finishDelete: (response: Response) => void = () => undefined;
    server.deleteOwn = () =>
      new Promise<Response>((resolve) => {
        finishDelete = resolve;
      });
    await openFromTrigger();

    await openRowAction("Шаї-Хулуд", "Видалити");
    const confirm = await within(dialog()).findByRole("button", { name: "Видалити" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(requestsMatching("DELETE", /^\/api\/species\//)).toHaveLength(1));

    expect(confirm).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Скасувати" })).toBeDisabled();
    expect(within(dialog()).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(dialog()).toBeInTheDocument();

    finishDelete(new Response(null, { status: 204 }));

    expect(await findOwnSpeciesList()).toBeInTheDocument();
    expect(requestsMatching("DELETE", /^\/api\/species\//)).toHaveLength(1);
  });

  it("turns the server's in-use refusal into the blocked state instead of a generic failure", async () => {
    server.deleteOwn = () =>
      Promise.resolve(
        errorResponse(409, SPECIES_ERROR_CODES.inUse, {
          ...UNUSED,
          characters: 1,
          trashed: 1,
          trashedCharacters: 1,
        }),
      );
    const onChange = setupDialog();

    await openRowAction("Шаї-Хулуд", "Видалити");
    await within(dialog()).findByText(
      "Вид «Шаї-Хулуд» ніде не використовується. Видалити назавжди?",
    );
    await userEvent.click(within(dialog()).getByRole("button", { name: "Видалити" }));

    const refusal = await within(dialog()).findByRole("alert");
    expect(refusal).toHaveTextContent("Вид використовується");
    expect(refusal).toHaveTextContent("Шаї-Хулуд");
    expect(refusal).toHaveTextContent("Персонажів: 1 · Призначень у книгах: 0");
    expect(refusal).toHaveTextContent("Із них пов’язані з кошиком: 1 персонаж");
    expect(within(dialog()).queryByText("Вид іще використовується.")).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();
    expect(
      within(dialog()).getByRole("button", { name: "Об’єднати з іншим видом" }),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ManageOwnSpeciesDialog merge", () => {
  it("offers own and system targets but never the species being merged", async () => {
    setupDialog();

    await openRowAction("Відьмак", "Об’єднати");
    await userEvent.click(mergeTargetInput());

    expect(await screen.findByRole("option", { name: "Шаї-Хулуд" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Людина" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Відьмак" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("option", { name: "Шаї-Хулуд" }));

    expect(mergeTargetInput()).toHaveValue("Шаї-Хулуд");
    expect(within(dialog()).getByRole("button", { name: "Об’єднати" })).toBeEnabled();
  });

  it("never creates a species from the target search, by Enter or by click", async () => {
    setupDialog();

    await openRowAction("Відьмак", "Об’єднати");
    await userEvent.type(mergeTargetInput(), "Ксеноморф");

    await waitFor(() =>
      expect(within(dialog()).getByRole("status")).toHaveTextContent("Такого виду ще немає."),
    );
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");

    expect(requestsMatching("POST", /^\/api\/species$/)).toEqual([]);
    expect(within(dialog()).getByRole("button", { name: "Об’єднати" })).toBeDisabled();
  });

  it("previews the merge on one screen with preliminary counts and no Next step", async () => {
    setupDialog();

    await openRowAction("Відьмак", "Об’єднати");

    expect(within(dialog()).queryByRole("button", { name: "Далі" })).not.toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Об’єднати" })).toBeDisabled();

    await pickMergeTarget("Людина");

    const preview = within(dialog()).getByRole("region", { name: "Перевірте перед об’єднанням" });
    expect(within(preview).getByText("Відьмак")).toBeInTheDocument();
    expect(within(preview).getByText("Людина")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Попередньо перейде персонажів: 3, призначень у книгах: 1. Точні числа покажемо після об’єднання.",
      ),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Вид «Відьмак» буде видалено. Позначки спойлерів збережуться. Скасувати це не можна.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Скасувати" })).toBeEnabled();
    expect(within(dialog()).getByRole("button", { name: "Об’єднати" })).toBeEnabled();
    expect(requestsMatching("POST", /\/merge$/)).toEqual([]);
  });

  it("sends a single merge for a double click or a repeated Enter", async () => {
    server.merge = () => new Promise<Response>(() => undefined);
    setupDialog();

    await openRowAction("Відьмак", "Об’єднати");
    await pickMergeTarget("Людина");
    const confirm = within(dialog()).getByRole("button", { name: "Об’єднати" });
    confirm.focus();
    await userEvent.keyboard("{Enter}{Enter}");
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(requestsMatching("POST", /\/merge$/)).toHaveLength(1));
    expect(confirm).toBeDisabled();
  });

  it("keeps the dialog open and the choice locked while the merge is pending, then allows a retry after a failure", async () => {
    let finishMerge: (response: Response) => void = () => undefined;
    server.merge = () =>
      new Promise<Response>((resolve) => {
        finishMerge = resolve;
      });
    await openFromTrigger();

    await openRowAction("Відьмак", "Об’єднати");
    await pickMergeTarget("Людина");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Об’єднати" }));
    await waitFor(() => expect(requestsMatching("POST", /\/merge$/)).toHaveLength(1));

    expect(within(dialog()).getByRole("button", { name: "Скасувати" })).toBeDisabled();
    expect(mergeTargetInput()).toBeDisabled();
    expect(within(dialog()).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(dialog()).toBeInTheDocument();

    finishMerge(errorResponse(409, SPECIES_ERROR_CODES.mergeConflict, {}));

    expect(
      await within(dialog()).findByText("Дані змінилися під час об’єднання. Спробуйте ще раз."),
    ).toBeInTheDocument();
    expect(focusedElement()).toHaveTextContent(
      "Дані змінилися під час об’єднання. Спробуйте ще раз.",
    );
    expect(within(dialog()).getByRole("button", { name: "Скасувати" })).toBeEnabled();
    expect(within(dialog()).getByRole("button", { name: "Об’єднати" })).toBeEnabled();
    expect(mergeTargetInput()).toBeEnabled();
    expect(within(dialog()).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("opens a fresh merge without the target offered by an earlier rename", async () => {
    server.rename = () =>
      Promise.resolve(errorResponse(409, "species_duplicate", { species: asOption(OWN.sandworm) }));
    setupDialog();

    await openRowAction("Відьмак", "Перейменувати");
    await renameTo("Шай Хулуд");
    await userEvent.click(await within(dialog()).findByRole("button", { name: "Об’єднати з ним" }));
    expect(mergeTargetInput()).toHaveValue("Шаї-Хулуд");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Скасувати" }));

    await openRowAction("Відьмак", "Об’єднати");

    expect(mergeTargetInput()).toHaveValue("");
    expect(
      within(dialog()).queryByRole("region", { name: "Перевірте перед об’єднанням" }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Об’єднати" })).toBeDisabled();
  });

  it("merges into the chosen target, reports the server's counts and returns to the search", async () => {
    const onChange = setupDialog();

    await openRowAction("Відьмак", "Об’єднати");
    await pickMergeTarget("Людина");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Об’єднати" }));

    const list = await findOwnSpeciesList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Шаї-Хулуд")).toBeInTheDocument();
    expect(requestsMatching("POST", /\/merge$/)).toEqual([
      {
        body: { targetId: HUMAN.id },
        method: "POST",
        path: `/api/species/${OWN.witcher.id}/merge`,
      },
    ]);
    expect(onChange).toHaveBeenCalledWith({
      kind: "merged",
      sourceId: OWN.witcher.id,
      target: HUMAN,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Види об’єднано у вид «Людина». Перенесено персонажів: 5, призначень у книгах: 2",
    );
    const search = await findSearch();
    await waitFor(() => expect(search).toHaveFocus());
  });
});
