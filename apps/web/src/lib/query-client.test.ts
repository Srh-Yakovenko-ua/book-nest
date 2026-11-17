import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/http-client";
import { getQueryClient, shouldRetryQuery } from "@/lib/query-client";

describe("shouldRetryQuery", () => {
  it.each([404, 403, 400, 401, 422])("does not retry ApiError status %i", (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, "x"))).toBe(false);
  });

  it.each([500, 503, 408, 429])("retries ApiError status %i once", (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, "x"))).toBe(true);
  });

  it("retries a first network failure", () => {
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
  });

  it.each([
    { error: new Error("x"), kind: "a plain Error" },
    { error: "x", kind: "a non-Error value" },
  ])("does not retry $kind", ({ error }) => {
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it.each([
    { error: new ApiError(500, "x"), kind: "an ApiError with status 500" },
    { error: new TypeError("Failed to fetch"), kind: "a network failure" },
  ])("does not retry $kind a second time", ({ error }) => {
    expect(shouldRetryQuery(1, error)).toBe(false);
  });
});

describe("getQueryClient", () => {
  it("uses shouldRetryQuery as the default query retry", () => {
    expect(getQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });
});
