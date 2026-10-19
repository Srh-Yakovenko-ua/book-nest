import "@testing-library/jest-dom/vitest";
import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver, renderWithProviders, screen, waitFor } from "@/test-utils";

import type { RelationshipScope } from "./relationship-scope";

import { RelationshipList } from "../components/relationship-list";
import { makeNumberedRelationshipItem, makeRelationshipPage } from "./relationships.fixtures";

type ListRender = {
  scope: RelationshipScope;
  search?: string;
};

type ListReply = (url: URL) => Promise<Response>;

const LAYOUT = {
  cardHeight: 100,
  initialListTop: 200,
  sectionTop: 150,
  width: 600,
} as const;

const FORTY_RELATIONSHIPS = Array.from({ length: 40 }, (_, index) =>
  makeNumberedRelationshipItem(index + 1),
);

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const viewport = mockIntersectionObserver();

const layout: { listTop: number } = { listTop: LAYOUT.initialListTop };

let respondToList: ListReply;

function bookScope(bookId: string): RelationshipScope {
  return { bookId, kind: "book" };
}

function cachingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: Infinity } },
  });
}

function characterScope(contextBookId: string): RelationshipScope {
  return { characterId: "c3c3c3c3-0000-4000-8000-000000000031", contextBookId, kind: "character" };
}

function fortyRelationshipsPage(url: URL): Promise<Response> {
  const page = Number(url.searchParams.get("pageNumber"));
  return json(
    makeRelationshipPage(FORTY_RELATIONSHIPS.slice((page - 1) * 20, page * 20), {
      page,
      pagesCount: 2,
      totalCount: FORTY_RELATIONSHIPS.length,
    }),
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

function layOutCardsInOneColumn() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const listItem = this.closest("article")?.parentElement ?? null;
    if (listItem === null) {
      return new DOMRect(0, LAYOUT.sectionTop - window.scrollY, LAYOUT.width, 0);
    }
    const row = Array.from(listItem.parentElement?.children ?? []).indexOf(listItem);
    return new DOMRect(
      0,
      layout.listTop + row * LAYOUT.cardHeight - window.scrollY,
      LAYOUT.width,
      LAYOUT.cardHeight,
    );
  });
}

function list({ scope, search = "" }: ListRender) {
  return (
    <NuqsTestingAdapter hasMemory key={search} searchParams={search}>
      <RelationshipList scope={scope} />
    </NuqsTestingAdapter>
  );
}

function nothing() {
  return <NuqsTestingAdapter hasMemory>{null}</NuqsTestingAdapter>;
}

beforeEach(() => {
  layout.listTop = LAYOUT.initialListTop;
  respondToList = () => json(makeRelationshipPage(FORTY_RELATIONSHIPS.slice(0, 20)));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/character-relationships") return respondToList(url);
    return Promise.reject(new Error(`unexpected ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  layOutCardsInOneColumn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.scrollTo({ top: 0 });
});

describe("RelationshipList scroll restoration", () => {
  it("brings the card it left back to the same spot even when the content above it moved", async () => {
    const scope = bookScope("a1a1a1a1-0000-4000-8000-000000000011");
    const { rerender } = renderWithProviders(list({ scope }), {
      queryClient: cachingQueryClient(),
    });
    expect(await screen.findAllByRole("article")).toHaveLength(20);
    window.scrollTo({ top: 1030 });

    rerender(nothing());
    window.scrollTo({ top: 0 });
    layout.listTop = 300;
    const scrollTo = vi.spyOn(window, "scrollTo");
    rerender(list({ scope }));

    expect(screen.getAllByRole("article")).toHaveLength(20);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 1130 });
    expect(window.scrollY).toBe(1130);
  });

  it("returns to a card of the second page as soon as the cached pages render again", async () => {
    const scope = bookScope("a1a1a1a1-0000-4000-8000-000000000012");
    respondToList = fortyRelationshipsPage;
    const { rerender } = renderWithProviders(list({ scope }), {
      queryClient: cachingQueryClient(),
    });
    expect(await screen.findAllByRole("article")).toHaveLength(20);
    viewport.enterViewport();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(40));
    window.scrollTo({ top: 2530 });

    rerender(nothing());
    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");
    rerender(list({ scope }));

    expect(screen.getAllByRole("article")).toHaveLength(40);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 2530 });
  });

  it("keeps its own position when the criteria differ from the ones it left", async () => {
    const scope = bookScope("a1a1a1a1-0000-4000-8000-000000000013");
    const { rerender } = renderWithProviders(list({ scope }), {
      queryClient: cachingQueryClient(),
    });
    expect(await screen.findAllByRole("article")).toHaveLength(20);
    window.scrollTo({ top: 1030 });

    rerender(nothing());
    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");
    rerender(list({ scope, search: "?relCat=family" }));

    expect(await screen.findAllByRole("article")).toHaveLength(20);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps its own position when the same character is opened in another book", async () => {
    const { rerender } = renderWithProviders(
      list({ scope: characterScope("a1a1a1a1-0000-4000-8000-000000000014") }),
      { queryClient: cachingQueryClient() },
    );
    expect(await screen.findAllByRole("article")).toHaveLength(20);
    window.scrollTo({ top: 1030 });

    rerender(nothing());
    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");
    rerender(list({ scope: characterScope("a1a1a1a1-0000-4000-8000-000000000015") }));

    expect(await screen.findAllByRole("article")).toHaveLength(20);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
