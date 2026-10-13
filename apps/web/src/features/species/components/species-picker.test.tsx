import "@testing-library/jest-dom/vitest";
import type { Nullable, SpeciesCandidates, SpeciesOptionView } from "@app/shared";
import type { ComponentProps, FormEvent } from "react";

import { SpeciesNameInputSchema } from "@app/shared";
import { NextIntlClientProvider } from "next-intl";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { SpeciesSelection } from "../model/species-selection";

import { SpeciesPicker } from "./species-picker";

type PickerOptions = Pick<
  ComponentProps<typeof SpeciesPicker>,
  "allowCreate" | "disabled" | "excludeId"
>;

type SentRequest = { body: unknown; method: string; url: URL };

type SpeciesServer = {
  browse: (pageNumber: number) => Promise<Response>;
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
  dragon: system("00000000-0000-4000-8000-000000000010", "Дракон", null),
  dwarf: system("00000000-0000-4000-8000-000000000003", "Дворф", CATEGORY.smallfolk),
  elf: system("00000000-0000-4000-8000-000000000002", "Ельф", CATEGORY.elven),
  halfElf: system("00000000-0000-4000-8000-000000000007", "Напівельф", CATEGORY.elven),
  human: system("00000000-0000-4000-8000-000000000001", "Людина", CATEGORY.humanoid),
  sandworm: own("00000000-0000-4000-8000-000000000009", "Шаї-Хулуд"),
  witcher: own("00000000-0000-4000-8000-000000000008", "Відьмак"),
} as const satisfies Record<string, SpeciesOptionView>;

const POPULAR = [SPECIES.human, SPECIES.elf, SPECIES.dwarf, SPECIES.darkElf, SPECIES.witcher];

const CATALOG = Object.values(SPECIES);

const EMPTY_BROWSE_PAGE = { items: [], page: 1, pagesCount: 0, pageSize: 30, totalCount: 0 };

const PAGED_CATALOG: SpeciesOptionView[][] = [
  [SPECIES.halfElf, SPECIES.sandworm],
  [SPECIES.dragon],
];

const LIST_METRICS = { clientHeight: 240, scrollHeight: 1200 } as const;

const CREATED_ID = "00000000-0000-4000-8000-0000000000aa";

const NO_CANDIDATES: SpeciesCandidates = { exact: null, similar: [] };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let server: SpeciesServer;

function candidateLookups(): Nullable<string>[] {
  return sentRequests()
    .filter((request) => request.url.pathname === "/api/species/candidates")
    .map((request) => request.url.searchParams.get("name"));
}

function catalogPages(pages: SpeciesOptionView[][]): SpeciesServer["browse"] {
  return (pageNumber) =>
    Promise.resolve(
      jsonResponse({
        items: pages[pageNumber - 1] ?? [],
        page: pageNumber,
        pagesCount: pages.length,
        pageSize: 30,
        totalCount: pages.flat().length,
      }),
    );
}

