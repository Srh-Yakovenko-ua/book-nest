import { CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/http-client";

import { toRelationshipSaveError } from "./relationship-save-error";

describe("toRelationshipSaveError", () => {
  it("reports a pair outside the chosen book as an invalid book context, not as a missing book", () => {
    const error = new ApiError(
      400,
      "Every character must appear in the selected book",
      undefined,
      CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
    );

    expect(toRelationshipSaveError(error)).toEqual({
      field: "bookId",
      kind: "field",
      reason: "bookContextInvalid",
    });
  });
});
