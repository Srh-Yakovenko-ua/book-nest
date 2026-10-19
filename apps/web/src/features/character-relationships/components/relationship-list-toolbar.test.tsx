import "@testing-library/jest-dom/vitest";

import type { Nullable } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipBookOption } from "../model/relationship-adapter";
import type { RelationshipScope } from "../model/relationship-scope";

import {
  makeRelationshipListItem,
  makeRelationshipPage,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipList } from "./relationship-list";

type ListRender = {
  bookOptions?: readonly RelationshipBookOption[];
  onUrlUpdate?: OnUrlUpdateFunction;
  scope?: RelationshipScope;
  search?: string;
};

type ScopeCase = {
  expectedBookId: Nullable<string>;
  name: string;
  scope: RelationshipScope;
};

const copy = messages.relationships;

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const FILTERED_BOOK_ID = "7b7b7b7b-0000-4000-8000-000000000004";
const CHARACTER_ID = RELATIONSHIP_FIXTURE.geralt.id;

const SCOPES = {
  book: { bookId: BOOK_ID, kind: "book" },
  characterGlobal: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
  characterInBook: { characterId: CHARACTER_ID, contextBookId: BOOK_ID, kind: "character" },
  series: {
    contextBookId: BOOK_ID,
    kind: "series",
    seriesId: "5a5a5a5a-0000-4000-8000-000000000003",
  },
} as const satisfies Record<string, RelationshipScope>;

const BOOK_OPTIONS: readonly RelationshipBookOption[] = [
  { id: FILTERED_BOOK_ID, title: "Меч призначення" },
];

const SEARCH_HINT = copy.toolbar.searchTooShort.replace("{min}", "2");

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function categoryChip(name: string): HTMLElement {
  return within(screen.getByRole("toolbar", { name: copy.toolbar.categoriesLabel })).getByRole(
    "button",
    { name },
  );
}

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function lastListRequest(): URLSearchParams {
  const request = listRequests().at(-1);
  if (request === undefined) throw new Error("no relationship list request");
  return request.searchParams;
}

function lastUrl(events: UrlUpdateEvent[]): URLSearchParams {
  const event = events.at(-1);
  if (event === undefined) throw new Error("no url update");
  return event.searchParams;
}

function listRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/character-relationships");
}

async function openFilters(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name: copy.filters.trigger }));
  return screen.findByRole("dialog", { name: copy.filters.title });
}

function renderList({
  bookOptions,
  onUrlUpdate,
  scope = SCOPES.book,
  search = "",
}: ListRender = {}) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <RelationshipList bookOptions={bookOptions} scope={scope} />
    </NuqsTestingAdapter>,
  );
}

async function waitForFirstRequest() {
  await waitFor(() => expect(listRequests()).toHaveLength(1));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/api/character-relationships") {
      return json(makeRelationshipPage([makeRelationshipListItem()]));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipList URL criteria", () => {
  it("requests the criteria named by the rel keys of the URL", async () => {
    renderList({
      search:
        "?relQ=Цірі&relCat=family,romantic&relType=guardian_of&relStatus=active,ended&relIntensity=high&relCanon=true&relSort=newest",
    });

    await waitForFirstRequest();
    const request = lastListRequest();
    expect(request.get("q")).toBe("Цірі");
    expect(request.getAll("categories")).toEqual(["family", "romantic"]);
    expect(request.getAll("relationshipTypes")).toEqual(["guardian_of"]);
    expect(request.getAll("statuses")).toEqual(["active", "ended"]);
    expect(request.getAll("intensities")).toEqual(["high"]);
    expect(request.get("isCanonical")).toBe("true");
    expect(request.get("sort")).toBe("newest");
  });

  it("ignores rel values it does not know and falls back to the defaults", async () => {
    renderList({
      search:
        "?relCat=family,dragons&relType=dragon_rider_of&relStatus=dead&relIntensity=extreme&relCanon=maybe&relSort=sideways",
    });

    await waitForFirstRequest();
    const request = lastListRequest();
    expect(request.getAll("categories")).toEqual(["family"]);
    expect(request.has("relationshipTypes")).toBe(false);
    expect(request.has("statuses")).toBe(false);
    expect(request.has("intensities")).toBe(false);
    expect(request.has("isCanonical")).toBe(false);
    expect(request.get("sort")).toBe("name_asc");
  });

  it("writes a toggled category and drops the key once it is untoggled", async () => {
    const events: UrlUpdateEvent[] = [];
    renderList({ onUrlUpdate: (event) => events.push(event) });
    await waitForFirstRequest();

    await userEvent.click(categoryChip(copy.categories.family));

    await waitFor(() => expect(lastUrl(events).get("relCat")).toBe("family"));
    expect(Array.from(lastUrl(events).keys())).toEqual(["relCat"]);

    await userEvent.click(categoryChip(copy.categories.family));

    await waitFor(() => expect(lastUrl(events).has("relCat")).toBe(false));
    expect(Array.from(lastUrl(events).keys())).toEqual([]);
  });

  it("writes a chosen sort and omits it again once the default is chosen", async () => {
    const events: UrlUpdateEvent[] = [];
    renderList({ onUrlUpdate: (event) => events.push(event) });
    await waitForFirstRequest();

    await userEvent.click(screen.getByRole("combobox", { name: copy.sort.label }));
    await userEvent.click(await screen.findByRole("option", { name: copy.sort.options.newest }));

    await waitFor(() => expect(lastUrl(events).get("relSort")).toBe("newest"));
    await waitFor(() => expect(lastListRequest().get("sort")).toBe("newest"));

    await userEvent.click(screen.getByRole("combobox", { name: copy.sort.label }));
    await userEvent.click(await screen.findByRole("option", { name: copy.sort.options.name_asc }));

    await waitFor(() => expect(lastUrl(events).has("relSort")).toBe(false));
  });

  it("clears every rel key and keeps the page's own params", async () => {
    const events: UrlUpdateEvent[] = [];
    renderList({
      onUrlUpdate: (event) => events.push(event),
      search: "?tab=relationships&relQ=Цірі&relCat=family&relSort=newest&relCanon=true",
    });
    await waitForFirstRequest();

    await userEvent.click(screen.getByRole("button", { name: copy.toolbar.clearAll }));

    await waitFor(() => expect(Array.from(lastUrl(events).keys())).toEqual(["tab"]));
    await waitFor(() => expect(lastListRequest().get("sort")).toBe("name_asc"));
    expect(lastListRequest().has("q")).toBe(false);
    expect(lastListRequest().has("categories")).toBe(false);
    expect(lastListRequest().has("isCanonical")).toBe(false);
  });

  it("applies the advanced filters chosen in the sheet", async () => {
    const events: UrlUpdateEvent[] = [];
    renderList({ onUrlUpdate: (event) => events.push(event) });
    await waitForFirstRequest();

    const sheet = within(await openFilters());
    await userEvent.click(
      within(sheet.getByRole("toolbar", { name: copy.filters.statuses })).getByRole("button", {
        name: copy.statuses.ended,
      }),
    );
    await userEvent.click(sheet.getByRole("radio", { name: copy.filters.canonical.nonCanonical }));
    await userEvent.click(sheet.getByRole("button", { name: copy.filters.apply }));

    await waitFor(() => expect(lastUrl(events).get("relStatus")).toBe("ended"));
    expect(lastUrl(events).get("relCanon")).toBe("false");
    expect(Array.from(lastUrl(events).keys()).sort()).toEqual(["relCanon", "relStatus"]);
    await waitFor(() => expect(lastListRequest().getAll("statuses")).toEqual(["ended"]));
    expect(lastListRequest().get("isCanonical")).toBe("false");
  });
});