function catalogQueries(): URLSearchParams[] {
  return sentRequests()
    .filter((request) => request.url.pathname === "/api/species/browse")
    .map((request) => request.url.searchParams);
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

function optionNamesIn(groupName: string): Nullable<string>[] {
  return within(screen.getByRole("group", { name: groupName }))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

function own(id: string, name: string): SpeciesOptionView {
  return { category: null, id, isOwn: true, key: null, name };
}

function PickerField({
  initial = null,
  onChange,
  ...options
}: PickerOptions & {
  initial?: Nullable<SpeciesSelection>;
  onChange: (selection: Nullable<SpeciesSelection>) => void;
}) {
  const [value, setValue] = useState<Nullable<SpeciesSelection>>(initial);

  return (
    <>
      <label htmlFor="species">Вид</label>
      <SpeciesPicker
        {...options}
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

function requestedCatalogPages(): Nullable<string>[] {
  return catalogQueries().map((query) => query.get("pageNumber"));
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();

  if (method === "POST" && url.pathname === "/api/species") {
    const { name } = SpeciesNameInputSchema.parse(JSON.parse(String(init?.body)));
    return server.create(name);
  }
  if (url.pathname === "/api/species/browse") {
    return server.browse(Number(url.searchParams.get("pageNumber") ?? "1"));
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

async function scrollListToBottom() {
  const wheel = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: LIST_METRICS.scrollHeight - LIST_METRICS.clientHeight,
  });

  await act(async () => {
    screen.getByRole("listbox", { name: "Вид" }).dispatchEvent(wheel);
  });
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

function setupPicker(initial: Nullable<SpeciesSelection> = null, options: PickerOptions = {}) {
  const onChange = vi.fn<(selection: Nullable<SpeciesSelection>) => void>();
  renderWithProviders(<PickerField initial={initial} onChange={onChange} {...options} />);
  return onChange;
}

function stubListMetrics(): () => void {
  const scroll = { top: 0 };
  const measured = ["clientHeight", "scrollHeight", "scrollTop"] as const;
  const originals = measured.map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );

  Object.defineProperties(HTMLElement.prototype, {
    clientHeight: { configurable: true, get: () => LIST_METRICS.clientHeight },
    scrollHeight: { configurable: true, get: () => LIST_METRICS.scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => scroll.top,
      set: (next: number) => {
        scroll.top = next;
      },
    },
  });

  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, name);
        continue;
      }
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
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
    browse: () => Promise.resolve(jsonResponse(EMPTY_BROWSE_PAGE)),
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
    server.search = () =>
      Promise.resolve(jsonResponse({ items: [SPECIES.elf, SPECIES.witcher, SPECIES.darkElf] }));
    setupPicker();

    await userEvent.type(combobox(), "ль");

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

describe("SpeciesPicker catalog", () => {
  it("pins the popular species and your recent ones above the catalog grouped by category", async () => {
    server.browse = catalogPages([[SPECIES.halfElf, SPECIES.sandworm, SPECIES.dragon]]);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Дракон" });

    expect(screen.getAllByRole("group")).toEqual(
      ["Популярні", "Ваші нещодавні", "Ельфи та споріднені", "Ваші види", "Інші"].map((name) =>
        screen.getByRole("group", { name }),
      ),
    );
    expect(optionNamesIn("Популярні")).toEqual(["Людина", "Ельф", "Дворф", "Темний ельф"]);
    expect(optionNamesIn("Ваші нещодавні")).toEqual(["Відьмак"]);
  });

  it("lists a pinned species once instead of repeating it in its catalog group", async () => {
    server.browse = catalogPages([
      [SPECIES.human, SPECIES.elf, SPECIES.halfElf, SPECIES.witcher, SPECIES.sandworm],
    ]);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });

    expect(screen.getAllByRole("option", { name: "Людина" })).toHaveLength(1);
    expect(optionNamesIn("Ельфи та споріднені")).toEqual(["Напівельф"]);
    expect(optionNamesIn("Ваші види")).toEqual(["Шаї-Хулуд"]);
  });

  it("hides the excluded species from the pinned sections and from the catalog", async () => {
    server.browse = catalogPages([[SPECIES.witcher, SPECIES.sandworm]]);
    setupPicker(null, { excludeId: SPECIES.witcher.id });

    await userEvent.click(combobox());

    expect(await screen.findByRole("option", { name: "Шаї-Хулуд" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Відьмак" })).not.toBeInTheDocument();
  });

  it("picks a catalog species below the pinned ones with the arrow keys and Enter", async () => {
    server.browse = catalogPages([[SPECIES.halfElf, SPECIES.sandworm]]);
    const onChange = setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Напівельф" });
    await userEvent.keyboard(`${"{ArrowDown}".repeat(6)}{Enter}`);

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.halfElf.id, label: "Напівельф" });
  });

  it("asks for the catalog in the interface language, 30 species a page", async () => {
    renderWithProviders(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PickerField onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );

    await userEvent.click(combobox());

    await waitFor(() =>
      expect(catalogQueries().map((query) => Object.fromEntries(query))).toEqual([
        { locale: "en", pageNumber: "1", pageSize: "30" },
      ]),
    );
  });
});

describe("SpeciesPicker catalog paging", () => {
  beforeEach(() => stubListMetrics());

  it("loads the next catalog page once the list is scrolled to its end", async () => {
    server.browse = catalogPages(PAGED_CATALOG);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    expect(requestedCatalogPages()).toEqual(["1"]);
    await scrollListToBottom();

    expect(await screen.findByRole("option", { name: "Дракон" })).toBeInTheDocument();
    expect(requestedCatalogPages()).toEqual(["1", "2"]);
  });

  it("stops asking for pages once the last one has arrived", async () => {
    server.browse = catalogPages(PAGED_CATALOG);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await scrollListToBottom();
    await screen.findByRole("option", { name: "Дракон" });
    await scrollListToBottom();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(requestedCatalogPages()).toEqual(["1", "2"]);
  });

  it("says more species are loading while the next page is on its way", async () => {
    const pages = catalogPages(PAGED_CATALOG);
    server.browse = (pageNumber) =>
      pageNumber === 1 ? pages(pageNumber) : new Promise<Response>(() => undefined);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await scrollListToBottom();

    expect(await screen.findByText("Завантажуємо ще…")).toBeInTheDocument();
  });

  it("reaches the next page from the keyboard by pressing ArrowDown past the last species", async () => {
    server.browse = catalogPages(PAGED_CATALOG);
    const onChange = setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await userEvent.keyboard("{ArrowDown}".repeat(8));
    await screen.findByRole("option", { name: "Дракон" });
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.dragon.id, label: "Дракон" });
  });

  it("reports a next page that failed to load and does not retry it on its own", async () => {
    const pages = catalogPages(PAGED_CATALOG);
    server.browse = (pageNumber) =>
      pageNumber === 1
        ? pages(pageNumber)
        : Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await scrollListToBottom();

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося завантажити ще види.");
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(requestedCatalogPages()).toEqual(["1", "2"]);
  });

  it("loads the failed page again on retry and shows its species", async () => {
    const pages = catalogPages(PAGED_CATALOG);
    const outcomes = { failuresLeft: 1 };
    server.browse = (pageNumber) => {
      if (pageNumber === 1 || outcomes.failuresLeft === 0) return pages(pageNumber);
      outcomes.failuresLeft -= 1;
      return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
    };
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await scrollListToBottom();
    const alert = await screen.findByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: "Повторити" }));

    expect(await screen.findByRole("option", { name: "Дракон" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(requestedCatalogPages()).toEqual(["1", "2", "2"]);
  });

  it("stops paging through the catalog once a query is typed", async () => {
    server.browse = catalogPages(PAGED_CATALOG);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await userEvent.type(combobox(), "ельф", { skipClick: true });
    await screen.findByRole("option", { name: "Створити вид «ельф»" });
    await scrollListToBottom();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(requestedCatalogPages()).toEqual(["1"]);
  });

  it("drops the loading-more footer once a query is typed", async () => {
    const pages = catalogPages(PAGED_CATALOG);
    server.browse = (pageNumber) =>
      pageNumber === 1 ? pages(pageNumber) : new Promise<Response>(() => undefined);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await scrollListToBottom();
    await screen.findByText("Завантажуємо ще…");
    await userEvent.type(combobox(), "ельф", { skipClick: true });
    await screen.findByRole("option", { name: "Створити вид «ельф»" });

    expect(screen.queryByText("Завантажуємо ще…")).not.toBeInTheDocument();
  });

  it("waits for a refresh of the first page before loading the next one", async () => {
    const freeman = own(CREATED_ID, "Фримен");
    const stale = catalogPages(PAGED_CATALOG);
    const fresh = catalogPages([
      [freeman, SPECIES.halfElf],
      [SPECIES.sandworm, SPECIES.dragon],
    ]);
    const controls: { release?: () => void } = {};
    const refreshGate = new Promise<void>((resolve) => {
      controls.release = resolve;
    });
    const firstPageLoads = { count: 0 };
    server.browse = (pageNumber) => {
      if (pageNumber !== 1) return fresh(pageNumber);
      firstPageLoads.count += 1;
      return firstPageLoads.count === 1 ? stale(pageNumber) : refreshGate.then(() => fresh(1));
    };
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await userEvent.keyboard("{Escape}");
    await userEvent.click(combobox());
    await waitFor(() => expect(requestedCatalogPages()).toEqual(["1", "1"]));
    await scrollListToBottom();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(requestedCatalogPages()).toEqual(["1", "1"]);
    expect(screen.queryByText("Завантажуємо ще…")).not.toBeInTheDocument();

    controls.release?.();

    expect(await screen.findByRole("option", { name: "Дракон" })).toBeInTheDocument();
    expect(requestedCatalogPages()).toEqual(["1", "1", "2"]);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Людина",
      "Ельф",
      "Дворф",
      "Темний ельф",
      "Відьмак",
      "Фримен",
      "Шаї-Хулуд",
      "Напівельф",
      "Дракон",
    ]);
  });

  it("shows a species once when the next page repeats it", async () => {
    server.browse = catalogPages([
      [SPECIES.halfElf, SPECIES.sandworm],
      [SPECIES.sandworm, SPECIES.dragon],
    ]);
    setupPicker();

    await userEvent.click(combobox());
    await screen.findByRole("option", { name: "Шаї-Хулуд" });
    await scrollListToBottom();
    await screen.findByRole("option", { name: "Дракон" });

    expect(screen.getAllByRole("option", { name: "Шаї-Хулуд" })).toHaveLength(1);
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

  it("leaves the committed label unselected on click, so typing refines it into a search", async () => {
    setupPicker({ id: SPECIES.elf.id, label: "Ельф" });
    await userEvent.click(combobox());

    expect(combobox()).toHaveProperty("selectionStart", 4);
    expect(combobox()).toHaveProperty("selectionEnd", 4);

    await userEvent.type(combobox(), "ійка", { skipClick: true });

    expect(combobox()).toHaveValue("Ельфійка");
    expect(await screen.findByRole("option", { name: "Створити вид «Ельфійка»" })).toBeVisible();
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

    await userEvent.type(combobox(), "ельф");

    await waitFor(() => expect(status).toHaveTextContent("Знайдено 3 види"));
    expect(screen.getByRole("status")).toBe(status);
  });
});

