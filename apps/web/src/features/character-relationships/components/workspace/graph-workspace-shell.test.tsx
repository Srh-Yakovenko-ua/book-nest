import type {
  BookDetailsView,
  CharacterRelationshipPathView,
  FamilyTreeGraphView,
} from "@app/shared";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookDetailsView } from "@/features/books/components/book-details.fixtures";
import {
  makeBookCharacterSummary,
  makeCharacterDetails,
  makeCharacterSummary,
} from "@/features/characters/model/characters.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { GraphSceneValue } from "./graph-scene-context";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
  RELATIONSHIP_FIXTURE,
} from "../../model/relationships.fixtures";
import { GraphWorkspaceShell } from "./graph-workspace-shell";

const urlState = vi.hoisted(() => {
  const updates: UrlUpdateEvent[] = [];
  return { search: new URLSearchParams(), updates };
});

vi.mock("next/navigation", () => ({ useSearchParams: () => urlState.search }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const canvasMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock("./graph-workspace-canvas-lazy", async () => {
  const { useEffect } = await import("react");
  const { default: catalog } = await import("@/messages/uk.json");
  const canvasCopy = catalog.relationships.workspace.canvas;

  function MountCountingCanvas({
    controls,
    value,
  }: {
    controls: { immersive: boolean; onToggleImmersive: () => void };
    value: GraphSceneValue;
  }) {
    useEffect(() => {
      canvasMounts.count += 1;
    }, []);

    return (
      <>
        <button onClick={controls.onToggleImmersive} type="button">
          {controls.immersive ? canvasCopy.exitFullscreen : canvasCopy.enterFullscreen}
        </button>
        <ul>
          {[...value.characters.values()].map(({ node }) => (
            <li key={node.id}>
              <button onClick={() => value.onCharacterOpen(node.id)} type="button">
                {node.displayName}
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return { GraphWorkspaceCanvasLazy: MountCountingCanvas };
});

type GraphRoutes = {
  graph: () => Promise<Response>;
  path: () => Promise<Response>;
};

type WorkspaceSetup = {
  book?: BookDetailsView;
  search?: string;
};

const copy = messages.relationships.workspace;

const { book: BOOK, ciri: CIRI, geralt: GERALT, yennefer: YENNEFER } = RELATIONSHIP_FIXTURE;

const JASKIER = { id: "d4d4d4d4-0000-4000-8000-000000000005", name: "Любисток" } as const;

const CAST = [GERALT, CIRI, YENNEFER, JASKIER];

const IDS = {
  bookCharacter: "f1f1f1f1-0000-4000-8000-000000000031",
  geraltCiri: "a1a1a1a1-0000-4000-8000-000000000011",
  geraltJaskier: "a2a2a2a2-0000-4000-8000-000000000012",
  geraltYennefer: "a3a3a3a3-0000-4000-8000-000000000013",
  lodge: "b1b1b1b1-0000-4000-8000-000000000021",
  witchers: "b2b2b2b2-0000-4000-8000-000000000022",
  yenneferCiri: "a4a4a4a4-0000-4000-8000-000000000014",
} as const;

const API = {
  character: (characterId: string) => `/api/books/${BOOK.id}/characters/${characterId}`,
  graph: `/api/books/${BOOK.id}/character-graph`,
  layout: "/api/character-graph-layouts",
  path: "/api/character-relationships/path",
  summary: `/api/books/${BOOK.id}/character-summary`,
} as const;

const SEARCH = {
  filters: "?categories=social&types=friend_of",
  network: "?view=network",
  path: `?path=1&from=${GERALT.id}&to=${CIRI.id}`,
  person: `?characterId=${GERALT.id}`,
  tree: `?view=tree&characterId=${CIRI.id}&categories=social`,
} as const;

const PAGE = { current: 120, next: 200 } as const;

const EXPECTED_TEXT = {
  componentsCounter: "На карті: 1 група",
  groupsCounter: "На карті: 2 групи",
  peopleCounter: "На карті: 3 персонажі · 2 зв’язки",
  summaryHeading: "2 персонажі у книзі",
} as const;

const LABELS = {
  friendChip: copy.filters.remove.replace("{label}", messages.relationships.types.friend_of),
  pickGeralt: copy.guided.pick.replace("{name}", GERALT.name),
  socialChip: copy.filters.remove.replace("{label}", messages.relationships.categories.social),
} as const;

const PHONE_WIDTH = 375;

const EDGES = {
  geraltCiri: makeRelationshipGraphEdge({ id: IDS.geraltCiri }),
  geraltJaskier: makeRelationshipGraphEdge({
    category: "social",
    directionality: "symmetric",
    id: IDS.geraltJaskier,
    target: JASKIER.id,
    type: "friend_of",
  }),
  geraltYennefer: makeRelationshipGraphEdge({
    category: "romantic",
    directionality: "symmetric",
    id: IDS.geraltYennefer,
    target: YENNEFER.id,
    type: "partner_of",
  }),
  yenneferCiri: makeRelationshipGraphEdge({
    id: IDS.yenneferCiri,
    source: YENNEFER.id,
    target: CIRI.id,
    type: "adoptive_parent_of",
  }),
};

const GRAPHS = {
  network: makeRelationshipGraph({
    clusterBy: "group",
    clusters: [
      { groupType: "order", id: IDS.witchers, kind: "group", name: "Школа Вовка", size: 2 },
      { groupType: "organization", id: IDS.lodge, kind: "group", name: "Ложа чародійок", size: 1 },
    ],
    edges: [EDGES.geraltCiri, EDGES.geraltYennefer],
    nodes: [
      makeRelationshipGraphNode({ ...GERALT, clusterId: IDS.witchers }),
      makeRelationshipGraphNode({ ...CIRI, clusterId: IDS.witchers }),
      makeRelationshipGraphNode({ ...YENNEFER, clusterId: IDS.lodge }),
    ],
  }),
  nextPage: makeRelationshipGraph({
    edges: [EDGES.geraltJaskier],
    nodes: [GERALT, JASKIER].map((character) => makeRelationshipGraphNode(character)),
  }),
  person: makeRelationshipGraph({
    edges: [EDGES.geraltCiri, EDGES.geraltYennefer],
    nodes: [GERALT, CIRI, YENNEFER, JASKIER].map((character) =>
      makeRelationshipGraphNode(character),
    ),
  }),
};

const FAMILY_TREE: FamilyTreeGraphView = {
  ancestors: 2,
  descendants: 2,
  diagnostics: [],
  edges: [EDGES.yenneferCiri],
  focusCharacterId: CIRI.id,
  graphVersion: "tree-v1",
  hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
  lineage: [
    { childId: CIRI.id, kind: "adoptive", parentId: YENNEFER.id, relationshipId: IDS.yenneferCiri },
  ],
  nodes: [CIRI, YENNEFER].map((character) => makeRelationshipGraphNode(character)),
  projection: "family_tree",
  updatedAt: null,
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

class PhoneWidthResizeObserver implements ResizeObserver {
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
    Object.defineProperty(target, "clientWidth", { configurable: true, value: PHONE_WIDTH });
    this.callback([], this);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }
}

function getRequests(pathname: string): URL[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") === "GET")
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === pathname);
}

function holdResponse() {
  let release: (body: unknown) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = (body) => resolve(toResponse(body));
  });
  return { promise, release: (body: unknown) => release(body) };
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(toResponse(body, status));
}

function pathView(
  overrides: Partial<CharacterRelationshipPathView> = {},
): CharacterRelationshipPathView {
  return { edges: [], found: false, fromId: GERALT.id, nodes: [], toId: CIRI.id, ...overrides };
}

function readingBook(currentPage: number): BookDetailsView {
  return makeBookDetailsView({
    id: BOOK.id,
    readingProgress: {
      abandonedAt: null,
      currentPage,
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
}

function recordUrlUpdate(event: UrlUpdateEvent) {
  urlState.search = event.searchParams;
  urlState.updates.push(event);
}

function renderWorkspace(setup: WorkspaceSetup = {}) {
  urlState.search = new URLSearchParams(setup.search);
  return renderWithProviders(workspace(setup));
}

function requestedPathnames(): string[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").pathname);
}

function requestParams(pathname: string): Record<string, string>[] {
  return getRequests(pathname).map((url) => Object.fromEntries(url.searchParams));
}

function respond({
  init,
  input,
  routes,
}: {
  init?: RequestInit;
  input: RequestInfo | URL;
  routes: GraphRoutes;
}): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const route = `${init?.method ?? "GET"} ${url.pathname}`;
  const character = CAST.find((entry) => route === `GET ${API.character(entry.id)}`);
  if (character !== undefined) {
    return json(makeCharacterDetails({ id: character.id, name: character.name }));
  }
  switch (route) {
    case `GET ${API.graph}`:
      return routes.graph();
    case `GET ${API.layout}`:
      return json({ message: "Layout not found" }, 404);
    case `GET ${API.path}`:
      return routes.path();
    case `GET ${API.summary}`:
      return json(
        makeBookCharacterSummary({
          bookId: BOOK.id,
          top: [
            makeCharacterSummary({
              characterId: GERALT.id,
              id: IDS.bookCharacter,
              name: GERALT.name,
            }),
          ],
          totalVisibleCharacters: 2,
        }),
      );
    default:
      return Promise.reject(new Error(`unexpected fetch: ${route}`));
  }
}

function serve(overrides: Partial<GraphRoutes> = {}) {
  const routes: GraphRoutes = {
    graph: () => json(GRAPHS.person),
    path: () => json(pathView({ searchLimited: false })),
    ...overrides,
  };
  fetchMock.mockImplementation((input, init) => respond({ init, input, routes }));
}

function toResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function workspace({ book = readingBook(PAGE.current), search = "" }: WorkspaceSetup) {
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={recordUrlUpdate} searchParams={search}>
      <GraphWorkspaceShell book={book} />
    </NuqsTestingAdapter>
  );
}

beforeEach(() => {
  urlState.updates.length = 0;
  fetchMock.mockReset();
  serve();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GraphWorkspaceShell person view", () => {
  it("offers a guided start and loads no graph until a character is chosen", async () => {
    renderWorkspace();

    expect(
      await screen.findByRole("heading", { name: copy.guided.personTitle }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: EXPECTED_TEXT.summaryHeading }),
    ).toBeInTheDocument();
    expect(getRequests(API.summary)).toHaveLength(1);
    expect(getRequests(API.graph)).toEqual([]);
  });

  it("asks for every relationship one step around the chosen character", async () => {
    renderWorkspace({ search: SEARCH.person });

    expect(await screen.findByRole("button", { name: CIRI.name })).toBeInTheDocument();
    expect(requestParams(API.graph)).toEqual([
      { depth: "1", focusCharacterId: GERALT.id, mode: "all" },
    ]);
  });

  it("counts only the characters the map draws", async () => {
    renderWorkspace({ search: SEARCH.person });

    expect(await screen.findByText(EXPECTED_TEXT.peopleCounter)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: JASKIER.name })).not.toBeInTheDocument();
  });

  it("opens the details of a clicked character without moving the center", async () => {
    renderWorkspace({ search: SEARCH.person });

    await userEvent.click(await screen.findByRole("button", { name: CIRI.name }));

    expect(await screen.findByRole("heading", { name: CIRI.name })).toBeInTheDocument();
    expect(
      urlState.updates.filter((update) => update.searchParams.get("characterId") !== GERALT.id),
    ).toEqual([]);
  });

  it("says the character is unavailable when the book has no such character", async () => {
    serve({ graph: () => json({ message: "Character not found" }, 404) });
    renderWorkspace({ search: SEARCH.person });

    expect(
      await screen.findByRole("heading", { name: copy.states.unavailableCharacter.title }),
    ).toBeInTheDocument();
  });

  it("hides the previous map while the graph for a new reading position loads", async () => {
    const nextGraph = holdResponse();
    serve({
      graph: vi
        .fn<() => Promise<Response>>()
        .mockImplementationOnce(() => json(GRAPHS.person))
        .mockImplementation(() => nextGraph.promise),
    });
    const view = renderWorkspace({ search: SEARCH.person });
    await screen.findByRole("button", { name: CIRI.name });

    view.rerender(workspace({ book: readingBook(PAGE.next), search: SEARCH.person }));

    await waitFor(() => expect(getRequests(API.graph)).toHaveLength(2));
    expect(screen.queryByText(CIRI.name)).not.toBeInTheDocument();
    expect(screen.getByText(copy.states.loading)).toBeInTheDocument();

    nextGraph.release(GRAPHS.nextPage);

    expect(await screen.findByRole("button", { name: JASKIER.name })).toBeInTheDocument();
  });
});

describe("GraphWorkspaceShell family tree view", () => {
  it("asks for the family tree projection without relationship filters", async () => {
    serve({ graph: () => json(FAMILY_TREE) });
    renderWorkspace({ search: SEARCH.tree });

    expect(await screen.findByRole("button", { name: YENNEFER.name })).toBeInTheDocument();
    expect(requestParams(API.graph)).toEqual([
      { ancestors: "2", descendants: "2", focusCharacterId: CIRI.id, projection: "family_tree" },
    ]);
  });

  it("keeps the category filters dormant and says so", async () => {
    serve({ graph: () => json(FAMILY_TREE) });
    renderWorkspace({ search: SEARCH.tree });

    await screen.findByRole("button", { name: YENNEFER.name });

    expect(screen.getByText(copy.filters.treeDormant)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: copy.filters.active })).not.toBeInTheDocument();
  });
});

