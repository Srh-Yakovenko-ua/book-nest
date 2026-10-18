import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import {
  type CharacterGraphLayoutView,
  type CharacterGraphPositions,
  type CharacterGraphView,
  type CharacterRelationshipPathView,
  type Nullable,
  type SaveCharacterGraphLayout,
  SaveCharacterGraphLayoutSchema,
} from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipGraphScope } from "../model/relationship-graph-scope";

import { computeRelationshipGraphAutoLayout } from "../model/relationship-graph-layout";
import {
  makeRelationshipDetails,
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipGraph } from "./relationship-graph";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

type EdgeParts = { label: string; source: string; target: string };

type RecordedRequest = { body: unknown; method: string; url: URL };

const copy = messages.relationships;
const graphCopy = copy.graph;

const { ciri: CIRI, geralt: GERALT, yennefer: YENNEFER } = RELATIONSHIP_FIXTURE;

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const CONTEXT_BOOK_ID = RELATIONSHIP_FIXTURE.secondBook.id;
const SERIES_ID = "5e5e5e5e-0000-4000-8000-000000000005";
const GHOST_CHARACTER_ID = "d0d0d0d0-0000-4000-8000-000000000006";

const SCOPES = {
  book: { bookId: BOOK_ID, kind: "book" },
  series: { contextBookId: CONTEXT_BOOK_ID, kind: "series", seriesId: SERIES_ID },
  seriesWithoutBook: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
} satisfies Record<string, RelationshipGraphScope>;

const API = {
  bookGraph: `/api/books/${BOOK_ID}/character-graph`,
  details: `/api/character-relationships/${RELATIONSHIP_FIXTURE.relationshipId}`,
  layout: "/api/character-graph-layouts",
  path: "/api/character-relationships/path",
  seriesGraph: `/api/series/${SERIES_ID}/character-graph`,
} as const;

const CANVAS = {
  measuredSize: { offsetHeight: 40, offsetWidth: 120 },
  originalSize: {
    offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
    offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
  },
  tabLimit: 40,
  wait: { timeout: 3000 },
};

