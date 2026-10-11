import "@testing-library/jest-dom/vitest";
import type {
  Nullable,
  OwnSpeciesView,
  SpeciesDeletionPreview,
  SpeciesOptionView,
  SpeciesUsage,
} from "@app/shared";

import {
  MergeSpeciesInputSchema,
  SpeciesNameInputSchema,
  SpeciesOptionViewSchema,
} from "@app/shared";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { OwnSpeciesChange } from "../model/own-species-change";

import { ManageOwnSpeciesButton } from "./manage-own-species-button";
import { ManageOwnSpeciesDialog } from "./manage-own-species-dialog";

type SentRequest = { body: unknown; method: string; path: string };

type SpeciesServer = {
  deleteOwn: (speciesId: string) => Promise<Response>;
  own: OwnSpeciesView[];
  preview: (speciesId: string) => Promise<Response>;
  rename: (speciesId: string, name: string) => Promise<Response>;
};

const UNUSED: SpeciesUsage = { bookOverrides: 0, characters: 0, trashed: 0 };

const HUMAN: SpeciesOptionView = {
  category: { key: "humanoid", name: "Люди та людиноподібні" },
  id: "00000000-0000-4000-8000-000000000001",
  isOwn: false,
  key: "human",
  name: "Людина",
};

const OWN = {
  sandworm: ownSpecies("00000000-0000-4000-8000-000000000009", "Шаї-Хулуд", UNUSED),
  witcher: ownSpecies("00000000-0000-4000-8000-000000000008", "Відьмак", {
    bookOverrides: 1,
    characters: 3,
    trashed: 1,
  }),
} as const satisfies Record<string, OwnSpeciesView>;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let server: SpeciesServer;

