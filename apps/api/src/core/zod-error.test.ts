import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mapZodError } from "./zod-error.js";

describe("mapZodError", () => {
  it("wraps issues into errorsMessages with field and message", () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });

    if (result.success) throw new Error("expected schema to fail");
    const mapped = mapZodError(result.error);

    expect(mapped).toEqual({
      errorsMessages: [
        {
          field: "name",
          message: expect.any(String),
        },
      ],
    });
  });

  it("joins multi-segment paths with a dot", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    const result = schema.safeParse({ user: { name: 5 } });

    if (result.success) throw new Error("expected schema to fail");
    const mapped = mapZodError(result.error);

    expect(mapped.errorsMessages[0]?.field).toBe("user.name");
  });

  it("uses empty string for root-level errors", () => {
    const schema = z.string();
    const result = schema.safeParse(42);

    if (result.success) throw new Error("expected schema to fail");
    const mapped = mapZodError(result.error);

    expect(mapped.errorsMessages).toHaveLength(1);
    expect(mapped.errorsMessages[0]?.field).toBe("");
  });

  it("maps multiple issues to multiple entries preserving order", () => {
    const schema = z.object({
      age: z.number().int().positive(),
      email: z.string().email(),
      name: z.string(),
    });
    const result = schema.safeParse({ age: -1, email: "not-email", name: 0 });

    if (result.success) throw new Error("expected schema to fail");
    const mapped = mapZodError(result.error);

    expect(mapped.errorsMessages.length).toBe(result.error.issues.length);
    expect(mapped.errorsMessages.map((entry) => entry.field)).toEqual(
      result.error.issues.map((issue) => issue.path.join(".")),
    );
  });
});
