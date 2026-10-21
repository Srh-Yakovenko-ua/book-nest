import "@testing-library/jest-dom/vitest";

import type { CharacterRelationshipListItemView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import {
  makeCharacterPage,
  makeEditableRelationship,
  makeRelationshipGraph,
  makeRelationshipListItem,
  makeRelationshipPage,
  makeRosterCharacter,
  RELATIONSHIP_FIXTURE,
} from "@/features/character-relationships/model/relationships.fixtures";
import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeBookCharacterSummary } from "../model/characters.fixtures";
import { BookCharactersPanel } from "./book-characters-panel";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type PanelRender = {
  onUrlUpdate?: OnUrlUpdateFunction;
  search?: string;
};

const copy = messages.relationships;
const editor = copy.editor;
const viewModes = messages.characters.viewModes;

const { book: BOOK, ciri: CIRI, geralt: GERALT } = RELATIONSHIP_FIXTURE;

const READING_BOOK = makeBookView({
  id: BOOK.id,
  readingProgress: {
    abandonedAt: null,
    currentPage: 120,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
  },
  readingStatus: "reading",
  title: BOOK.title,
});

const API = {
  graph: `/api/books/${BOOK.id}/character-graph`,
  layout: "/api/character-graph-layouts",
  relationships: "/api/character-relationships",
  roster: `/api/books/${BOOK.id}/characters`,
  summary: `/api/books/${BOOK.id}/character-summary`,
} as const;

const RELATIONSHIP = makeRelationshipListItem();

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

mockIntersectionObserver();

function createBodies(): unknown[] {
  return fetchMock.mock.calls.flatMap(([input, init]) => {
    const url = new URL(String(input), "http://localhost");
    if (init?.method !== "POST" || url.pathname !== API.relationships) return [];
    const body: unknown = JSON.parse(String(init.body));
    return [body];
  });
}

function endingWith(text: string): RegExp {
  return new RegExp(`${text}$`);
}

function getRequests(pathname: string): URL[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") === "GET")
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === pathname);
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function lastUrl(events: UrlUpdateEvent[]): URLSearchParams {
  const event = events.at(-1);
  if (event === undefined) throw new Error("no url update");
  return event.searchParams;
}

function modeSwitch(name: string): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: viewModes.label })).getByRole("radio", {
    name,
  });
}

function openLabel(item: CharacterRelationshipListItemView): string {
  return copy.card.open
    .replace("{source}", item.relationship.source.name)
    .replace("{target}", item.relationship.target.name);
}

async function pickParticipant({ name, slot }: { name: string; slot: string }) {
  await userEvent.click(screen.getByRole("combobox", { name: slot }));
  await userEvent.click(await screen.findByRole("option", { name: endingWith(name) }));
}

async function pickType(type: string) {
  await userEvent.click(screen.getByRole("combobox", { name: editor.type.label }));
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(`^${type}`) }));
}

function relationshipScopeParams() {
  return getRequests(API.relationships).map((url) => ({
    contextBookId: url.searchParams.get("contextBookId"),
    scope: url.searchParams.get("scope"),
    scopeId: url.searchParams.get("scopeId"),
  }));
}

function renderPanel({ onUrlUpdate, search = "?tab=characters" }: PanelRender = {}) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <BookCharactersPanel book={READING_BOOK} />
    </NuqsTestingAdapter>,
  );
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const route = `${init?.method ?? "GET"} ${url.pathname}`;
  switch (route) {
    case `GET ${API.graph}`:
      return json(makeRelationshipGraph({ edges: [] }));
    case `GET ${API.layout}`:
      return json({ message: "Layout not found" }, 404);
    case `GET ${API.relationships}`:
      return json(makeRelationshipPage([RELATIONSHIP]));
    case `GET ${API.roster}`:
      return json(makeCharacterPage([GERALT, CIRI].map(makeRosterCharacter)));
    case `GET ${API.summary}`:
      return json(makeBookCharacterSummary({ bookId: BOOK.id }));
    case `POST ${API.relationships}`:
      return json(makeEditableRelationship(), 201);
    default:
      return Promise.reject(new Error(`unexpected fetch: ${route}`));
  }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookCharactersPanel list mode", () => {
  it("opens on the book roster and asks for no relationships", async () => {
    renderPanel();

    expect(await screen.findByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(modeSwitch(viewModes.list)).toBeChecked();
    expect(getRequests(API.relationships)).toEqual([]);
  });
});