const GUARDIAN_EDGE: EdgeParts = {
  label: copy.types.guardian_of,
  source: GERALT.name,
  target: CIRI.name,
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let graph: CharacterGraphView;
let path: CharacterRelationshipPathView;
let savedLayout: Nullable<CharacterGraphLayoutView>;

class MeasuringResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly observed = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect() {
    this.observed.clear();
  }

  observe(target: Element) {
    this.observed.add(target);
    queueMicrotask(() => {
      if (this.observed.has(target)) this.callback([this.measuredEntry(target)], this);
    });
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  private measuredEntry(target: Element): ResizeObserverEntry {
    const { offsetHeight: blockSize, offsetWidth: inlineSize } = CANVAS.measuredSize;
    const boxSize: ResizeObserverSize = { blockSize, inlineSize };
    return {
      borderBoxSize: [boxSize],
      contentBoxSize: [boxSize],
      contentRect: new DOMRect(0, 0, inlineSize, blockSize),
      devicePixelContentBoxSize: [boxSize],
      target,
    };
  }
}

async function choosePathEnd({ name, slot }: { name: string; slot: string }) {
  await userEvent.click(screen.getByRole("combobox", { name: slot }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

function edgeName(template: string, { label, source, target }: EdgeParts): string {
  return template.replace("{label}", label).replace("{source}", source).replace("{target}", target);
}

async function findDetailsParams(): Promise<Record<string, string>> {
  await waitFor(() => expect(requestsTo("GET", API.details)).toHaveLength(1));
  const [request] = requestsTo("GET", API.details);
  if (request === undefined) throw new Error("no relationship details request");
  return Object.fromEntries(request.url.searchParams);
}

function findEdgeLabel(edge: EdgeParts): Promise<HTMLElement> {
  return screen.findByRole("button", { name: edgeName(graphCopy.edge.open, edge) }, CANVAS.wait);
}

function findNode(name: string): Promise<HTMLElement> {
  return screen.findByRole("button", { name: nodeName(name) }, CANVAS.wait);
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function makeSavedLayout(positions: CharacterGraphPositions): CharacterGraphLayoutView {
  return {
    contextBookId: null,
    createdAt: RELATIONSHIP_FIXTURE.timestamp,
    id: "layout-1",
    layoutVersion: "graph-v1",
    mode: "all",
    positions,
    scopeId: BOOK_ID,
    scopeType: "book",
    updatedAt: RELATIONSHIP_FIXTURE.timestamp,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function nodeName(name: string): string {
  return graphCopy.node.open.replace("{name}", name);
}

function pathRegion(): HTMLElement {
  return screen.getByRole("region", { name: graphCopy.path.title });
}

function recordedRequests(): RecordedRequest[] {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    method: init?.method ?? "GET",
    url: new URL(String(input), "http://localhost"),
  }));
}

function renderGraph(scope: RelationshipGraphScope = SCOPES.book) {
  return renderWithProviders(<RelationshipGraph scope={scope} />);
}

function requestsTo(method: string, pathname: string): RecordedRequest[] {
  return recordedRequests().filter(
    (request) => request.method === method && request.url.pathname === pathname,
  );
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const route = `${init?.method ?? "GET"} ${url.pathname}`;
  switch (route) {
    case `DELETE ${API.layout}`:
      return Promise.resolve(new Response(null, { status: 204 }));
    case `GET ${API.bookGraph}`:
      return json(graph);
    case `GET ${API.details}`:
      return json(makeRelationshipDetails());
    case `GET ${API.layout}`:
      return savedLayout === null ? json({ message: "Layout not found" }, 404) : json(savedLayout);
    case `GET ${API.path}`:
      return json(path);
    case `GET ${API.seriesGraph}`:
      return json(graph);
    case `PUT ${API.layout}`:
      return json(makeSavedLayout({}));
    default:
      return Promise.reject(new Error(`unexpected fetch: ${route}`));
  }
}

function savedLayoutBodies(): SaveCharacterGraphLayout[] {
  return requestsTo("PUT", API.layout).map(({ body }) =>
    SaveCharacterGraphLayoutSchema.parse(body),
  );
}

async function tabTo(target: HTMLElement) {
  for (let presses = 0; presses < CANVAS.tabLimit; presses += 1) {
    await userEvent.tab();
    if (target.matches(":focus")) return;
  }
  throw new Error(`Tab never reached ${target.getAttribute("aria-label") ?? "the target"}`);
}

beforeAll(async () => {
  for (const [property, size] of Object.entries(CANVAS.measuredSize)) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get: () => size });
  }
  await import("./relationship-graph-canvas");
});

afterAll(() => {
  for (const [property, descriptor] of Object.entries(CANVAS.originalSize)) {
    if (descriptor !== undefined)
      Object.defineProperty(HTMLElement.prototype, property, descriptor);
  }
});

beforeEach(() => {
  graph = makeRelationshipGraph();
  path = {
    edges: [makeRelationshipGraphEdge()],
    found: true,
    fromId: GERALT.id,
    nodes: graph.nodes,
    toId: CIRI.id,
  };
  savedLayout = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipGraph edges", () => {
  it("labels an edge with a hidden type neutrally and never prints the type", async () => {
    const hiddenEdge = { ...GUARDIAN_EDGE, label: graphCopy.edge.hiddenType };
    graph = makeRelationshipGraph({
      edges: [
        makeRelationshipGraphEdge({
          category: null,
          directionality: null,
          type: "enemy_of",
          typeHidden: true,
        }),
      ],
    });
    renderGraph();

    expect(await findEdgeLabel(hiddenEdge)).toHaveTextContent(graphCopy.edge.hiddenType);
    expect(
      screen.getByRole("img", { name: edgeName(graphCopy.edge.description, hiddenEdge) }),
    ).toBeInTheDocument();
    expect(screen.queryByText(copy.types.enemy_of)).not.toBeInTheDocument();
  });

  it("draws an arrowhead only on a directed relationship", async () => {
    const friendEdge = { label: copy.types.friend_of, source: GERALT.name, target: YENNEFER.name };
    graph = makeRelationshipGraph({
      edges: [
        makeRelationshipGraphEdge(),
        makeRelationshipGraphEdge({
          category: "social",
          directionality: "symmetric",
          id: "rel-2",
          target: YENNEFER.id,
          type: "friend_of",
        }),
      ],
      nodes: [
        makeRelationshipGraphNode({ degree: 2 }),
        makeRelationshipGraphNode(CIRI),
        makeRelationshipGraphNode(YENNEFER),
      ],
    });
    renderGraph();
    await findEdgeLabel(friendEdge);

    const directed = screen.getByRole("img", {
      name: edgeName(graphCopy.edge.description, GUARDIAN_EDGE),
    });
    const symmetric = screen.getByRole("img", {
      name: edgeName(graphCopy.edge.description, friendEdge),
    });
    expect(directed.querySelector("polygon")).not.toBeNull();
    expect(symmetric.querySelector("polygon")).toBeNull();
  });
});

describe("RelationshipGraph notices", () => {
  it("warns that the graph stops at the visible limits when it is truncated", async () => {
    graph = makeRelationshipGraph({
      hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: true },
    });
    renderGraph();
    await screen.findByRole("group", { name: graphCopy.canvasLabel });

    expect(screen.getByRole("alert")).toHaveTextContent(
      graphCopy.notices.truncated.replace("{nodes}", "300").replace("{edges}", "600"),
    );
  });

  it("notes locked relationship types and nothing else", async () => {
    graph = makeRelationshipGraph({
      hiddenContent: { hasHiddenEdges: false, hasLockedEdges: true, truncated: false },
    });
    renderGraph();
    await screen.findByRole("group", { name: graphCopy.canvasLabel });

    expect(screen.getByRole("alert")).toHaveTextContent(graphCopy.notices.locked);
  });

  it("says nothing about relationships the reader cannot see at all", async () => {
    graph = makeRelationshipGraph({
      hiddenContent: { hasHiddenEdges: true, hasLockedEdges: false, truncated: false },
    });
    renderGraph();
    await screen.findByRole("group", { name: graphCopy.canvasLabel });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RelationshipGraph details and preview", () => {
  it("opens a clicked edge through the reader details endpoint in the book scope", async () => {
    renderGraph();
    await userEvent.click(await findEdgeLabel(GUARDIAN_EDGE));

    expect(await screen.findByRole("dialog", { name: copy.details.title })).toBeInTheDocument();
    expect(await findDetailsParams()).toEqual({ scope: "book", scopeId: BOOK_ID });
    expect(recordedRequests().filter(({ url }) => url.pathname.endsWith("/edit"))).toEqual([]);
  });

  it("opens edge details in the series scope and the chosen book's context", async () => {
    renderGraph(SCOPES.series);
    await userEvent.click(await findEdgeLabel(GUARDIAN_EDGE));

    expect(await findDetailsParams()).toEqual({
      contextBookId: CONTEXT_BOOK_ID,
      scope: "series",
      scopeId: SERIES_ID,
    });
  });

  it("previews an activated character of a book graph with a link into that book's context", async () => {
    renderGraph(SCOPES.book);
    await tabTo(await findNode(GERALT.name));
    await userEvent.keyboard("{Enter}");

    const preview = await screen.findByRole("complementary", { name: graphCopy.preview.label });
    expect(within(preview).getByRole("link", { name: graphCopy.preview.openPage })).toHaveAttribute(
      "href",
      `/characters/${GERALT.id}?bookId=${BOOK_ID}`,
    );
  });

  it("previews an activated character of a series graph with a link to the plain character page", async () => {
    renderGraph(SCOPES.series);
    await tabTo(await findNode(GERALT.name));
    await userEvent.keyboard("{Enter}");

    const preview = await screen.findByRole("complementary", { name: graphCopy.preview.label });
    expect(within(preview).getByRole("link", { name: graphCopy.preview.openPage })).toHaveAttribute(
      "href",
      `/characters/${GERALT.id}`,
    );
  });
});

describe("RelationshipGraph shortest path", () => {
  it("searches the path between both characters in the chosen book", async () => {
    renderGraph(SCOPES.series);
    await findNode(GERALT.name);

    await choosePathEnd({ name: GERALT.name, slot: graphCopy.path.from });
    await choosePathEnd({ name: CIRI.name, slot: graphCopy.path.to });

    await waitFor(() =>
      expect(
        requestsTo("GET", API.path).map(({ url }) => Object.fromEntries(url.searchParams)),
      ).toEqual([
        { contextBookId: CONTEXT_BOOK_ID, fromId: GERALT.id, mode: "all", toId: CIRI.id },
      ]),
    );
  });

  it("lists the characters of the found path in order", async () => {
    renderGraph();
    await findNode(GERALT.name);

    await choosePathEnd({ name: GERALT.name, slot: graphCopy.path.from });
    await choosePathEnd({ name: CIRI.name, slot: graphCopy.path.to });

    const steps = await within(pathRegion()).findByRole("list", { name: graphCopy.path.sequence });
    expect(
      within(steps)
        .getAllByRole("listitem")
        .map((step) => step.textContent),
    ).toEqual([GERALT.name, CIRI.name]);
  });

  it("tells the reader when the characters have no visible connection", async () => {
    path = { edges: [], found: false, fromId: GERALT.id, nodes: [], toId: CIRI.id };
    renderGraph();
    await findNode(GERALT.name);

    await choosePathEnd({ name: GERALT.name, slot: graphCopy.path.from });
    await choosePathEnd({ name: CIRI.name, slot: graphCopy.path.to });

    expect(await within(pathRegion()).findByText(graphCopy.path.notFound)).toBeInTheDocument();
  });

  it("offers no path search in a series without a chosen book", async () => {
    renderGraph(SCOPES.seriesWithoutBook);
    await findNode(GERALT.name);

    expect(within(pathRegion()).getByText(graphCopy.path.unavailable)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: graphCopy.path.from })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: graphCopy.path.to })).toBeDisabled();
    expect(requestsTo("GET", API.path)).toEqual([]);
  });
});

