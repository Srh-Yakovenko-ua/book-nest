import type { ArgumentMetadata } from "@nestjs/common";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BadRequestError } from "../exceptions/errors.js";
import { ZodQueryPipe } from "./zod-query.pipe.js";

const queryMetadata: ArgumentMetadata = { type: "query" };
const bodyMetadata: ArgumentMetadata = { type: "body" };

const querySchema = z.object({
  pageNumber: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(10),
  searchTerm: z.string().optional(),
});

function captureBadRequest(thrown: () => unknown): BadRequestError {
  try {
    thrown();
  } catch (error) {
    if (error instanceof BadRequestError) return error;
    throw error;
  }
  throw new Error("expected pipe to throw BadRequestError");
}

describe("ZodQueryPipe", () => {
  it("coerces numeric string query params to numbers", () => {
    const pipe = new ZodQueryPipe(querySchema);

    const result = pipe.transform({ pageNumber: "3", pageSize: "25" }, queryMetadata);

    expect(result).toEqual({ pageNumber: 3, pageSize: 25 });
  });

  it("applies schema defaults when keys are missing", () => {
    const pipe = new ZodQueryPipe(querySchema);

    const result = pipe.transform({}, queryMetadata);

    expect(result).toEqual({ pageNumber: 1, pageSize: 10 });
  });

  it("keeps optional fields when provided", () => {
    const pipe = new ZodQueryPipe(querySchema);

    const result = pipe.transform({ searchTerm: "foo" }, queryMetadata);

    expect(result).toEqual({ pageNumber: 1, pageSize: 10, searchTerm: "foo" });
  });

  it("throws BadRequestError when a coerced number is invalid", () => {
    const pipe = new ZodQueryPipe(querySchema);

    const error = captureBadRequest(() =>
      pipe.transform({ pageNumber: "not-a-number" }, queryMetadata),
    );

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid query params");
    expect(error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pageNumber" })]),
    );
  });

  it("throws BadRequestError when a coerced number is non-positive", () => {
    const pipe = new ZodQueryPipe(querySchema);

    const error = captureBadRequest(() => pipe.transform({ pageSize: "0" }, queryMetadata));

    expect(error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pageSize" })]),
    );
  });

  it("passes value through untouched when metadata.type is not query", () => {
    const pipe = new ZodQueryPipe(querySchema);
    const value = { pageNumber: "not-a-number" };

    const result = pipe.transform(value, bodyMetadata);

    expect(result).toBe(value);
  });
});