describe("BookCharactersPanel relationships mode", () => {
  it("records the relationships mode in the URL and keeps the characters tab", async () => {
    const events: UrlUpdateEvent[] = [];
    renderPanel({ onUrlUpdate: (event) => events.push(event) });

    await userEvent.click(modeSwitch(viewModes.relationships));

    await waitFor(() => expect(lastUrl(events).get("charactersView")).toBe("relationships"));
    expect(lastUrl(events).get("tab")).toBe("characters");
  });

  it("lists the relationships of this book without a reading-context book", async () => {
    renderPanel();

    await userEvent.click(modeSwitch(viewModes.relationships));

    expect(
      await screen.findByRole("button", { name: openLabel(RELATIONSHIP) }),
    ).toBeInTheDocument();
    expect(relationshipScopeParams()).toEqual([
      { contextBookId: null, scope: "book", scopeId: BOOK.id },
    ]);
  });

  it("drops the mode from the URL when the reader goes back to the list", async () => {
    const events: UrlUpdateEvent[] = [];
    renderPanel({
      onUrlUpdate: (event) => events.push(event),
      search: "?tab=characters&charactersView=relationships",
    });
    await screen.findByRole("button", { name: openLabel(RELATIONSHIP) });

    await userEvent.click(modeSwitch(viewModes.list));

    await waitFor(() => expect(lastUrl(events).has("charactersView")).toBe(false));
    expect(lastUrl(events).get("tab")).toBe("characters");
  });

  it("stays in the relationships mode when the toolbar clears every filter", async () => {
    const events: UrlUpdateEvent[] = [];
    renderPanel({
      onUrlUpdate: (event) => events.push(event),
      search: "?tab=characters&charactersView=relationships&relCat=family&relSort=newest",
    });

    await userEvent.click(await screen.findByRole("button", { name: copy.toolbar.clearAll }));

    await waitFor(() => expect(lastUrl(events).has("relSort")).toBe(false));
    expect(lastUrl(events).has("relCat")).toBe(false);
    expect(lastUrl(events).get("charactersView")).toBe("relationships");
    expect(lastUrl(events).get("tab")).toBe("characters");
    expect(modeSwitch(viewModes.relationships)).toBeChecked();
  });

  it("creates a relationship pinned to this book without asking for a book", async () => {
    renderPanel({ search: "?tab=characters&charactersView=relationships" });

    await userEvent.click(await screen.findByRole("button", { name: copy.toolbar.create }));
    const dialog = await screen.findByRole("dialog", { name: editor.createTitle });
    await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);
    await userEvent.click(within(dialog).getByRole("button", { name: editor.actions.next }));
    const create = await within(dialog).findByRole("button", { name: editor.actions.create });

    expect(
      within(dialog).getByRole("heading", { name: `${editor.steps.bookHeading} ${BOOK.title}` }),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("combobox", { name: editor.book.label }),
    ).not.toBeInTheDocument();

    await userEvent.click(create);

    await waitFor(() => expect(createBodies()).toHaveLength(1));
    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: BOOK.id })],
      }),
    ]);
  });
});

describe("BookCharactersPanel graph mode", () => {
  it("asks for the book graph only once the graph mode is chosen", async () => {
    renderPanel();
    await screen.findByRole("heading", { name: GERALT.name });

    expect(getRequests(API.graph)).toEqual([]);

    await userEvent.click(modeSwitch(viewModes.graph));

    expect(
      await screen.findByRole("heading", { name: copy.graph.empty.title }),
    ).toBeInTheDocument();
    expect(getRequests(API.graph)).toHaveLength(1);
  });
});
