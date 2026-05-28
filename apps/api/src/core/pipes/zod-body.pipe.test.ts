import type { ArgumentMetadata } from "@nestjs/common";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BadRequestError } from "../exceptions/errors.js";
import { ZodBodyPipe } from "./zod-body.pipe.js";

const bodyMetadata: ArgumentMetadata = { type: "body" };
const queryMetadata: ArgumentMetadata = { type: "query" };

const schema = z.object({
  age: z.number().int().nonnegative(),
  name: z.string().min(1),
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

describe("ZodBodyPipe", () => {
  it("returns parsed value when body matches the schema", () => {
    const pipe = new ZodBodyPipe(schema);

    const result = pipe.transform({ age: 30, name: "Alice" }, bodyMetadata);

    expect(result).toEqual({ age: 30, name: "Alice" });
  });

  it("strips unknown keys not declared in the schema", () => {
    const pipe = new ZodBodyPipe(schema);

    const result = pipe.transform({ age: 30, extra: "ignored", name: "Alice" }, bodyMetadata);

    expect(result).toEqual({ age: 30, name: "Alice" });
  });

  it("throws BadRequestError with field errors when body is invalid", () => {
    const pipe = new ZodBodyPipe(schema);

    const error = captureBadRequest(() => pipe.transform({ age: -1, name: "" }, bodyMetadata));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid request body");
    expect(error.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name" }),
        expect.objectContaining({ field: "age" }),
      ]),
    );
  });

  it("throws BadRequestError when required key is missing", () => {
    const pipe = new ZodBodyPipe(schema);

    const error = captureBadRequest(() => pipe.transform({ age: 30 }, bodyMetadata));

    expect(error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("passes value through untouched when metadata.type is not body", () => {
    const pipe = new ZodBodyPipe(schema);
    const value = { age: -1, name: "" };

    const result = pipe.transform(value, queryMetadata);

    expect(result).toBe(value);
  });
});
