import { describe, expect, it } from "vitest";

import { buildTestDedupeKey } from "./notification-dedupe.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

describe("buildTestDedupeKey", () => {
  it("buckets every instant of the same hour into one key", () => {
    const early = buildTestDedupeKey({
      requestedAt: new Date("2026-07-30T09:00:00.000Z"),
      userId: USER_ID,
    });
    const late = buildTestDedupeKey({
      requestedAt: new Date("2026-07-30T09:59:59.999Z"),
      userId: USER_ID,
    });

    expect(early).toBe(late);
    expect(early).toBe(`test:${USER_ID}:2026-07-30T09`);
  });

  it("separates the next hour", () => {
    const current = buildTestDedupeKey({
      requestedAt: new Date("2026-07-30T09:59:59.999Z"),
      userId: USER_ID,
    });
    const next = buildTestDedupeKey({
      requestedAt: new Date("2026-07-30T10:00:00.000Z"),
      userId: USER_ID,
    });

    expect(current).not.toBe(next);
  });

  it("separates users sharing the same hour", () => {
    const requestedAt = new Date("2026-07-30T09:30:00.000Z");

    expect(buildTestDedupeKey({ requestedAt, userId: USER_ID })).not.toBe(
      buildTestDedupeKey({ requestedAt, userId: OTHER_USER_ID }),
    );
  });
});