function asOption(species: OwnSpeciesView): SpeciesOptionView {
  return SpeciesOptionViewSchema.parse(species);
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

function focusedElement(): Nullable<HTMLElement> {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openFromTrigger(): Promise<HTMLElement> {
  renderWithProviders(<ManageOwnSpeciesButton onSpeciesChange={vi.fn()} />);
  const trigger = screen.getByRole("button", { name: "Керування власними видами" });
  await userEvent.click(trigger);
  await findOwnSpeciesList();
  return trigger;
}

async function openPanel(action: string) {
  await userEvent.click(await within(dialog()).findByRole("button", { name: action }));
}

function ownSpecies(id: string, name: string, usage: SpeciesUsage): OwnSpeciesView {
  return { category: null, id, isOwn: true, key: null, name, usage };
}

function previewResponse(preview: SpeciesDeletionPreview): () => Promise<Response> {
  return () => Promise.resolve(jsonResponse(preview));
}

function requestsMatching(method: string, path: RegExp): SentRequest[] {
  return sentRequests().filter((request) => request.method === method && path.test(request.path));
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();
  const speciesId = url.pathname.split("/")[3] ?? "";

  if (url.pathname === "/api/species/own") {
    return Promise.resolve(jsonResponse({ items: server.own }));
  }
  if (url.pathname === "/api/species/candidates") {
    return Promise.resolve(jsonResponse({ exact: null, similar: [] }));
  }
  if (url.pathname === "/api/species") {
    return Promise.resolve(jsonResponse({ items: [HUMAN, ...server.own.map(asOption)] }));
  }
  if (url.pathname.endsWith("/deletion-preview")) return server.preview(speciesId);
  if (url.pathname.endsWith("/merge") && method === "POST") {
    const { targetId } = MergeSpeciesInputSchema.parse(JSON.parse(String(init?.body)));
    const source = server.own.find((species) => species.id === speciesId);
    const target = [HUMAN, ...server.own.map(asOption)].find((species) => species.id === targetId);
    server.own = server.own.filter((species) => species.id !== speciesId);
    return Promise.resolve(
      jsonResponse({
        reassigned: {
          bookOverrides: source?.usage.bookOverrides ?? 0,
          characters: source?.usage.characters ?? 0,
        },
        target,
      }),
    );
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

function setupDialog() {
  const onChange = vi.fn<(change: OwnSpeciesChange) => void>();
  renderWithProviders(
    <ManageOwnSpeciesDialog
      onChange={onChange}
      onOpenChange={vi.fn()}
      open
      trigger={<button type="button">Відкрити</button>}
    />,
  );
  return onChange;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  server = {
    deleteOwn: (speciesId) => {
      server.own = server.own.filter((species) => species.id !== speciesId);
      return Promise.resolve(new Response(null, { status: 204 }));
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

  it("moves focus to the deletion check and back to the delete action it came from", async () => {
    setupDialog();

    await openPanel("Видалити «Відьмак»");
    await within(dialog()).findByText(
      "Вид «Відьмак» ніде не використовується. Видалити його назавжди?",
    );
    expect(focusedElement()).toHaveTextContent("Вид «Відьмак» ніде не використовується.");

    await userEvent.click(within(dialog()).getByRole("button", { name: "Назад" }));

    expect(
      await within(dialog()).findByRole("button", { name: "Видалити «Відьмак»" }),
    ).toHaveFocus();
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
    expect(
      within(dialog()).getByText("Персонажів: 3 (у кошику: 1) · У книгах: 1"),
    ).toBeInTheDocument();
    expect(within(dialog()).getByText("Ніде не використовується")).toBeInTheDocument();
  });

  it("asks for no category anywhere while managing species", async () => {
    setupDialog();

    await findOwnSpeciesList();
    expect(within(dialog()).queryByText(/категорі/i)).not.toBeInTheDocument();
    await openPanel("Перейменувати «Відьмак»");

    expect(within(dialog()).getAllByRole("textbox")).toHaveLength(1);
    expect(within(dialog()).queryByText(/категорі/i)).not.toBeInTheDocument();
    expect(within(dialog()).queryByLabelText(/категорі/i)).not.toBeInTheDocument();
  });
});

describe("ManageOwnSpeciesDialog rename", () => {
  it("renames a species and returns to the updated list", async () => {
    const onChange = setupDialog();

    await openPanel("Перейменувати «Відьмак»");
    const name = within(dialog()).getByRole("textbox", { name: "Нова назва для «Відьмак»" });
    expect(name).toHaveValue("Відьмак");
    await userEvent.clear(name);
    await userEvent.type(name, "Відьмачка");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Зберегти" }));

    const list = await findOwnSpeciesList();
    expect(within(list).getByText("Відьмачка")).toBeInTheDocument();
    expect(within(list).queryByText("Відьмак")).not.toBeInTheDocument();
    expect(requestsMatching("PATCH", /^\/api\/species\//)).toEqual([
      { body: { name: "Відьмачка" }, method: "PATCH", path: `/api/species/${OWN.witcher.id}` },
    ]);
    expect(onChange).toHaveBeenCalledWith({
      kind: "renamed",
      species: { ...asOption(OWN.witcher), name: "Відьмачка" },
    });
  });

  it("turns a rename onto a taken name into an offer to merge with the holder", async () => {
    server.rename = () =>
      Promise.resolve(errorResponse(409, "species_duplicate", { species: asOption(OWN.sandworm) }));
    const onChange = setupDialog();

    await openPanel("Перейменувати «Відьмак»");
    const name = within(dialog()).getByRole("textbox", { name: "Нова назва для «Відьмак»" });
    await userEvent.clear(name);
    await userEvent.type(name, "Шай Хулуд");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Зберегти" }));

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
});

describe("ManageOwnSpeciesDialog delete", () => {
  it("checks where the species is used before offering to delete it", async () => {
    server.preview = () => new Promise<Response>(() => undefined);
    setupDialog();

    await openPanel("Видалити «Відьмак»");

    expect(within(dialog()).getByText("Перевіряємо, де використовується вид…")).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Видалити" })).toBeDisabled();
  });

  it("blocks deleting a species in use, counting trashed characters within the total and offering a merge", async () => {
    server.preview = previewResponse({
      bookOverrides: 2,
      canDelete: false,
      characters: 4,
      trashed: 2,
    });
    setupDialog();

    await openPanel("Видалити «Відьмак»");

    expect(
      await within(dialog()).findByText(
        "Вид «Відьмак» використовується, тому видалити його не можна.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByText("Персонажів: 4 (у кошику: 2) · У книгах: 2"),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByRole("button", { name: "Об’єднати з іншим видом" }),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Видалити" })).toBeDisabled();
  });

  it("moves from a blocked delete to merging that species", async () => {
    server.preview = previewResponse({
      bookOverrides: 1,
      canDelete: false,
      characters: 3,
      trashed: 1,
    });
    setupDialog();

    await openPanel("Видалити «Відьмак»");
    await userEvent.click(
      await within(dialog()).findByRole("button", { name: "Об’єднати з іншим видом" }),
    );

    expect(within(dialog()).getByText("Вид, який об’єднуємо")).toBeInTheDocument();
    expect(within(dialog()).getByRole("combobox", { name: "Об’єднати з" })).toHaveValue("");
  });

  it("deletes an unused species only after confirmation and returns to the updated list", async () => {
    const onChange = setupDialog();

    await openPanel("Видалити «Шаї-Хулуд»");

    expect(
      await within(dialog()).findByText(
        "Вид «Шаї-Хулуд» ніде не використовується. Видалити його назавжди?",
      ),
    ).toBeInTheDocument();
    expect(requestsMatching("DELETE", /^\/api\/species\//)).toEqual([]);

    await userEvent.click(within(dialog()).getByRole("button", { name: "Видалити" }));

    const list = await findOwnSpeciesList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Відьмак")).toBeInTheDocument();
    expect(requestsMatching("DELETE", /^\/api\/species\//)).toEqual([
      { body: undefined, method: "DELETE", path: `/api/species/${OWN.sandworm.id}` },
    ]);
    expect(onChange).toHaveBeenCalledWith({ kind: "deleted", speciesId: OWN.sandworm.id });
  });

  it("shows the server's in-use refusal instead of swallowing it", async () => {
    server.deleteOwn = () =>
      Promise.resolve(
        errorResponse(409, "species_in_use", { bookOverrides: 0, characters: 1, trashed: 0 }),
      );
    const onChange = setupDialog();

    await openPanel("Видалити «Шаї-Хулуд»");
    await within(dialog()).findByText(
      "Вид «Шаї-Хулуд» ніде не використовується. Видалити його назавжди?",
    );
    await userEvent.click(within(dialog()).getByRole("button", { name: "Видалити" }));

    const refusal = await within(dialog()).findByRole("alert");
    expect(refusal).toHaveTextContent(
      "Вид «Шаї-Хулуд» використовується, тому видалити його не можна.",
    );
    expect(refusal).toHaveTextContent("Персонажів: 1 · У книгах: 0");
    expect(
      within(refusal).getByRole("button", { name: "Об’єднати з іншим видом" }),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Видалити" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ManageOwnSpeciesDialog merge", () => {
  it("leaves the species being merged out of the target choices", async () => {
    setupDialog();

    await openPanel("Об’єднати «Відьмак»");
    await userEvent.click(within(dialog()).getByRole("combobox", { name: "Об’єднати з" }));

    expect(await screen.findByRole("option", { name: "Шаї-Хулуд" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Людина" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Відьмак" })).not.toBeInTheDocument();
  });

  it("asks to confirm the chosen target before merging", async () => {
    setupDialog();

    await openPanel("Об’єднати «Відьмак»");
    expect(within(dialog()).getByRole("button", { name: "Далі" })).toBeDisabled();
    await userEvent.click(within(dialog()).getByRole("combobox", { name: "Об’єднати з" }));
    await userEvent.click(await screen.findByRole("option", { name: "Людина" }));
    await userEvent.click(within(dialog()).getByRole("button", { name: "Далі" }));

    expect(within(dialog()).getByText("Перевірте перед об’єднанням")).toBeInTheDocument();
    expect(
      within(dialog()).getByText(
        "«Відьмак» буде видалено, а всі його персонажі й книги перейдуть до виду «Людина». Позначки спойлерів збережуться. Скасувати це не можна.",
      ),
    ).toBeInTheDocument();
    expect(requestsMatching("POST", /\/merge$/)).toEqual([]);
  });

  it("moves focus to the confirmation so a repeated Enter on Next cannot merge", async () => {
    setupDialog();

    await openPanel("Об’єднати «Відьмак»");
    await userEvent.click(within(dialog()).getByRole("combobox", { name: "Об’єднати з" }));
    await userEvent.click(await screen.findByRole("option", { name: "Людина" }));
    within(dialog()).getByRole("button", { name: "Далі" }).focus();
    await userEvent.keyboard("{Enter}{Enter}");

    expect(
      within(dialog()).getByRole("region", { name: "Перевірте перед об’єднанням" }),
    ).toHaveFocus();
    expect(requestsMatching("POST", /\/merge$/)).toEqual([]);
  });

  it("ignores the second click of a double-click on confirm", async () => {
    setupDialog();

    await openPanel("Об’єднати «Відьмак»");
    await userEvent.click(within(dialog()).getByRole("combobox", { name: "Об’єднати з" }));
    await userEvent.click(await screen.findByRole("option", { name: "Людина" }));
    await userEvent.click(within(dialog()).getByRole("button", { name: "Далі" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Об’єднати" }), { detail: 2 });

    expect(requestsMatching("POST", /\/merge$/)).toEqual([]);
  });

  it("merges into the confirmed target and returns to the updated list", async () => {
    const onChange = setupDialog();

    await openPanel("Об’єднати «Відьмак»");
    await userEvent.click(within(dialog()).getByRole("combobox", { name: "Об’єднати з" }));
    await userEvent.click(await screen.findByRole("option", { name: "Людина" }));
    await userEvent.click(within(dialog()).getByRole("button", { name: "Далі" }));
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
  });
});