describe("RelationshipList book filter", () => {
  it.each<ScopeCase>([
    {
      expectedBookId: FILTERED_BOOK_ID,
      name: "applies the book of the URL in the global character view",
      scope: SCOPES.characterGlobal,
    },
    {
      expectedBookId: null,
      name: "ignores the book of the URL for a character inside a book",
      scope: SCOPES.characterInBook,
    },
    {
      expectedBookId: null,
      name: "ignores the book of the URL in a book list",
      scope: SCOPES.book,
    },
    {
      expectedBookId: null,
      name: "ignores the book of the URL in a series list",
      scope: SCOPES.series,
    },
  ])("$name", async ({ expectedBookId, scope }) => {
    renderList({ scope, search: `?relBook=${FILTERED_BOOK_ID}` });

    await waitForFirstRequest();
    expect(lastListRequest().get("bookId")).toBe(expectedBookId);
  });

  it("ignores a book value that is not a book id", async () => {
    renderList({ scope: SCOPES.characterGlobal, search: "?relBook=book-2" });

    await waitForFirstRequest();
    expect(lastListRequest().has("bookId")).toBe(false);
  });

  it("offers the book filter in the global character view", async () => {
    renderList({ bookOptions: BOOK_OPTIONS, scope: SCOPES.characterGlobal });
    await waitForFirstRequest();

    const sheet = within(await openFilters());

    expect(sheet.getByRole("combobox", { name: copy.filters.book.label })).toBeInTheDocument();
  });

  it("offers no book filter for a character inside a book", async () => {
    renderList({ bookOptions: BOOK_OPTIONS, scope: SCOPES.characterInBook });
    await waitForFirstRequest();

    const sheet = within(await openFilters());

    expect(sheet.getByRole("button", { name: copy.filters.apply })).toBeInTheDocument();
    expect(
      sheet.queryByRole("combobox", { name: copy.filters.book.label }),
    ).not.toBeInTheDocument();
  });
});

describe("RelationshipList search", () => {
  it("shows the hint and requests nothing new for a single character", async () => {
    renderList();
    await waitForFirstRequest();

    await userEvent.type(screen.getByRole("textbox", { name: copy.toolbar.searchLabel }), "Ц");

    expect(await screen.findByText(SEARCH_HINT)).toBeInTheDocument();
    expect(listRequests()).toHaveLength(1);
    expect(listRequests().some((url) => url.searchParams.has("q"))).toBe(false);
  });

  it("sends a search of two characters once its spaces are trimmed", async () => {
    renderList();
    await waitForFirstRequest();

    await userEvent.type(screen.getByRole("textbox", { name: copy.toolbar.searchLabel }), "  Ці  ");

    await waitFor(() => expect(lastListRequest().get("q")).toBe("Ці"));
    expect(screen.queryByText(SEARCH_HINT)).not.toBeInTheDocument();
  });

  it("collapses the inner spaces of a search taken from the URL", async () => {
    renderList({ search: "?relQ=%20Ці%20%20%20рі%20" });

    await waitForFirstRequest();
    expect(lastListRequest().get("q")).toBe("Ці рі");
  });

  it.each([
    { expected: "я".repeat(100), length: 100, name: "sends a search of 100 characters" },
    { expected: null, length: 101, name: "drops a search longer than 100 characters" },
  ])("$name", async ({ expected, length }) => {
    renderList({ search: `?relQ=${"я".repeat(length)}` });

    await waitForFirstRequest();
    expect(lastListRequest().get("q")).toBe(expected);
    expect(screen.queryByText(SEARCH_HINT)).not.toBeInTheDocument();
  });
});
