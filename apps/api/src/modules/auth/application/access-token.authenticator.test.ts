import type { Nullable } from "@app/shared";

import { addMinutes, addSeconds, subSeconds } from "date-fns";
import { describe, expect, it } from "vitest";

import type { UserModel } from "../../../generated/prisma/models.js";
import type { UsersRepository } from "../infrastructure/users.repository.js";
import type { TokenService } from "./token.service.js";

import { fakeOf } from "../../../test/fake.js";
import { AccessTokenAuthenticator } from "./access-token.authenticator.js";

const ISSUED_AT = new Date("2026-08-27T10:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildAuthenticator(user: Nullable<UserModel>): AccessTokenAuthenticator {
  const tokenService = fakeOf<TokenService>({
    verifyAccessToken: () =>
      Promise.resolve({ expiresAt: addMinutes(ISSUED_AT, 15), issuedAt: ISSUED_AT, sub: USER_ID }),
  });
  const usersRepository = fakeOf<UsersRepository>({ findById: () => Promise.resolve(user) });

  return new AccessTokenAuthenticator(tokenService, usersRepository);
}

function userModel(overrides: Partial<UserModel> = {}): UserModel {
  return {
    avatarUrl: null,
    bio: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
    favoriteBookQuote: null,
    favoriteGenres: [],
    id: USER_ID,
    lastName: null,
    name: "Reader",
    nickname: null,
    passwordChangedAt: null,
    passwordHash: "stored-hash",
    role: "user",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("AccessTokenAuthenticator.authenticate", () => {
  it("returns the session when the user never changed the password", async () => {
    const authenticator = buildAuthenticator(userModel());

    const session = await authenticator.authenticate({ token: "signed-access-token" });

    expect(session?.user.id).toBe(USER_ID);
  });

  it("returns null when the password changed after the token was issued", async () => {
    const authenticator = buildAuthenticator(
      userModel({ passwordChangedAt: addSeconds(ISSUED_AT, 1) }),
    );

    const session = await authenticator.authenticate({ token: "signed-access-token" });

    expect(session).toBeNull();
  });

  it("returns the session when the password changed before the token was issued", async () => {
    const authenticator = buildAuthenticator(
      userModel({ passwordChangedAt: subSeconds(ISSUED_AT, 1) }),
    );

    const session = await authenticator.authenticate({ token: "signed-access-token" });

    expect(session?.user.id).toBe(USER_ID);
  });

  it("returns null when the user behind the token no longer exists", async () => {
    const authenticator = buildAuthenticator(null);

    const session = await authenticator.authenticate({ token: "signed-access-token" });

    expect(session).toBeNull();
  });
});
