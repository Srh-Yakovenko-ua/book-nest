import "@testing-library/jest-dom/vitest";

import type {
  CharacterRelationshipListItemView,
  Nullable,
  SeriesBookView,
  SeriesDetailsView,
} from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { makeSeriesBookView, makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesCharactersTab } from "./series-characters-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type TabRender = {
  details?: SeriesDetailsView;
  onUrlUpdate?: OnUrlUpdateFunction;
  search?: string;
};

const copy = messages.relationships;
const editor = copy.editor;
const charactersCopy = messages.series.details.characters;
const viewModes = messages.characters.viewModes;

const { ciri: CIRI, geralt: GERALT } = RELATIONSHIP_FIXTURE;

const BOOKS = {
  first: makeSeriesBookView({
    id: "5e1b0a00-0000-4000-8000-000000000001",
    partNumber: 1,
    title: "Четверте крило",
  }),
  second: makeSeriesBookView({
    id: "5e1b0a00-0000-4000-8000-000000000002",
    partNumber: 2,
    title: "Ковадло зірок",
  }),
  third: makeSeriesBookView({
    id: "5e1b0a00-0000-4000-8000-000000000003",
    partNumber: 3,
    title: "Оніксове полум'я",
  }),
} as const;

const SERIES = makeSeriesDetailsView({ books: [BOOKS.first, BOOKS.second, BOOKS.third] });

const API = {
  cast: `/api/series/${SERIES.id}/characters`,
  defaultContext: `/api/series/${SERIES.id}/reading-context/default`,
  graph: `/api/series/${SERIES.id}/character-graph`,
  layout: "/api/character-graph-layouts",
  relationships: "/api/character-relationships",
} as const;

const DEFAULT_CONTEXT = {
  contextBookId: BOOKS.second.id,
  partNumber: 2,
  source: "last_finished_book",
} as const;

const RELATIONSHIP = makeRelationshipListItem();

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToDefaultContext: () => Promise<Response>;

mockIntersectionObserver();

function castContextIds(): Nullable<string>[] {
  return getRequests(API.cast).map((url) => url.searchParams.get("contextBookId"));
}

async function chooseContextBook(book: SeriesBookView) {
  await userEvent.click(contextSelect());
  await userEvent.click(await screen.findByRole("option", { name: contextOption(book) }));
}

function contextOption(book: SeriesBookView): string {
  return charactersCopy.context.option
    .replace("{part}", String(book.partNumber))
    .replace("{title}", book.title);
}

function contextSelect(): HTMLElement {
  return screen.getByRole("combobox", { name: charactersCopy.context.label });
}

function createBodies(): unknown[] {
  return fetchMock.mock.calls.flatMap(([input, init]) => {
    const url = new URL(String(input), "http://localhost");
    if (init?.method !== "POST" || url.pathname !== API.relationships) return [];
    const body: unknown = JSON.parse(String(init.body));
    return [body];
  });
}

async function createForChosenBook(dialog: HTMLElement) {
  await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
  await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
  await pickType(copy.types.guardian_of);
  await userEvent.click(within(dialog).getByRole("button", { name: editor.actions.next }));
  await userEvent.click(await within(dialog).findByRole("button", { name: editor.actions.create }));
  await waitFor(() => expect(createBodies()).toHaveLength(1));
}

function endingWith(text: string): RegExp {
  return new RegExp(`${text}$`);
}

function getRequests(pathname: string): URL[] {
  return requestedUrls().filter((url) => url.pathname === pathname);
}

function graphRequests(): URL[] {
  return getRequests(API.graph);
}

function isBookRoster(route: string): boolean {
  return /^GET \/api\/books\/[^/]+\/characters$/.test(route);
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

async function openCreateDialog(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole("button", { name: copy.toolbar.create }));
  return screen.findByRole("dialog", { name: editor.createTitle });
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

function renderTab({ details = SERIES, onUrlUpdate, search = "?tab=characters" }: TabRender = {}) {
  const onAddBook = vi.fn<() => void>();
  renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <SeriesCharactersTab details={details} onAddBook={onAddBook} />
    </NuqsTestingAdapter>,
  );
  return { onAddBook };
}

