import "@testing-library/jest-dom/vitest";

import type { CharacterRelationshipListItemView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import type { RelationshipScope } from "../model/relationship-scope";

import {
  makeNumberedRelationshipItem,
  makeRelationshipPage,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipList } from "./relationship-list";

type ListRender = {
  onCreate?: () => void;
  onUrlUpdate?: OnUrlUpdateFunction;
  scope?: RelationshipScope;
  search?: string;
};

type ListReply = (url: URL) => Promise<Response>;

const copy = messages.relationships;

const SCOPES = {
  book: { bookId: RELATIONSHIP_FIXTURE.book.id, kind: "book" },
  character: {
    characterId: RELATIONSHIP_FIXTURE.geralt.id,
    contextBookId: null,
    kind: "character",
  },
  series: {
    contextBookId: RELATIONSHIP_FIXTURE.book.id,
    kind: "series",
    seriesId: "5a5a5a5a-0000-4000-8000-000000000003",
  },
} as const satisfies Record<RelationshipScope["kind"], RelationshipScope>;

const ITEMS = {
  first: makeNumberedRelationshipItem(1),
  second: makeNumberedRelationshipItem(2),
  third: makeNumberedRelationshipItem(3),
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const viewport = mockIntersectionObserver();

let respondToList: ListReply;

function deferredResponse() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function findEmptyState(title: string): Promise<HTMLElement> {
  const container = (await screen.findByRole("heading", { name: title })).parentElement;
  if (container === null) throw new Error(`no empty state for ${title}`);
  return container;
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(jsonResponse(body, status));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
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

function openLabel(item: CharacterRelationshipListItemView): string {
  return copy.card.open
    .replace("{source}", item.relationship.source.name)
    .replace("{target}", item.relationship.target.name);
}

function pageNumberOf(url: URL): number {
  return Number(url.searchParams.get("pageNumber"));
}

function renderList({ onCreate, onUrlUpdate, scope = SCOPES.book, search = "" }: ListRender = {}) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <RelationshipList onCreate={onCreate} scope={scope} />
    </NuqsTestingAdapter>,
  );
}

function twoPages(
  firstPage: CharacterRelationshipListItemView[],
  secondPage: CharacterRelationshipListItemView[],
): ListReply {
  return (url) => {
    const page = pageNumberOf(url);
    return json(
      makeRelationshipPage(page === 1 ? firstPage : secondPage, {
        page,
        pagesCount: 2,
        totalCount: firstPage.length + secondPage.length,
      }),
    );
  };
}

beforeEach(() => {
  respondToList = () => json(makeRelationshipPage([ITEMS.first]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/api/character-relationships") {
      return respondToList(url);
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipList loading", () => {
  it("shows the loading status and no card or empty state until the first page arrives", async () => {
    const firstPage = deferredResponse();
    respondToList = () => firstPage.promise;

    renderList();

    expect(screen.getByText(copy.list.loading)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: copy.list.empty.book.title }),
    ).not.toBeInTheDocument();

    firstPage.release(jsonResponse(makeRelationshipPage([ITEMS.first, ITEMS.second])));

    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText(copy.list.loading)).not.toBeInTheDocument();
  });

  it("announces the server total of the criteria, not the number of loaded cards", async () => {
    respondToList = () =>
      json(
        makeRelationshipPage(
          Array.from({ length: 20 }, (_, index) => makeNumberedRelationshipItem(index + 1)),
          { pagesCount: 3, totalCount: 41 },
        ),
      );

    renderList();

    expect(await screen.findByText("41 зв’язок")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(20);
  });
});

describe("RelationshipList empty states", () => {
  it.each(Object.values(SCOPES))(
    "describes an empty $kind scope in its own words",
    async (scope) => {
      respondToList = () => json(makeRelationshipPage([]));

      renderList({ scope });

      const empty = await findEmptyState(copy.list.empty[scope.kind].title);
      expect(within(empty).getByText(copy.list.empty[scope.kind].description)).toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: copy.toolbar.searchLabel }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: copy.list.noResults.title }),
      ).not.toBeInTheDocument();
    },
  );

  it("offers to add the first relationship when the page can create one", async () => {
    const onCreate = vi.fn<() => void>();
    respondToList = () => json(makeRelationshipPage([]));

    renderList({ onCreate });

    const empty = await findEmptyState(copy.list.empty.book.title);
    await userEvent.click(within(empty).getByRole("button", { name: copy.list.empty.create }));

    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("offers no create button when the page cannot create", async () => {
    respondToList = () => json(makeRelationshipPage([]));

    renderList();

    const empty = await findEmptyState(copy.list.empty.book.title);
    expect(within(empty).queryByRole("button")).not.toBeInTheDocument();
  });

  it("tells that nothing matches the criteria and clears only the rel keys", async () => {
    const events: UrlUpdateEvent[] = [];
    respondToList = () => json(makeRelationshipPage([]));

    renderList({
      onUrlUpdate: (event) => events.push(event),
      search: "?tab=relationships&relCat=family&relQ=Любисток",
    });

    const empty = await findEmptyState(copy.list.noResults.title);
    expect(
      screen.queryByRole("heading", { name: copy.list.empty.book.title }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(empty).getByRole("button", { name: copy.list.noResults.clear }));

    await waitFor(() => expect(lastUrl(events).has("relCat")).toBe(false));
    expect(lastUrl(events).has("relQ")).toBe(false);
    expect(lastUrl(events).get("tab")).toBe("relationships");
  });
});

describe("RelationshipList errors", () => {
  it("offers a retry when the first page fails and shows the cards it brings back", async () => {
    respondToList = () => json({ message: "boom" }, 500);

    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.list.error.title);
    respondToList = () => json(makeRelationshipPage([ITEMS.first]));

    await userEvent.click(within(alert).getByRole("button", { name: copy.list.error.retry }));

    expect(await screen.findByRole("button", { name: openLabel(ITEMS.first) })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the first page when the next page fails and retries only that page", async () => {
    let failSecondPage = true;
    const pages = twoPages([ITEMS.first], [ITEMS.second]);
    respondToList = (url) => {
      if (pageNumberOf(url) === 2 && failSecondPage) {
        failSecondPage = false;
        return json({ message: "boom" }, 500);
      }
      return pages(url);
    };

    renderList();

    await screen.findByRole("button", { name: openLabel(ITEMS.first) });
    viewport.enterViewport();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.list.loadMoreError);
    expect(screen.getByRole("button", { name: openLabel(ITEMS.first) })).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: messages.common.retry }));

    expect(
      await screen.findByRole("button", { name: openLabel(ITEMS.second) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: openLabel(ITEMS.first) })).toBeInTheDocument();
    expect(listRequests().map(pageNumberOf)).toEqual([1, 2, 2]);
  });
});

