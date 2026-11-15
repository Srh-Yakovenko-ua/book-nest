import type { CreatedEventRelationView } from "@app/shared";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";

import {
  makeTimelineEventPreview,
  makeTimelineEventView,
  makeTimelineView,
} from "../model/timeline.fixtures";
import { timelineKeys } from "./timeline-keys";
import { useCreateEventRelation } from "./use-create-event-relation";
import { useReorderTimelineEvent } from "./use-reorder-timeline-event";
import { useUpdateTimeline } from "./use-update-timeline";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const EVENT_IDS = {
  source: "11111111-1111-4111-8111-111111111111",
  target: "22222222-2222-4222-8222-222222222222",
  unrelated: "33333333-3333-4333-8333-333333333333",
} as const;

const SEEDED_KEYS = {
  bookDetail: bookKeys.detail(BOOK_ID),
  events: timelineKeys.events(BOOK_ID),
  overview: timelineKeys.overview(BOOK_ID),
  sourceEvent: timelineKeys.event(EVENT_IDS.source),
  summary: timelineKeys.summary(BOOK_ID),
  targetEvent: timelineKeys.event(EVENT_IDS.target),
  timelines: timelineKeys.timelines(BOOK_ID),
  unrelatedEvent: timelineKeys.event(EVENT_IDS.unrelated),
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("timeline cache freshness after timeline mutations", () => {
  it("invalidates the event details when a line is renamed", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeTimelineView({ name: "Second age" })));
    const client = seededClient();
    const { result } = renderHook(() => useUpdateTimeline(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        bookId: BOOK_ID,
        input: { name: "Second age" },
        timelineId: "line-1",
      }),
    );

    expect(invalidationByKey(client)).toMatchObject({
      sourceEvent: true,
      targetEvent: true,
      unrelatedEvent: true,
    });
  });

  it("refreshes the events but leaves the lines, summary, overview and book detail fresh after an event reorder", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(makeTimelineEventView({ bookId: BOOK_ID, id: EVENT_IDS.source })),
    );
    const client = seededClient();
    const { result } = renderHook(() => useReorderTimelineEvent(), {
      wrapper: wrapperFor(client),
    });

    await act(() =>
      result.current.mutateAsync({
        bookId: BOOK_ID,
        eventId: EVENT_IDS.source,
        input: {
          afterEventId: EVENT_IDS.target,
          expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
          scope: "timeline",
        },
      }),
    );

    expect(invalidationByKey(client)).toMatchObject({
      bookDetail: false,
      events: true,
      overview: false,
      summary: false,
      timelines: false,
    });
  });

  it("invalidates only the two linked event details when a relation is created", async () => {
    const createdRelation = {
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "44444444-4444-4444-8444-444444444444",
      relationType: "related",
      sourceEventId: EVENT_IDS.source,
      target: makeTimelineEventPreview({ id: EVENT_IDS.target }),
      targetEventId: EVENT_IDS.target,
    } satisfies CreatedEventRelationView;
    fetchMock.mockResolvedValue(jsonResponse(createdRelation));
    const client = seededClient();
    const { result } = renderHook(() => useCreateEventRelation(), {
      wrapper: wrapperFor(client),
    });

    await act(() =>
      result.current.mutateAsync({
        bookId: BOOK_ID,
        eventId: EVENT_IDS.source,
        input: { relationType: "related", targetEventId: EVENT_IDS.target },
      }),
    );

    expect(invalidationByKey(client)).toEqual({
      bookDetail: false,
      events: false,
      overview: false,
      sourceEvent: true,
      summary: false,
      targetEvent: true,
      timelines: false,
      unrelatedEvent: false,
    });
  });
});

function invalidationByKey(client: QueryClient): Record<keyof typeof SEEDED_KEYS, boolean> {
  return {
    bookDetail: isInvalidated(client, SEEDED_KEYS.bookDetail),
    events: isInvalidated(client, SEEDED_KEYS.events),
    overview: isInvalidated(client, SEEDED_KEYS.overview),
    sourceEvent: isInvalidated(client, SEEDED_KEYS.sourceEvent),
    summary: isInvalidated(client, SEEDED_KEYS.summary),
    targetEvent: isInvalidated(client, SEEDED_KEYS.targetEvent),
    timelines: isInvalidated(client, SEEDED_KEYS.timelines),
    unrelatedEvent: isInvalidated(client, SEEDED_KEYS.unrelatedEvent),
  };
}

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function seededClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, { marker: key });
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
