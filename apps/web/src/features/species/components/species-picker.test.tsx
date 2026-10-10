import "@testing-library/jest-dom/vitest";
import type { Nullable, SpeciesCandidates, SpeciesOptionView } from "@app/shared";
import type { FormEvent } from "react";

import { SpeciesNameInputSchema } from "@app/shared";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { SpeciesSelection } from "../model/species-selection";

import { SpeciesPicker } from "./species-picker";

type SentRequest = { body: unknown; method: string; url: URL };

type SpeciesServer = {
  candidates: Record<string, SpeciesCandidates>;
  create: (name: string) => Promise<Response>;
  search: (query: string) => Promise<Response>;
};

const CATEGORY = {
  elven: { key: "elven", name: "Ельфи та споріднені" },
  humanoid: { key: "humanoid", name: "Люди та людиноподібні" },
  smallfolk: { key: "smallfolk", name: "Гноми, гобліни та малі народи" },
} as const;

const SPECIES = {
  darkElf: system("00000000-0000-4000-8000-000000000006", "Темний ельф", CATEGORY.elven),
  dwarf: system("00000000-0000-4000-8000-000000000003", "Дворф", CATEGORY.smallfolk),
  elf: system("00000000-0000-4000-8000-000000000002", "Ельф", CATEGORY.elven),
  halfElf: system("00000000-0000-4000-8000-000000000007", "Напівельф", CATEGORY.elven),
  human: system("00000000-0000-4000-8000-000000000001", "Людина", CATEGORY.humanoid),
  sandworm: own("00000000-0000-4000-8000-000000000009", "Шаї-Хулуд"),
  witcher: own("00000000-0000-4000-8000-000000000008", "Відьмак"),
} as const satisfies Record<string, SpeciesOptionView>;

const POPULAR = [SPECIES.human, SPECIES.elf, SPECIES.dwarf, SPECIES.darkElf, SPECIES.witcher];

const CATALOG = Object.values(SPECIES);

const CREATED_ID = "00000000-0000-4000-8000-0000000000aa";

const NO_CANDIDATES: SpeciesCandidates = { exact: null, similar: [] };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let server: SpeciesServer;

function candidateLookups(): Nullable<string>[] {
  return sentRequests()
    .filter((request) => request.url.pathname === "/api/species/candidates")
    .map((request) => request.url.searchParams.get("name"));
}

function combobox(): HTMLElement {
  return screen.getByRole("combobox", { name: "Вид" });
}

function createBodies(): unknown[] {
  return sentRequests()
    .filter((request) => request.method === "POST" && request.url.pathname === "/api/species")
    .map((request) => request.body);
}

function defaultSearch(query: string): Promise<Response> {
  const needle = query.toLowerCase();
  const items =
    needle === "" ? POPULAR : CATALOG.filter((item) => item.name.toLowerCase().includes(needle));
  return Promise.resolve(jsonResponse({ items }));
}

function installFakeTimersVisibleToTestingLibrary() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function own(id: string, name: string): SpeciesOptionView {
  return { category: null, id, isOwn: true, key: null, name };
}

function PickerField({
  initial = null,
  onChange,
}: {
  initial?: Nullable<SpeciesSelection>;
  onChange: (selection: Nullable<SpeciesSelection>) => void;
}) {
  const [value, setValue] = useState<Nullable<SpeciesSelection>>(initial);

  return (
    <>
      <label htmlFor="species">Вид</label>
      <SpeciesPicker
        inputId="species"
        label="Вид"
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        placeholder="Пошук виду"
        value={value}
      />
    </>
  );
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();

  if (method === "POST" && url.pathname === "/api/species") {
    const { name } = SpeciesNameInputSchema.parse(JSON.parse(String(init?.body)));
    return server.create(name);
  }
  if (url.pathname === "/api/species/candidates") {
    const name = url.searchParams.get("name") ?? "";
    return Promise.resolve(jsonResponse(server.candidates[name] ?? NO_CANDIDATES));
  }
  if (url.pathname === "/api/species") return server.search(url.searchParams.get("q") ?? "");
  return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
}

