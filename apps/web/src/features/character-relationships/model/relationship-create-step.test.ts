import { describe, expect, it } from "vitest";

import type { RelationshipFormField } from "./relationship-form-schema";
import type { RelationshipFieldErrorReason } from "./relationship-save-error";

import { isCreatePairError } from "./relationship-create-step";

type FieldErrorCase = {
  field: RelationshipFormField;
  reason: RelationshipFieldErrorReason;
};

describe("isCreatePairError", () => {
  it.each<FieldErrorCase>([
    { field: "bookId", reason: "bookContextInvalid" },
    { field: "target", reason: "characterNotFound" },
    { field: "target", reason: "selfReference" },
  ])(
    "routes $reason to the pair even when the author can pick another book",
    ({ field, reason }) => {
      expect(isCreatePairError({ bookContextKind: "choice", field, reason })).toBe(true);
    },
  );

  it.each<FieldErrorCase>([
    { field: "bookId", reason: "bookNotFound" },
    { field: "type", reason: "directionMismatch" },
    { field: "type", reason: "duplicate" },
  ])("keeps $reason on its field when the author can pick another book", ({ field, reason }) => {
    expect(isCreatePairError({ bookContextKind: "choice", field, reason })).toBe(false);
  });
});
