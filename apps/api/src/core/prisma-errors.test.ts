import { describe, expect, it } from "vitest";

import { Prisma } from "../generated/prisma/client.js";
import { isUniqueConstraintErrorOn } from "./prisma-errors.js";

function driverAdapterMeta(constraint: string): Record<string, unknown> {
  return {
    driverAdapterError: {
      cause: {
        constraint: { fields: ["user_id", "normalized_name"] },
        kind: "UniqueConstraintViolation",
        originalCode: "23505",
        originalMessage: `duplicate key value violates unique constraint "${constraint}"`,
      },
      name: "DriverAdapterError",
    },
    modelName: "Series",
  };
}

function uniqueViolation(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "7.8.0",
    code: "P2002",
    meta,
  });
}

describe("isUniqueConstraintErrorOn", () => {
  it("reads the constraint name out of a Prisma driver-adapter violation", () => {
    const error = uniqueViolation(driverAdapterMeta("series_user_id_normalized_name_key"));

    expect(isUniqueConstraintErrorOn(error, "series_user_id_normalized_name_key")).toBe(true);
  });

  it("rejects a violation raised by a different constraint", () => {
    const error = uniqueViolation(driverAdapterMeta("books_series_id_part_number_key"));

    expect(isUniqueConstraintErrorOn(error, "series_user_id_normalized_name_key")).toBe(false);
  });

  it("still matches the meta.target shape used without a driver adapter", () => {
    expect(
      isUniqueConstraintErrorOn(
        uniqueViolation({ target: "books_series_id_part_number_key" }),
        "books_series_id_part_number_key",
      ),
    ).toBe(true);
    expect(
      isUniqueConstraintErrorOn(
        uniqueViolation({ target: ["books_series_id_part_number_key"] }),
        "books_series_id_part_number_key",
      ),
    ).toBe(true);
  });

  it("returns false for meta shapes it cannot read a constraint name from", () => {
    expect(isUniqueConstraintErrorOn(uniqueViolation({}), "anything")).toBe(false);
    expect(isUniqueConstraintErrorOn(new Error("boom"), "anything")).toBe(false);
  });
});
