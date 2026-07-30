import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  collectBookEntityIds,
  resolveNotificationEntityState,
} from "./notification-entity-state.js";

const LIVE_BOOK_ID = "11111111-1111-4111-8111-111111111111";
const TRASHED_BOOK_ID = "22222222-2222-4222-8222-222222222222";
const PURGED_BOOK_ID = "33333333-3333-4333-8333-333333333333";
const SERIES_ID = "44444444-4444-4444-8444-444444444444";

const deletionLookup: ReadonlyMap<string, Nullable<Date>> = new Map([
  [LIVE_BOOK_ID, null],
  [TRASHED_BOOK_ID, new Date("2026-07-29T10:00:00.000Z")],
]);

describe("collectBookEntityIds", () => {
  it("collects each book id once", () => {
    const ids = collectBookEntityIds([
      { entityId: LIVE_BOOK_ID, entityType: "book" },
      { entityId: LIVE_BOOK_ID, entityType: "book" },
      { entityId: TRASHED_BOOK_ID, entityType: "book" },
    ]);

    expect(ids).toEqual([LIVE_BOOK_ID, TRASHED_BOOK_ID]);
  });

  it("ignores rows that point at nothing or at another entity type", () => {
    const ids = collectBookEntityIds([
      { entityId: null, entityType: null },
      { entityId: SERIES_ID, entityType: "series" },
      { entityId: null, entityType: "book" },
    ]);

    expect(ids).toEqual([]);
  });
});

describe("resolveNotificationEntityState", () => {
  it("resolves no state for a notification without an entity", () => {
    const state = resolveNotificationEntityState({
      deletionLookup,
      ref: { entityId: null, entityType: null },
    });

    expect(state).toBeNull();
  });

  it("resolves a present, undeleted entity as live", () => {
    const state = resolveNotificationEntityState({
      deletionLookup,
      ref: { entityId: LIVE_BOOK_ID, entityType: "book" },
    });

    expect(state).toBe("live");
  });

  it("resolves a present, soft-deleted entity as trashed", () => {
    const state = resolveNotificationEntityState({
      deletionLookup,
      ref: { entityId: TRASHED_BOOK_ID, entityType: "book" },
    });

    expect(state).toBe("trashed");
  });

  it("resolves a missing entity as gone", () => {
    const state = resolveNotificationEntityState({
      deletionLookup,
      ref: { entityId: PURGED_BOOK_ID, entityType: "book" },
    });

    expect(state).toBe("gone");
  });

  it("resolves no state for an entity type it does not know", () => {
    const state = resolveNotificationEntityState({
      deletionLookup,
      ref: { entityId: SERIES_ID, entityType: "series" },
    });

    expect(state).toBeNull();
  });
});