describe("GraphWorkspaceShell network view", () => {
  it("asks for the whole network clustered by group, around no character", async () => {
    serve({ graph: () => json(GRAPHS.network) });
    renderWorkspace({ search: SEARCH.network });

    expect(await screen.findByText(EXPECTED_TEXT.groupsCounter)).toBeInTheDocument();
    expect(requestParams(API.graph)).toEqual([{ clusterBy: "group", mode: "all" }]);
  });

  it("regroups the network on the client without asking for the graph again", async () => {
    serve({ graph: () => json(GRAPHS.network) });
    renderWorkspace({ search: SEARCH.network });
    await screen.findByText(EXPECTED_TEXT.groupsCounter);

    await userEvent.click(screen.getByRole("combobox", { name: copy.grouping.label }));
    await userEvent.click(await screen.findByRole("option", { name: copy.grouping.components }));

    expect(await screen.findByText(EXPECTED_TEXT.componentsCounter)).toBeInTheDocument();
    expect(getRequests(API.graph)).toHaveLength(1);
  });
});

describe("GraphWorkspaceShell path view", () => {
  it("validates both characters before it searches the path, and loads no graph", async () => {
    renderWorkspace({ search: SEARCH.path });

    expect(await screen.findByText(copy.path.notFound)).toBeInTheDocument();
    const [first, second, last, ...rest] = requestedPathnames();
    expect([first, second]).toEqual(
      expect.arrayContaining([API.character(GERALT.id), API.character(CIRI.id)]),
    );
    expect([last, ...rest]).toEqual([API.path]);
    expect(getRequests(API.graph)).toEqual([]);
  });

  it("searches the path across every relationship in the book's reading context", async () => {
    renderWorkspace({ search: SEARCH.path });

    expect(await screen.findByText(copy.path.notFound)).toBeInTheDocument();
    expect(requestParams(API.path)).toEqual([
      { contextBookId: BOOK.id, fromId: GERALT.id, mode: "all", toId: CIRI.id },
    ]);
  });

  it.each([
    {
      body: pathView({ searchLimited: true }),
      message: copy.path.limited,
      outcome: "stopped at its safety limit",
    },
    {
      body: pathView({ searchLimited: false }),
      message: copy.path.notFound,
      outcome: "finished without a route",
    },
    { body: pathView(), message: copy.path.unknown, outcome: "cannot confirm it finished" },
  ])("says when the search $outcome", async ({ body, message }) => {
    serve({ path: () => json(body) });
    renderWorkspace({ search: SEARCH.path });

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

describe("GraphWorkspaceShell details and full screen", () => {
  beforeEach(() => {
    canvasMounts.count = 0;
  });

  it("keeps one canvas and one graph request through details and full screen", async () => {
    renderWorkspace({ search: SEARCH.person });

    await userEvent.click(await screen.findByRole("button", { name: CIRI.name }));
    await screen.findByRole("complementary", { name: CIRI.name });
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: copy.canvas.enterFullscreen }));
    await userEvent.click(await screen.findByRole("button", { name: copy.canvas.exitFullscreen }));
    await screen.findByRole("button", { name: copy.canvas.enterFullscreen });

    expect(canvasMounts.count).toBe(1);
    expect(getRequests(API.graph)).toHaveLength(1);
  });

  it("closes only the details on the first Escape and refocuses their opener", async () => {
    renderWorkspace({ search: SEARCH.person });
    const trigger = await screen.findByRole("button", { name: CIRI.name });
    await userEvent.click(screen.getByRole("button", { name: copy.canvas.enterFullscreen }));
    await userEvent.click(trigger);
    await screen.findByRole("complementary", { name: CIRI.name });

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("complementary", { name: CIRI.name })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.canvas.exitFullscreen })).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("leaves full screen on the Escape after the details are closed", async () => {
    renderWorkspace({ search: SEARCH.person });
    const trigger = await screen.findByRole("button", { name: CIRI.name });
    await userEvent.click(screen.getByRole("button", { name: copy.canvas.enterFullscreen }));
    await userEvent.click(trigger);
    await screen.findByRole("complementary", { name: CIRI.name });
    await userEvent.keyboard("{Escape}");

    await userEvent.keyboard("{Escape}");

    expect(
      await screen.findByRole("button", { name: copy.canvas.enterFullscreen }),
    ).toBeInTheDocument();
  });
});

