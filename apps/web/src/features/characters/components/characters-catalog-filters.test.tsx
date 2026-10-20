import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeSeriesDetailsView, makeSeriesView } from "@/features/series/model/series.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type {
  CharactersCatalogAdvancedFilters,
  CharactersCatalogState,
} from "../model/characters-catalog-query";

import { CharactersCatalogFilters } from "./characters-catalog-filters";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const attitude = messages.characters.attitude;
const filters = messages.characters.catalog.filters;
const gender = messages.characters.gender;
const importance = messages.characters.importance;

const series = {
  dune: makeSeriesView({
    authors: [{ id: "2c4e6a8b-1d3f-4a5b-8c7d-9e0f1a2b3c4d", name: "Френк Герберт" }],
    id: "8e1d2c3b-4a5f-4e6d-9c8b-7a6f5e4d3c2b",
    name: "Хроніки Дюни",
  }),
  empyrean: makeSeriesView({
    authors: [{ id: "4b6d8f0a-2c4e-4f6a-8b0c-2d4e6f8a0b1c", name: "Ребекка Яррос" }],
    id: "1f2e3d4c-5b6a-4987-8f6e-5d4c3b2a1f0e",
    name: "Емпіреї",
  }),
};

const DUNE_SEARCH = "Дюн";

const elf = {
  category: null,
  id: "2b4d6f8a-0c2e-4a4b-8d6f-8a0c2e4a6b8d",
  isOwn: false,
  key: "elf",
  name: "Ельф",
};

const emptyFacets = {
  attitude: [],
  gender: [],
  group: [],
  importance: [],
  role: [],
  species: [],
  tag: [],
};

const noFilters: CharactersCatalogAdvancedFilters = {
  attitude: [],
  bookId: null,
  gender: [],
  groupId: [],
  importance: [],
  role: [],
  seriesId: null,
  speciesId: [],
  spoilers: "all",
  tagId: [],
};

const appliedState: CharactersCatalogState = {
  ...noFilters,
  filter: "all",
  q: "",
  sort: "name",
  view: "grid",
};

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

let respondToBooks: () => Promise<Response>;
let respondToFacets: () => Promise<Response>;
let respondToSeries: (term: null | string) => Promise<Response>;
let respondToSpecies: () => Promise<Response>;

function centralImportanceChip(): HTMLElement {
  return chipIn(filters.importance, importance.central);
}

function chipIn(groupLabel: string, label: string): HTMLElement {
  return within(screen.getByRole("toolbar", { name: groupLabel })).getByRole("button", {
    name: new RegExp(`^${label}`),
  });
}

function chipLabel(chip: HTMLElement): string {
  return (chip.textContent ?? "").replace(/\d+$/, "");
}

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

async function openFilters(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name: filters.trigger }));
  return screen.findByRole("dialog", { name: filters.title });
}

function page(items: unknown[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length };
}

function renderFilters(state: CharactersCatalogState = appliedState) {
  const onApply = vi.fn();
  renderWithProviders(
    <CharactersCatalogFilters
      activeCount={0}
      onApply={onApply}
      speciesNames={{ isPending: false, remember: vi.fn(), resolve: () => undefined }}
      state={state}
    />,
  );
  return { onApply };
}

function requestsTo(pathname: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === pathname);
}

async function searchSeries() {
  await userEvent.click(
    screen.getByRole("button", { name: `${filters.series} ${filters.anySeries}` }),
  );
  await userEvent.type(screen.getByRole("combobox", { name: filters.series }), DUNE_SEARCH);
}

function seriesSearchTerms(): Array<null | string> {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/series")
    .map((url) => url.searchParams.get("search"));
}

function sheetAnnouncements(sheet: HTMLElement): string[] {
  return within(sheet)
    .getAllByRole("status")
    .map((status) => status.textContent ?? "")
    .filter((text) => text !== "");
}