function respondWithDuplicateOf(holder: SpeciesOptionView): SpeciesServer["create"] {
  return () =>
    Promise.resolve(
      jsonResponse(
        {
          code: "species_duplicate",
          details: { species: holder },
          message: "A species with this name already exists",
        },
        409,
      ),
    );
}

function searchTerms(): Nullable<string>[] {
  return sentRequests()
    .filter((request) => request.method === "GET" && request.url.pathname === "/api/species")
    .map((request) => request.url.searchParams.get("q"));
}

function sentRequests(): SentRequest[] {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    method: (init?.method ?? "GET").toUpperCase(),
    url: new URL(String(input), "http://localhost"),
  }));
}

async function settle(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setupPicker(initial: Nullable<SpeciesSelection> = null) {
  const onChange = vi.fn<(selection: Nullable<SpeciesSelection>) => void>();
  renderWithProviders(<PickerField initial={initial} onChange={onChange} />);
  return onChange;
}

function system(
  id: string,
  name: string,
  category: SpeciesOptionView["category"],
): SpeciesOptionView {
  return { category, id, isOwn: false, key: name.toLowerCase(), name };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  server = {
    candidates: {},
    create: (name) => Promise.resolve(jsonResponse(own(CREATED_ID, name), 201)),
    search: defaultSearch,
  };
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SpeciesPicker search timing", () => {
  beforeEach(() => {
    installFakeTimersVisibleToTestingLibrary();
  });

  it("searches once, 300 ms after the last keystroke", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setupPicker();

    await user.type(combobox(), "ельф");
    await settle(299);
    expect(searchTerms()).not.toContain("ельф");

    await settle(1);
    expect(searchTerms()).toEqual([null, "ельф"]);
  });

  it("waits for a second character before searching", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setupPicker();

    await user.type(combobox(), "е");
    await settle(1000);
    expect(searchTerms()).toEqual([null]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Введіть щонайменше 2 символи, щоб шукати.",
    );

    await user.type(combobox(), "л", { skipClick: true });
    await settle(300);
    expect(searchTerms()).toEqual([null, "ел"]);
  });
});