describe("SpeciesPicker without creation", () => {
  it("offers nothing to create and creates nothing on Enter or click for an unmatched name", async () => {
    const onChange = setupPicker(null, { allowCreate: false });

    await userEvent.type(combobox(), "Фримен");
    await waitFor(() => expect(candidateLookups()).toEqual(["Фримен"]));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Такого виду ще немає."),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("listbox", { name: "Вид" }));
    await userEvent.click(combobox());
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(createBodies()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    expect(combobox()).toHaveValue("Фримен");
    expect(screen.getByRole("listbox", { name: "Вид" })).toBeInTheDocument();
  });

  it("lists similar species without the hint to create a new one", async () => {
    server.candidates = { Ельфійка: { exact: null, similar: [SPECIES.elf, SPECIES.halfElf] } };
    const onChange = setupPicker(null, { allowCreate: false });

    await userEvent.type(combobox(), "Ельфійка");
    const similar = await screen.findByRole("group", { name: "Схожі види" });

    expect(similar).not.toHaveAccessibleDescription();
    expect(screen.queryByRole("option", { name: /створити/i })).not.toBeInTheDocument();
    await userEvent.click(within(similar).getByRole("option", { name: "Напівельф" }));

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.halfElf.id, label: "Напівельф" });
    expect(createBodies()).toEqual([]);
  });

  it("picks the exact match with Enter", async () => {
    server.candidates = { Ельф: { exact: SPECIES.elf, similar: [] } };
    const onChange = setupPicker(null, { allowCreate: false });

    await userEvent.type(combobox(), "Ельф");
    await screen.findByRole("option", { name: "Обрати наявний: Ельф" });
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: SPECIES.elf.id, label: "Ельф" });
    expect(createBodies()).toEqual([]);
  });

  it("still selects system and own species", async () => {
    const onChange = setupPicker(null, { allowCreate: false });

    await userEvent.type(combobox(), "Дворф");
    await screen.findByRole("option", { name: "Дворф" });
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ id: SPECIES.dwarf.id, label: "Дворф" });

    await userEvent.click(combobox());
    await userEvent.click(await screen.findByRole("option", { name: "Відьмак" }));
    expect(onChange).toHaveBeenLastCalledWith({ id: SPECIES.witcher.id, label: "Відьмак" });
    expect(createBodies()).toEqual([]);
  });

  it("hides the excluded species from the list and from the exact match", async () => {
    server.candidates = { Відьмак: { exact: SPECIES.witcher, similar: [] } };
    setupPicker(null, { allowCreate: false, excludeId: SPECIES.witcher.id });

    await userEvent.click(combobox());
    expect(await screen.findByRole("option", { name: "Людина" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Відьмак" })).not.toBeInTheDocument();

    await userEvent.type(combobox(), "Відьмак", { skipClick: true });
    await waitFor(() => expect(candidateLookups()).toEqual(["Відьмак"]));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Такого виду ще немає."),
    );

    expect(screen.queryByRole("option", { name: /Відьмак/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });
});

describe("SpeciesPicker disabled", () => {
  it("shows the chosen species but lets nothing open, search, change or clear it", async () => {
    const onChange = setupPicker({ id: SPECIES.human.id, label: "Людина" }, { disabled: true });

    expect(combobox()).toBeDisabled();
    expect(combobox()).toHaveValue("Людина");
    expect(screen.queryByRole("button", { name: "Очистити вид" })).not.toBeInTheDocument();

    await userEvent.click(combobox());
    await userEvent.type(combobox(), "ельф");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).toHaveValue("Людина");
    expect(onChange).not.toHaveBeenCalled();
    expect(searchTerms()).toEqual([]);
  });

  it("closes an open list and drops the typed text once it becomes disabled", async () => {
    const onChange = vi.fn<(selection: Nullable<SpeciesSelection>) => void>();
    const { rerender } = renderWithProviders(<PickerField onChange={onChange} />);

    await userEvent.type(combobox(), "ельф");
    expect(await screen.findByRole("option", { name: "Темний ельф" })).toBeInTheDocument();

    rerender(<PickerField disabled onChange={onChange} />);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).toHaveValue("");
    expect(onChange).not.toHaveBeenCalled();
  });
});