beforeEach(() => {
  respondToBooks = () => jsonResponse(page([]));
  respondToFacets = () => jsonResponse(emptyFacets);
  respondToSeries = (term) =>
    jsonResponse(page(term === DUNE_SEARCH ? [series.dune] : [series.empyrean]));
  respondToSpecies = () => jsonResponse({ items: [] });
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/series") return respondToSeries(url.searchParams.get("search"));
    const detailed = Object.values(series).find(
      (item) => url.pathname === `/api/series/${item.id}`,
    );
    if (detailed !== undefined) {
      return jsonResponse(makeSeriesDetailsView({ id: detailed.id, name: detailed.name }));
    }
    if (url.pathname === "/api/books") return respondToBooks();
    if (url.pathname === "/api/tags") return jsonResponse(page([]));
    if (url.pathname === "/api/species") return respondToSpecies();
    if (url.pathname === "/api/characters/facets") return respondToFacets();
    if (url.pathname === "/api/character-groups") return jsonResponse(page([]));
    return Promise.reject(new Error(`unexpected ${url.pathname}${url.search}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharactersCatalogFilters sections", () => {
  it("gives every filter its own titled section", async () => {
    renderFilters();
    const sheet = await openFilters();

    const titles = [
      filters.series,
      filters.book,
      filters.importance,
      filters.role,
      filters.gender,
      filters.species,
      filters.attitude,
      filters.tags,
      filters.groups,
      filters.spoilers,
    ];
    const shownAsTitles = titles.filter((title) =>
      within(sheet)
        .queryAllByText(title)
        .some((node) => node.closest("button, label") === null),
    );

    expect(shownAsTitles).toEqual(titles);
  });
});

describe("CharactersCatalogFilters attitude", () => {
  it("offers the six attitudes without a favorite one, which the heart already marks", async () => {
    renderFilters();
    await openFilters();

    const attitudes = screen.getByRole("toolbar", { name: filters.attitude });
    const offered = within(attitudes).getAllByRole("button").map(chipLabel);

    expect(offered).toEqual([
      attitude.like,
      attitude.neutral,
      attitude.distrust,
      attitude.dislike,
      attitude.hate,
      attitude.unsure,
    ]);
  });
});

describe("CharactersCatalogFilters footer", () => {
  it("keeps the clear action disabled while the draft is empty", async () => {
    renderFilters();
    const sheet = await openFilters();

    expect(within(sheet).getByRole("button", { name: filters.clear })).toBeDisabled();
  });

  it("clears the draft without applying it or closing the sheet", async () => {
    const { onApply } = renderFilters();
    const sheet = await openFilters();
    const central = centralImportanceChip();

    await userEvent.click(central);
    expect(central).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(sheet).getByRole("button", { name: filters.clear }));

    expect(central).toHaveAttribute("aria-pressed", "false");
    expect(within(sheet).getByRole("button", { name: filters.clear })).toBeDisabled();
    expect(screen.getByRole("dialog", { name: filters.title })).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("applies the whole draft and closes the sheet", async () => {
    const { onApply } = renderFilters();
    const sheet = await openFilters();

    await userEvent.click(centralImportanceChip());
    await userEvent.click(within(sheet).getByRole("button", { name: filters.apply }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ ...noFilters, importance: ["central"] });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("drops an unapplied draft once the sheet is closed", async () => {
    const { onApply } = renderFilters();
    await openFilters();

    await userEvent.click(centralImportanceChip());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openFilters();

    expect(centralImportanceChip()).toHaveAttribute("aria-pressed", "false");
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("CharactersCatalogFilters series", () => {
  it("asks the series endpoint for the typed name and lists what it finds", async () => {
    renderFilters();
    await openFilters();

    await searchSeries();

    await waitFor(() => expect(seriesSearchTerms()).toContain(DUNE_SEARCH));
    expect(await screen.findByRole("option", { name: /Хроніки Дюни/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Емпіреї/ })).not.toBeInTheDocument();
  });

  it("shows the picked series on the trigger", async () => {
    renderFilters();
    const sheet = await openFilters();

    await searchSeries();
    await userEvent.click(await screen.findByRole("option", { name: /Хроніки Дюни/ }));

    expect(
      within(sheet).getByRole("button", { name: `${filters.series} ${series.dune.name}` }),
    ).toBeInTheDocument();
  });

  it("applies the picked series", async () => {
    const { onApply } = renderFilters();
    const sheet = await openFilters();

    await searchSeries();
    await userEvent.click(await screen.findByRole("option", { name: /Хроніки Дюни/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: filters.apply }));

    expect(onApply).toHaveBeenCalledWith({ ...noFilters, seriesId: series.dune.id });
  });

  it("marks the picked series as checked once the picker is reopened", async () => {
    renderFilters();
    const sheet = await openFilters();

    await searchSeries();
    const dune = await screen.findByRole("option", { name: /Хроніки Дюни/ });
    expect(dune).toHaveAttribute("aria-checked", "false");

    await userEvent.click(dune);
    await userEvent.click(
      within(sheet).getByRole("button", { name: `${filters.series} ${series.dune.name}` }),
    );
    await userEvent.type(screen.getByRole("combobox", { name: filters.series }), DUNE_SEARCH);

    expect(await screen.findByRole("option", { name: /Хроніки Дюни/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("returns focus to the series picker once the series is cleared", async () => {
    renderFilters({ ...appliedState, seriesId: series.dune.id });
    const sheet = await openFilters();

    await userEvent.click(within(sheet).getByRole("button", { name: filters.clearSeries }));

    expect(
      within(sheet).getByRole("button", { name: `${filters.series} ${filters.anySeries}` }),
    ).toHaveFocus();
  });
});

describe("CharactersCatalogFilters picker requests", () => {
  it("asks for no series, books or species when the sheet opens", async () => {
    renderFilters();
    await openFilters();

    await waitFor(() => expect(requestsTo("/api/character-groups").length).toBeGreaterThan(0));
    expect(requestsTo("/api/series")).toHaveLength(0);
    expect(requestsTo("/api/books")).toHaveLength(0);
    expect(requestsTo("/api/species")).toHaveLength(0);
  });

  it("asks for the series list once, when the series picker opens", async () => {
    renderFilters();
    await openFilters();

    await userEvent.click(
      screen.getByRole("button", { name: `${filters.series} ${filters.anySeries}` }),
    );

    expect(await screen.findByRole("option", { name: /Емпіреї/ })).toBeInTheDocument();
    expect(requestsTo("/api/series")).toHaveLength(1);
    expect(requestsTo("/api/books")).toHaveLength(0);
    expect(requestsTo("/api/species")).toHaveLength(0);
  });

  it("asks for the book list once, when the book picker opens", async () => {
    renderFilters();
    await openFilters();

    await userEvent.click(
      screen.getByRole("button", { name: `${filters.book} ${filters.anyBook}` }),
    );

    await waitFor(() => expect(requestsTo("/api/books")).toHaveLength(1));
    const books = await screen.findByRole("listbox", { name: filters.book });
    expect(await within(books).findByText(filters.bookEmpty)).toBeInTheDocument();
    expect(requestsTo("/api/books")).toHaveLength(1);
    expect(requestsTo("/api/series")).toHaveLength(0);
    expect(requestsTo("/api/species")).toHaveLength(0);
  });

  it("asks for the species list in the uk locale once, when the species picker opens", async () => {
    renderFilters();
    await openFilters();

    await userEvent.click(
      screen.getByRole("button", { name: `${filters.species} ${filters.speciesPlaceholder}` }),
    );

    await waitFor(() =>
      expect(requestsTo("/api/species").map((url) => url.search)).toEqual(["?locale=uk"]),
    );
    const species = await screen.findByRole("listbox", { name: filters.species });
    expect(await within(species).findByText(filters.speciesEmpty)).toBeInTheDocument();
    expect(requestsTo("/api/species")).toHaveLength(1);
    expect(requestsTo("/api/series")).toHaveLength(0);
    expect(requestsTo("/api/books")).toHaveLength(0);
  });
});

describe("CharactersCatalogFilters picker announcements", () => {
  it("announces the book search while the first book list is on its way", async () => {
    respondToBooks = () => new Promise<Response>(() => {});
    renderFilters();
    const sheet = await openFilters();

    await userEvent.click(
      within(sheet).getByRole("button", { name: `${filters.book} ${filters.anyBook}` }),
    );

    await waitFor(() => expect(sheetAnnouncements(sheet)).toEqual([filters.bookSearching]));
  });

  it("announces that no book was found once the book list comes back empty", async () => {
    renderFilters();
    const sheet = await openFilters();

    await userEvent.click(
      within(sheet).getByRole("button", { name: `${filters.book} ${filters.anyBook}` }),
    );

    await waitFor(() => expect(sheetAnnouncements(sheet)).toEqual([filters.bookEmpty]));
  });

  it("announces the series search while the first series list is on its way", async () => {
    respondToSeries = () => new Promise<Response>(() => {});
    renderFilters();
    const sheet = await openFilters();

    await userEvent.click(
      within(sheet).getByRole("button", { name: `${filters.series} ${filters.anySeries}` }),
    );

    await waitFor(() => expect(sheetAnnouncements(sheet)).toEqual([filters.seriesSearching]));
  });

  it("announces that no series was found once the series list comes back empty", async () => {
    respondToSeries = () => jsonResponse(page([]));
    renderFilters();
    const sheet = await openFilters();

    await userEvent.click(
      within(sheet).getByRole("button", { name: `${filters.series} ${filters.anySeries}` }),
    );

    await waitFor(() => expect(sheetAnnouncements(sheet)).toEqual([filters.seriesEmpty]));
  });
});

describe("CharactersCatalogFilters facet counts", () => {
  it("shows on an importance chip how many characters it would match", async () => {
    respondToFacets = () =>
      jsonResponse({ ...emptyFacets, importance: [{ count: 12, value: "central" }] });
    renderFilters();
    await openFilters();

    expect(
      await within(chipIn(filters.importance, importance.central)).findByText("12"),
    ).toBeInTheDocument();
  });

  it("shows 0 on an importance the facets leave out", async () => {
    respondToFacets = () =>
      jsonResponse({ ...emptyFacets, importance: [{ count: 12, value: "central" }] });
    renderFilters();
    await openFilters();

    await within(chipIn(filters.importance, importance.central)).findByText("12");

    expect(within(chipIn(filters.importance, importance.major)).getByText("0")).toBeInTheDocument();
  });

  it("asks for draft facets with the applied search and quick filter, before Apply", async () => {
    const { onApply } = renderFilters({
      ...appliedState,
      filter: "favorites",
      importance: ["central"],
      q: "Ґер",
    });
    await openFilters();
    await waitFor(() => expect(requestsTo("/api/characters/facets")).toHaveLength(1));

    await userEvent.click(chipIn(filters.gender, gender.female));

    await waitFor(() => expect(requestsTo("/api/characters/facets")).toHaveLength(2));
    const draftParams = [...(requestsTo("/api/characters/facets").at(-1)?.searchParams ?? [])];
    expect(draftParams.sort(([left], [right]) => left.localeCompare(right))).toEqual([
      ["favorite", "true"],
      ["gender", "female"],
      ["importance", "central"],
      ["q", "Ґер"],
    ]);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows on a species option how many characters it would match", async () => {
    respondToFacets = () =>
      jsonResponse({ ...emptyFacets, species: [{ count: 3, value: elf.id }] });
    respondToSpecies = () => jsonResponse({ items: [elf] });
    renderFilters();
    await openFilters();

    await userEvent.click(
      screen.getByRole("button", { name: `${filters.species} ${filters.speciesPlaceholder}` }),
    );

    const option = await screen.findByRole("option", { name: new RegExp(`^${elf.name}`) });
    expect(await within(option).findByText("3")).toBeInTheDocument();
  });
});

describe("CharactersCatalogFilters spoilers", () => {
  it("applies the chosen spoiler filter", async () => {
    const { onApply } = renderFilters();
    const sheet = await openFilters();

    await userEvent.click(within(sheet).getByRole("combobox", { name: filters.spoilers }));
    await userEvent.click(
      await screen.findByRole("option", { name: filters.spoilerOptions.without }),
    );
    await userEvent.click(within(sheet).getByRole("button", { name: filters.apply }));

    expect(onApply).toHaveBeenCalledWith({ ...noFilters, spoilers: "without" });
  });
});
