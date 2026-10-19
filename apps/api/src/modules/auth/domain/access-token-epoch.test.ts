import { addMilliseconds, addSeconds, subSeconds } from "date-fns";
import { describe, expect, it } from "vitest";

import { isAccessTokenStale } from "./access-token-epoch.js";

const ISSUED_AT = new Date("2026-08-27T10:00:00.000Z");

describe("isAccessTokenStale", () => {
  it("keeps a token valid when the user never changed the password", () => {
    expect(isAccessTokenStale({ issuedAt: ISSUED_AT, passwordChangedAt: null })).toBe(false);
  });

  it("marks a token stale when the password changed after it was issued", () => {
    expect(
      isAccessTokenStale({
        issuedAt: ISSUED_AT,
        passwordChangedAt: addSeconds(ISSUED_AT, 1),
      }),
    ).toBe(true);
  });

  it("keeps a token valid when it was issued after the password change", () => {
    expect(
      isAccessTokenStale({
        issuedAt: ISSUED_AT,
        passwordChangedAt: subSeconds(ISSUED_AT, 1),
      }),
    ).toBe(false);
  });

  it("keeps a token valid when the password changed within the same second", () => {
    expect(
      isAccessTokenStale({
        issuedAt: ISSUED_AT,
        passwordChangedAt: addMilliseconds(ISSUED_AT, 999),
      }),
    ).toBe(false);
  });
});
