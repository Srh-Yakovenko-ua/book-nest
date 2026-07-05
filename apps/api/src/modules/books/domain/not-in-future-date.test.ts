import { ChangeReadingStatusInputSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function utcDateStringOffsetByDays(days: number): string {
  return new Date(Date.now() + days * DAY_IN_MS).toISOString().slice(0, 10);
}

describe("notInFutureDate timezone-skew tolerance", () => {
  it("accepts the current UTC day", () => {
    const result = ChangeReadingStatusInputSchema.safeParse({
      date: utcDateStringOffsetByDays(0),
      status: "reading",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a date one UTC day ahead so a client past its local midnight is not rejected", () => {
    const result = ChangeReadingStatusInputSchema.safeParse({
      date: utcDateStringOffsetByDays(1),
      status: "reading",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a date two UTC days ahead", () => {
    const result = ChangeReadingStatusInputSchema.safeParse({
      date: utcDateStringOffsetByDays(2),
      status: "reading",
    });

    expect(result.success).toBe(false);
  });
});