describe("SpeciesPicker results", () => {
  it("shows the popular list while the input is empty", async () => {
    setupPicker();

    await userEvent.click(combobox());

    expect(await screen.findByRole("option", { name: "Людина" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Відьмак" })).toBeInTheDocument();
    expect(searchTerms()).toEqual([null]);
  });

  it("groups options under their category, gathering a category the server split apart", async () => {
    setupPicker();

    await userEvent.click(combobox());

    const elven = await screen.findByRole("group", { name: "Ельфи та споріднені" });
    expect(
      within(elven)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Ельф", "Темний ельф"]);
    expect(
      within(screen.getByRole("group", { name: "Ваші види" })).getByRole("option", {
        name: "Відьмак",
      }),
    ).toBeInTheDocument();
  });
});

describe("SpeciesPicker results for a query", () => {
  it("drops an answer for an earlier query that arrives after the current one", async () => {
    const lateAnswer = jsonResponse({ items: [own(CREATED_ID, "Елементаль")] });
    const controls: { release?: () => void } = {};
    const earlierQueryGate = new Promise<void>((resolve) => {
      controls.release = resolve;
    });
    server.search = (query) =>
      query === "ел" ? earlierQueryGate.then(() => lateAnswer) : defaultSearch(query);
    setupPicker();

    await userEvent.type(combobox(), "ел");
    await waitFor(() => expect(searchTerms()).toContain("ел"));
    await userEvent.type(combobox(), "ьф", { skipClick: true });
    expect(await screen.findByRole("option", { name: "Темний ельф" })).toBeInTheDocument();

    controls.release?.();
    await waitFor(() => expect(lateAnswer.bodyUsed).toBe(true));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.queryByRole("option", { name: "Елементаль" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Темний ельф" })).toBeInTheDocument();
  });

  it("shows at most 10 matches even when the server sends more", async () => {
    const matches = Array.from({ length: 12 }, (_, index) =>
      own(`00000000-0000-4000-8000-0000000001${String(index + 10)}`, `Ельф ${index + 1}`),
    );
    server.search = (query) =>
      query === "" ? defaultSearch(query) : Promise.resolve(jsonResponse({ items: matches }));
    setupPicker();

    await userEvent.type(combobox(), "Ельф");

    expect(await screen.findByRole("option", { name: "Ельф 10" })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /^Ельф \d+$/ })).toHaveLength(10);
    expect(screen.queryByRole("option", { name: "Ельф 11" })).not.toBeInTheDocument();
  });
});

describe("SpeciesPicker existing and similar species", () => {
  it("offers the exact match as an existing species and no way to create a duplicate", async () => {
    server.candidates = { Ельф: { exact: SPECIES.elf, similar: [] } };
    setupPicker();

    await userEvent.type(combobox(), "Ельф");

    expect(await screen.findByRole("option", { name: "Обрати наявний: Ельф" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });

  it("explains similar species while still offering to create the typed one", async () => {
    server.candidates = { Ельфійка: { exact: null, similar: [SPECIES.elf, SPECIES.halfElf] } };
    setupPicker();

    await userEvent.type(combobox(), "Ельфійка");

    const similar = await screen.findByRole("group", { name: "Схожі види" });
    expect(similar).toHaveAccessibleDescription(
      "Можливо, це той самий вид. Оберіть наявний або створіть новий.",
    );
    expect(within(similar).getByRole("option", { name: "Напівельф" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Усе одно створити «Ельфійка»" }),
    ).toBeInTheDocument();
  });

  it("creates the typed species when asked to despite similar ones", async () => {
    server.candidates = { Ельфійка: { exact: null, similar: [SPECIES.elf, SPECIES.halfElf] } };
    const onChange = setupPicker();

    await userEvent.type(combobox(), "Ельфійка");
    await userEvent.click(
      await screen.findByRole("option", { name: "Усе одно створити «Ельфійка»" }),
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ id: CREATED_ID, label: "Ельфійка" }),
    );
    expect(createBodies()).toEqual([{ name: "Ельфійка" }]);
  });
});

describe("SpeciesPicker creating a species", () => {
  it("selects the id the server returns for the created species", async () => {
    const onChange = setupPicker();

    await userEvent.type(combobox(), "Фримен");
    await userEvent.click(await screen.findByRole("option", { name: "Створити вид «Фримен»" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ id: CREATED_ID, label: "Фримен" }));
    expect(combobox()).toHaveValue("Фримен");
  });

  it("offers the species the server names when the new name is already taken", async () => {
    server.create = respondWithDuplicateOf(SPECIES.sandworm);
    const onChange = setupPicker();

    await userEvent.type(combobox(), "Шай Хулуд");
    await userEvent.click(await screen.findByRole("option", { name: "Створити вид «Шай Хулуд»" }));

    expect(
      await screen.findByText("Такий вид уже існує. Оберіть наявний варіант."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Обрати наявний: Шаї-Хулуд" }));

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.sandworm.id, label: "Шаї-Хулуд" });
  });

  it("asks for fresh candidates once the server reports a duplicate", async () => {
    server.create = respondWithDuplicateOf(SPECIES.sandworm);
    setupPicker();

    await userEvent.type(combobox(), "Шай Хулуд");
    await userEvent.click(await screen.findByRole("option", { name: "Створити вид «Шай Хулуд»" }));

    await waitFor(() => expect(candidateLookups()).toEqual(["Шай Хулуд", "Шай Хулуд"]));
  });
});

describe("SpeciesPicker keyboard", () => {
  it("moves through the options with the arrow keys and picks one with Enter", async () => {
    const onChange = setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Людина" });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.elf.id, label: "Ельф" });
    expect(combobox()).toHaveValue("Ельф");
  });

  it("closes the list on Escape without choosing anything", async () => {
    const onChange = setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Людина" });
    await userEvent.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("picks nothing on Enter while the query is too short to search", async () => {
    const onChange = setupPicker();

    await userEvent.type(combobox(), "е");
    await screen.findByRole("option", { name: "Людина" });
    await userEvent.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reaches the clear button from the keyboard", async () => {
    const onChange = setupPicker({ id: SPECIES.human.id, label: "Людина" });

    await userEvent.click(combobox());
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Очистити вид" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("never submits a surrounding form on Enter", async () => {
    const onSubmit = vi.fn<(event: FormEvent<HTMLFormElement>) => void>((event) =>
      event.preventDefault(),
    );
    const onChange = vi.fn<(selection: Nullable<SpeciesSelection>) => void>();
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <PickerField onChange={onChange} />
        <button type="submit">Зберегти</button>
      </form>,
    );

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Людина" });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.human.id, label: "Людина" });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("SpeciesPicker value", () => {
  it("clears the selection with the labelled clear button", async () => {
    const onChange = setupPicker({ id: SPECIES.human.id, label: "Людина" });
    expect(combobox()).toHaveValue("Людина");

    await userEvent.click(screen.getByRole("button", { name: "Очистити вид" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(combobox()).toHaveValue("");
  });

  it("keeps typed text out of the value and creates nothing when the field loses focus", async () => {
    const onChange = setupPicker();

    await userEvent.type(combobox(), "Фримен");
    await screen.findByRole("option", { name: "Створити вид «Фримен»" });
    await userEvent.tab();

    expect(combobox()).not.toHaveFocus();
    expect(combobox()).toHaveValue("");
    expect(onChange).not.toHaveBeenCalled();
    expect(createBodies()).toEqual([]);
  });
});

describe("SpeciesPicker states", () => {
  it("announces the search while it is in flight", async () => {
    server.search = () => new Promise<Response>(() => undefined);
    setupPicker();

    await userEvent.click(combobox());

    expect(await screen.findByRole("status")).toHaveTextContent("Шукаємо…");
    expect(screen.getByRole("listbox", { name: "Вид" })).toHaveAttribute("aria-busy", "true");
  });

  it("says no species matches when the search comes back empty", async () => {
    setupPicker();

    await userEvent.type(combobox(), "Ззз");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Такого виду ще немає."),
    );
    expect(screen.queryByRole("option", { name: "Людина" })).not.toBeInTheDocument();
  });

  it("reports a failed search with a way to retry", async () => {
    server.search = () => Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
    setupPicker();

    await userEvent.click(combobox());

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Не вдалося завантажити види."),
    );
    expect(screen.getByRole("button", { name: "Повторити" })).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("searches again on retry and shows the recovered results", async () => {
    const outcomes = { failuresLeft: 1 };
    server.search = (query) => {
      if (outcomes.failuresLeft === 0) return defaultSearch(query);
      outcomes.failuresLeft -= 1;
      return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
    };
    setupPicker();

    await userEvent.click(combobox());
    await userEvent.click(await screen.findByRole("button", { name: "Повторити" }));

    expect(await screen.findByRole("option", { name: "Людина" })).toBeInTheDocument();
    expect(screen.queryByText("Не вдалося завантажити види.")).not.toBeInTheDocument();
  });

  it("retries a failed search with Enter from the input and says so", async () => {
    const outcomes = { failuresLeft: 1 };
    server.search = (query) => {
      if (outcomes.failuresLeft === 0) return defaultSearch(query);
      outcomes.failuresLeft -= 1;
      return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
    };
    setupPicker();

    await userEvent.click(combobox());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Не вдалося завантажити види. Натисніть Enter, щоб спробувати ще раз.",
      ),
    );
    expect(combobox()).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("option", { name: "Людина" })).toBeInTheDocument();
    expect(searchTerms()).toEqual([null, null]);
  });

  it("announces how many species it found in a region that is there before the list opens", async () => {
    setupPicker();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await userEvent.click(combobox());

    await waitFor(() => expect(status).toHaveTextContent("Знайдено 5 видів"));
    expect(screen.getByRole("status")).toBe(status);
  });
});
