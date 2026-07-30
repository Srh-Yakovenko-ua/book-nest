import { describe, expect, it } from "vitest";

import {
  buildDeliveryDedupeKey,
  buildLoanDedupeKey,
  buildTestDedupeKey,
} from "./notification-dedupe.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const LOAN_ID = "33333333-3333-4333-8333-333333333333";
const DELIVERY_ID = "44444444-4444-4444-8444-444444444444";

describe("buildLoanDedupeKey", () => {
  it("is stable for the same stage and differs across stages", () => {
    const dueSoon = buildLoanDedupeKey({ loanId: LOAN_ID, stage: { kind: "due_soon" } });
    const dueToday = buildLoanDedupeKey({ loanId: LOAN_ID, stage: { kind: "due_today" } });

    expect(dueSoon).toBe(buildLoanDedupeKey({ loanId: LOAN_ID, stage: { kind: "due_soon" } }));
    expect(dueSoon).toBe(`loan:${LOAN_ID}:due_soon`);
    expect(dueToday).toBe(`loan:${LOAN_ID}:due_today`);
    expect(dueSoon).not.toBe(dueToday);
  });

  it("keeps each overdue stage on its own key", () => {
    const keys = [1, 2, 3].map((stage) =>
      buildLoanDedupeKey({
        loanId: LOAN_ID,
        stage: { daysOverdue: stage * 7, kind: "overdue", stage },
      }),
    );

    expect(keys).toEqual([
      `loan:${LOAN_ID}:overdue:1`,
      `loan:${LOAN_ID}:overdue:2`,
      `loan:${LOAN_ID}:overdue:3`,
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("buildDeliveryDedupeKey", () => {
  it("is stable for the same stage and differs across stages", () => {
    expect(buildDeliveryDedupeKey({ deliveryId: DELIVERY_ID, stage: "arriving_soon" })).toBe(
      `delivery:${DELIVERY_ID}:arriving_soon`,
    );
    expect(buildDeliveryDedupeKey({ deliveryId: DELIVERY_ID, stage: "arriving_today" })).toBe(
      `delivery:${DELIVERY_ID}:arriving_today`,
    );
    expect(buildDeliveryDedupeKey({ deliveryId: DELIVERY_ID, stage: "delayed" })).toBe(
      `delivery:${DELIVERY_ID}:delayed`,
    );
  });
});

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
