import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { UserModel } from "../../../generated/prisma/models.js";

import { toUserView } from "./user.mapper.js";

function userModel(overrides: Partial<UserModel> = {}): UserModel {
  return {
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: null,
    id: "11111111-1111-4111-8111-111111111111",
    name: "Reader",
    nickname: null,
    passwordHash: "stored-hash",
    role: "user",
    updatedAt: new Date("2026-01-02T03:04:05.000Z"),
    ...overrides,
  };
}

describe("toUserView", () => {
  it("maps a null dateOfBirth to null", () => {
    const view = toUserView(userModel({ dateOfBirth: null }));

    expect(view.dateOfBirth).toBeNull();
  });

  it("formats a dateOfBirth as a YYYY-MM-DD string", () => {
    const view = toUserView(userModel({ dateOfBirth: new Date("1995-07-21T00:00:00.000Z") }));

    expect(view.dateOfBirth).toBe("1995-07-21");
  });

  describe("with a server timezone west of UTC", () => {
    const originalTimezone = process.env.TZ;

    beforeEach(() => {
      process.env.TZ = "America/Los_Angeles";
    });

    afterEach(() => {
      process.env.TZ = originalTimezone;
    });

    it("maps a UTC-midnight dateOfBirth to the same calendar day", () => {
      const view = toUserView(userModel({ dateOfBirth: new Date("1995-07-21T00:00:00.000Z") }));

      expect(view.dateOfBirth).toBe("1995-07-21");
    });
  });

  it("serializes createdAt as an ISO string", () => {
    const view = toUserView(userModel());

    expect(view.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("never leaks the password hash", () => {
    const view = toUserView(userModel());

    expect(view).not.toHaveProperty("passwordHash");
  });

  it("maps a null emailVerifiedAt to emailVerified false", () => {
    const view = toUserView(userModel({ emailVerifiedAt: null }));

    expect(view.emailVerified).toBe(false);
  });

  it("maps a set emailVerifiedAt to emailVerified true", () => {
    const view = toUserView(userModel({ emailVerifiedAt: new Date("2026-01-03T00:00:00.000Z") }));

    expect(view.emailVerified).toBe(true);
  });
});