function requestedUrls(): URL[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") === "GET")
    .map(([input]) => new URL(String(input), "http://localhost"));
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const route = `${init?.method ?? "GET"} ${url.pathname}`;
  switch (route) {
    case `GET ${API.cast}`:
      return json(makeCharacterPage([makeRosterCharacter(GERALT)]));
    case `GET ${API.defaultContext}`:
      return respondToDefaultContext();
    case `GET ${API.graph}`:
      return json(makeRelationshipGraph({ edges: [] }));
    case `GET ${API.layout}`:
      return json({ message: "Layout not found" }, 404);
    case `GET ${API.relationships}`:
      return json(makeRelationshipPage([RELATIONSHIP]));
    case `POST ${API.relationships}`:
      return json(makeEditableRelationship(), 201);
    default:
      return isBookRoster(route)
        ? json(makeCharacterPage([GERALT, CIRI].map(makeRosterCharacter)))
        : Promise.reject(new Error(`unexpected fetch: ${route}`));
  }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  respondToDefaultContext = () => json(DEFAULT_CONTEXT);
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SeriesCharactersTab reading context", () => {
  it("reads the cast as of the server's default book when the URL names none", async () => {
    renderTab();

    expect(await screen.findByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(getRequests(API.defaultContext)).toHaveLength(1);
    expect(castContextIds()).toEqual([BOOKS.second.id]);
    expect(contextSelect()).toHaveTextContent(contextOption(BOOKS.second));
  });

  it("never asks for characters from later parts", async () => {
    renderTab();
    await screen.findByRole("heading", { name: GERALT.name });

    expect(requestedUrls().filter((url) => url.searchParams.has("includeFuture"))).toEqual([]);
  });

  it("starts from the first book when the server knows no reading position", async () => {
    respondToDefaultContext = () => json({ contextBookId: null, partNumber: null, source: "none" });

    renderTab();

    expect(await screen.findByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(castContextIds()).toEqual([BOOKS.first.id]);
  });

  it("skips the server default when the URL names a book of the series", async () => {
    renderTab({ search: `?tab=characters&charactersBookId=${BOOKS.third.id}` });

    expect(await screen.findByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(castContextIds()).toEqual([BOOKS.third.id]);
    expect(getRequests(API.defaultContext)).toEqual([]);
  });

  it("falls back to the server default when the URL names a book outside the series", async () => {
    renderTab({ search: "?tab=characters&charactersBookId=not-in-this-series" });

    expect(await screen.findByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(getRequests(API.defaultContext)).toHaveLength(1);
    expect(castContextIds()).toEqual([BOOKS.second.id]);
    expect(contextSelect()).toHaveTextContent(contextOption(BOOKS.second));
  });

  it("offers a retry when the reading context cannot be resolved", async () => {
    const replies = [json({ message: "boom" }, 500)];
    respondToDefaultContext = () => replies.shift() ?? json(DEFAULT_CONTEXT);

    renderTab();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(charactersCopy.context.error);

    await userEvent.click(
      within(alert).getByRole("button", { name: messages.characters.states.retry }),
    );

    expect(await screen.findByRole("heading", { name: GERALT.name })).toBeInTheDocument();
    expect(castContextIds()).toEqual([BOOKS.second.id]);
  });
});

describe("SeriesCharactersTab switching books", () => {
  it("re-reads the cast as of the book the reader picks and keeps it in the URL", async () => {
    const events: UrlUpdateEvent[] = [];
    renderTab({ onUrlUpdate: (event) => events.push(event) });
    await screen.findByRole("heading", { name: GERALT.name });

    await chooseContextBook(BOOKS.third);

    await waitFor(() => expect(lastUrl(events).get("charactersBookId")).toBe(BOOKS.third.id));
    expect(lastUrl(events).get("tab")).toBe("characters");
    await waitFor(() => expect(castContextIds()).toEqual([BOOKS.second.id, BOOKS.third.id]));
  });

  it("re-reads the relationships as of the book the reader picks", async () => {
    renderTab({ search: "?tab=characters&charactersView=relationships" });
    await screen.findByRole("button", { name: openLabel(RELATIONSHIP) });

    await chooseContextBook(BOOKS.third);

    await waitFor(() =>
      expect(relationshipScopeParams().map(({ contextBookId }) => contextBookId)).toEqual([
        BOOKS.second.id,
        BOOKS.third.id,
      ]),
    );
  });

  it("starts the graph unfocused again after the reader switches books", async () => {
    const focus = copy.graph.controls.focus;
    renderTab({ search: "?tab=characters&charactersView=graph" });
    await screen.findByRole("heading", { name: copy.graph.empty.title });
    await userEvent.click(screen.getByRole("combobox", { name: focus.label }));
    await userEvent.click(await screen.findByRole("option", { name: GERALT.name }));
    await waitFor(() =>
      expect(graphRequests().at(-1)?.searchParams.get("focusCharacterId")).toBe(GERALT.id),
    );

    await chooseContextBook(BOOKS.third);

    await waitFor(() =>
      expect(graphRequests().at(-1)?.searchParams.get("contextBookId")).toBe(BOOKS.third.id),
    );
    expect(graphRequests().at(-1)?.searchParams.has("focusCharacterId")).toBe(false);
    expect(screen.getByRole("combobox", { name: focus.label })).toHaveTextContent(focus.none);
  });
});

describe("SeriesCharactersTab relationships", () => {
  it("lists the series relationships as of the selected book", async () => {
    renderTab({ search: `?tab=characters&charactersBookId=${BOOKS.second.id}` });
    await screen.findByRole("heading", { name: GERALT.name });

    await userEvent.click(modeSwitch(viewModes.relationships));

    expect(
      await screen.findByRole("button", { name: openLabel(RELATIONSHIP) }),
    ).toBeInTheDocument();
    expect(relationshipScopeParams()).toEqual([
      { contextBookId: BOOKS.second.id, scope: "series", scopeId: SERIES.id },
    ]);
  });

  it("R04 R49 offers every series book when creating while the list stays as of the selected one", async () => {
    renderTab({
      search: `?tab=characters&charactersView=relationships&charactersBookId=${BOOKS.second.id}`,
    });
    const dialog = await openCreateDialog();

    await userEvent.click(within(dialog).getByRole("combobox", { name: editor.book.label }));

    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([BOOKS.first.title, BOOKS.second.title, BOOKS.third.title]);
    expect(relationshipScopeParams()).toEqual([
      { contextBookId: BOOKS.second.id, scope: "series", scopeId: SERIES.id },
    ]);
  });

  it("R04 R49 creates the relationship for the selected book by default", async () => {
    renderTab({
      search: `?tab=characters&charactersView=relationships&charactersBookId=${BOOKS.second.id}`,
    });
    const dialog = await openCreateDialog();

    expect(within(dialog).getByRole("combobox", { name: editor.book.label })).toHaveTextContent(
      BOOKS.second.title,
    );
    await createForChosenBook(dialog);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: BOOKS.second.id })],
      }),
    ]);
  });

  it("R04 R49 creates the relationship for a series book after the selected one", async () => {
    renderTab({
      search: `?tab=characters&charactersView=relationships&charactersBookId=${BOOKS.second.id}`,
    });
    const dialog = await openCreateDialog();

    await userEvent.click(within(dialog).getByRole("combobox", { name: editor.book.label }));
    await userEvent.click(await screen.findByRole("option", { name: BOOKS.third.title }));
    await createForChosenBook(dialog);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: BOOKS.third.id })],
      }),
    ]);
    expect(getRequests(`/api/books/${BOOKS.third.id}/characters`).length).toBeGreaterThan(0);
  });
});

describe("SeriesCharactersTab without books", () => {
  const EMPTY_SERIES = makeSeriesDetailsView({ books: [] });

  it("shows the no-books state without asking the server for anything", async () => {
    renderTab({
      details: EMPTY_SERIES,
      search: `?tab=characters&charactersView=relationships&charactersBookId=${BOOKS.first.id}`,
    });

    expect(screen.getByRole("heading", { name: charactersCopy.noBooks.title })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: viewModes.label })).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers to add the first book of the series", async () => {
    const { onAddBook } = renderTab({ details: EMPTY_SERIES });

    await userEvent.click(
      screen.getByRole("button", { name: messages.series.details.booksEmpty.action }),
    );

    expect(onAddBook).toHaveBeenCalledOnce();
  });
});
