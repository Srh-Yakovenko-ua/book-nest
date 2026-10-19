import { describe, expect, it } from "vitest";

import { Prisma } from "../generated/prisma/client.js";
import { isRetryableTransactionError, isUniqueConstraintErrorOn } from "./prisma-errors.js";

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

describe("isRetryableTransactionError", () => {
  function knownError(
    code: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("failed", {
      clientVersion: "7.8.0",
      code,
      meta,
    });
  }

  it("retries a Prisma write conflict and a transaction that could not start in time", () => {
    expect(isRetryableTransactionError(knownError("P2034"))).toBe(true);
    expect(isRetryableTransactionError(knownError("P2028"))).toBe(true);
  });

  it("retries a deadlock or serialization failure reported through the driver adapter", () => {
    const deadlock = knownError("P2010", {
      driverAdapterError: {
        cause: { originalCode: "40P01", originalMessage: "deadlock detected" },
      },
    });
    const serialization = knownError("P2010", {
      driverAdapterError: {
        cause: { originalCode: "40001", originalMessage: "could not serialize" },
      },
    });

    expect(isRetryableTransactionError(deadlock)).toBe(true);
    expect(isRetryableTransactionError(serialization)).toBe(true);
  });

  it("retries a raw pg error carrying a retryable SQLSTATE", () => {
    expect(isRetryableTransactionError({ code: "40P01", message: "deadlock detected" })).toBe(true);
  });

  it("leaves constraint violations and unknown failures alone", () => {
    expect(isRetryableTransactionError(uniqueViolation(driverAdapterMeta("x")))).toBe(false);
    expect(
      isRetryableTransactionError(
        knownError("P2010", { driverAdapterError: { cause: { originalCode: "23505" } } }),
      ),
    ).toBe(false);
    expect(isRetryableTransactionError(new Error("boom"))).toBe(false);
    expect(isRetryableTransactionError({ code: "ECONNRESET" })).toBe(false);
  });
});