describe("RelationshipList pages", () => {
  it("renders a relationship returned on two pages once", async () => {
    respondToList = twoPages([ITEMS.first, ITEMS.second], [ITEMS.second, ITEMS.third]);

    renderList();

    await screen.findByRole("button", { name: openLabel(ITEMS.first) });
    viewport.enterViewport();

    expect(await screen.findByRole("button", { name: openLabel(ITEMS.third) })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: openLabel(ITEMS.second) })).toHaveLength(1);
  });

  it("starts again from page 1 and drops the loaded pages when the criteria change", async () => {
    const pages = twoPages([ITEMS.first], [ITEMS.second]);
    respondToList = (url) =>
      url.searchParams.has("categories") ? json(makeRelationshipPage([ITEMS.third])) : pages(url);

    renderList();

    await screen.findByRole("button", { name: openLabel(ITEMS.first) });
    viewport.enterViewport();
    await screen.findByRole("button", { name: openLabel(ITEMS.second) });

    const categories = within(screen.getByRole("toolbar", { name: copy.toolbar.categoriesLabel }));
    await userEvent.click(categories.getByRole("button", { name: copy.categories.family }));

    expect(await screen.findByRole("button", { name: openLabel(ITEMS.third) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: openLabel(ITEMS.second) })).not.toBeInTheDocument();
    expect(
      listRequests()
        .filter((url) => url.searchParams.getAll("categories").includes("family"))
        .map(pageNumberOf),
    ).toEqual([1]);
  });
});
