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

const filters = messages.characters.catalog.filters;
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

function centralImportanceChip(): HTMLElement {
  return within(screen.getByRole("toolbar", { name: filters.importance })).getByRole("button", {
    name: importance.central,
  });
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
      speciesNames={{ remember: vi.fn(), resolve: () => undefined }}
      state={state}
    />,
  );
  return { onApply };
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

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/series") {
      const term = url.searchParams.get("search");
      return jsonResponse(page(term === DUNE_SEARCH ? [series.dune] : [series.empyrean]));
    }
    const detailed = Object.values(series).find(
      (item) => url.pathname === `/api/series/${item.id}`,
    );
    if (detailed !== undefined) {
      return jsonResponse(makeSeriesDetailsView({ id: detailed.id, name: detailed.name }));
    }
    if (url.pathname === "/api/books") return jsonResponse(page([]));
    if (url.pathname === "/api/tags") return jsonResponse(page([]));
    if (url.pathname === "/api/species") return jsonResponse({ items: [] });
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