describe("RelationshipGraph layout", () => {
  it("restores and saves positions only for the characters currently on the graph", async () => {
    savedLayout = makeSavedLayout({
      [GERALT.id]: { x: 40, y: -20 },
      [GHOST_CHARACTER_ID]: { x: 999, y: 999 },
    });
    renderGraph();
    await findNode(GERALT.name);

    await userEvent.click(screen.getByRole("button", { name: graphCopy.layout.save }));

    await waitFor(() => expect(savedLayoutBodies()).toHaveLength(1));
    const [saved] = savedLayoutBodies();
    expect(Object.keys(saved?.positions ?? {}).sort()).toEqual([CIRI.id, GERALT.id].sort());
    expect(saved?.positions[GERALT.id]).toEqual({ x: 40, y: -20 });
  });

  it("saves the layout under the series and chosen book with no reveal data", async () => {
    renderGraph(SCOPES.series);
    await findNode(GERALT.name);

    await userEvent.click(screen.getByRole("button", { name: graphCopy.layout.save }));

    await waitFor(() =>
      expect(savedLayoutBodies()).toEqual([
        {
          contextBookId: CONTEXT_BOOK_ID,
          layoutVersion: graph.graphVersion,
          mode: "all",
          positions: expect.any(Object),
          scopeId: SERIES_ID,
          scopeType: "series",
          viewport: expect.any(Object),
        },
      ]),
    );
  });

  it("forgets the saved layout on the server when reset", async () => {
    savedLayout = makeSavedLayout({
      [CIRI.id]: { x: -900, y: -900 },
      [GERALT.id]: { x: 900, y: 900 },
    });
    renderGraph();
    await findNode(GERALT.name);

    await userEvent.click(screen.getByRole("button", { name: graphCopy.layout.reset }));

    await waitFor(() =>
      expect(
        requestsTo("DELETE", API.layout).map(({ url }) => Object.fromEntries(url.searchParams)),
      ).toEqual([{ mode: "all", scopeId: BOOK_ID, scopeType: "book" }]),
    );
  });

  it("moves every character back to the automatic layout on reset", async () => {
    savedLayout = makeSavedLayout({
      [CIRI.id]: { x: -900, y: -900 },
      [GERALT.id]: { x: 900, y: 900 },
    });
    renderGraph();
    await findNode(GERALT.name);

    await userEvent.click(screen.getByRole("button", { name: graphCopy.layout.reset }));
    await userEvent.click(screen.getByRole("button", { name: graphCopy.layout.save }));

    await waitFor(() => expect(savedLayoutBodies()).toHaveLength(1));
    expect(savedLayoutBodies()[0]?.positions).toEqual(
      computeRelationshipGraphAutoLayout({
        clusters: graph.clusters,
        focusCharacterId: null,
        nodes: graph.nodes,
      }),
    );
  });
});