describe("GraphWorkspaceShell details at different widths", () => {
  it("shows the details inline, named after the character, at the default width", async () => {
    renderWorkspace({ search: SEARCH.person });

    await userEvent.click(await screen.findByRole("button", { name: CIRI.name }));

    expect(await screen.findByRole("complementary", { name: CIRI.name })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the details as a dialog instead of an inline panel at phone width", async () => {
    vi.stubGlobal("ResizeObserver", PhoneWidthResizeObserver);
    renderWorkspace({ search: SEARCH.person });

    await userEvent.click(await screen.findByRole("button", { name: CIRI.name }));

    expect(await screen.findByRole("dialog", { name: CIRI.name })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: CIRI.name })).not.toBeInTheDocument();
  });
});

describe("GraphWorkspaceShell focus", () => {
  it("moves focus to the map status once the chosen character's graph loads", async () => {
    renderWorkspace();

    await userEvent.click(await screen.findByRole("button", { name: LABELS.pickGeralt }));

    const status = await screen.findByText(EXPECTED_TEXT.peopleCounter);
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("moves focus to the next chip when an active filter is removed", async () => {
    renderWorkspace({ search: SEARCH.filters });

    const friendChip = await screen.findByRole("button", { name: LABELS.friendChip });

    await userEvent.click(screen.getByRole("button", { name: LABELS.socialChip }));

    await waitFor(() => expect(friendChip).toHaveFocus());
  });

  it("moves focus to the filters button when the last active filter is removed", async () => {
    renderWorkspace({ search: SEARCH.filters });
    await userEvent.click(await screen.findByRole("button", { name: LABELS.socialChip }));

    await userEvent.click(await screen.findByRole("button", { name: LABELS.friendChip }));

    const filtersButton = await screen.findByRole("button", { name: copy.filters.trigger });
    await waitFor(() => expect(filtersButton).toHaveFocus());
  });
});