describe("RelationshipGraph keyboard access", () => {
  it("reaches the controls, then the edge labels, then the nodes, in reading order", async () => {
    renderGraph();
    const edgeLabel = await findEdgeLabel(GUARDIAN_EDGE);
    const pathStart = screen.getByRole("combobox", { name: graphCopy.path.from });
    const stops = [
      screen.getByRole("radio", { name: graphCopy.controls.mode.all }),
      screen.getByRole("combobox", { name: graphCopy.controls.focus.label }),
      screen.getByRole("combobox", { name: graphCopy.controls.clusterBy.label }),
      edgeLabel,
      screen.getByRole("button", { name: nodeName(GERALT.name) }),
      screen.getByRole("button", { name: nodeName(CIRI.name) }),
      screen.getByRole("button", { name: graphCopy.layout.save }),
      pathStart,
    ];
    const focused: HTMLElement[] = [];
    const recordFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) focused.push(event.target);
    };
    document.addEventListener("focusin", recordFocus);

    await tabTo(pathStart);
    document.removeEventListener("focusin", recordFocus);

    expect(focused.filter((element) => stops.includes(element))).toEqual(stops);
    stops.forEach((stop) => expect(stop).toBeVisible());
  });

  it("opens the relationship details with Enter on a focused edge label", async () => {
    renderGraph();
    await tabTo(await findEdgeLabel(GUARDIAN_EDGE));

    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("dialog", { name: copy.details.title })).toBeInTheDocument();
  });

  it("opens the character preview with Space on a focused node", async () => {
    renderGraph();
    await tabTo(await findNode(CIRI.name));

    await userEvent.keyboard(" ");

    const preview = await screen.findByRole("complementary", { name: graphCopy.preview.label });
    expect(within(preview).getByRole("heading", { name: CIRI.name })).toBeInTheDocument();
  });
});
