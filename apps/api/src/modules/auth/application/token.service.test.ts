import { jwtVerify, SignJWT, UnsecuredJWT } from "jose";
import { describe, expect, it } from "vitest";

import { env } from "../../../config/env.js";
import { UnauthorizedError } from "../../../core/exceptions/errors.js";
import { TokenService } from "./token.service.js";

const service = new TokenService();

const accessSecret = new TextEncoder().encode(env.jwtAccessSecret);
const wrongSecret = new TextEncoder().encode("z".repeat(env.jwtAccessSecret.length));

describe("TokenService.signAccessToken", () => {
  it("produces a JWT verifiable with the access secret carrying the user id as sub", async () => {
    const token = await service.signAccessToken("11111111-1111-4111-8111-111111111111");

    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.jwtAccessSecret));

    expect(payload.sub).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects verification with a wrong secret", async () => {
    const token = await service.signAccessToken("11111111-1111-4111-8111-111111111111");

    await expect(
      jwtVerify(token, new TextEncoder().encode("a".repeat(env.jwtAccessSecret.length))),
    ).rejects.toThrow();
  });
});

describe("TokenService.verifyAccessToken", () => {
  it("returns the sub and the expiry instant for a token it signed itself", async () => {
    const token = await service.signAccessToken("11111111-1111-4111-8111-111111111111");

    const result = await service.verifyAccessToken(token);

    expect(result.sub).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws UnauthorizedError when the payload carries no exp", async () => {
    const token = await new SignJWT({ sub: "11111111-1111-4111-8111-111111111111" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(accessSecret);

    await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for a token signed with a different secret", async () => {
    const token = await new SignJWT({ sub: "11111111-1111-4111-8111-111111111111" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(wrongSecret);

    await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for an expired token", async () => {
    const token = await new SignJWT({ sub: "11111111-1111-4111-8111-111111111111" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(accessSecret);

    await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when the payload has no sub", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(accessSecret);

    await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when sub is an empty string", async () => {
    const token = await new SignJWT({ sub: "" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(accessSecret);

    await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for a garbage string", async () => {
    await expect(service.verifyAccessToken("not-a-jwt")).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for an unsigned alg:none token", async () => {
    const token = new UnsecuredJWT({ sub: "11111111-1111-4111-8111-111111111111" }).encode();

    await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });
});

describe("TokenService.hashRefreshToken", () => {
  it("is deterministic for the same token", () => {
    const first = service.hashRefreshToken("raw-token");
    const second = service.hashRefreshToken("raw-token");

    expect(first).toBe(second);
  });

  it("differs from the raw token", () => {
    const hash = service.hashRefreshToken("raw-token");

    expect(hash).not.toBe("raw-token");
  });

  it("produces a 64-character sha256 hex digest", () => {
    const hash = service.hashRefreshToken("raw-token");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("TokenService.generateRefreshToken", () => {
  it("returns distinct values across calls", () => {
    const first = service.generateRefreshToken();
    const second = service.generateRefreshToken();

    expect(first).not.toBe(second);
  });
});

describe("TokenService.generatePasswordResetToken", () => {
  it("returns distinct values across calls", () => {
    const first = service.generatePasswordResetToken();
    const second = service.generatePasswordResetToken();

    expect(first).not.toBe(second);
  });
});

describe("TokenService.hashPasswordResetToken", () => {
  it("is deterministic for the same token", () => {
    const first = service.hashPasswordResetToken("raw-reset-token");
    const second = service.hashPasswordResetToken("raw-reset-token");

    expect(first).toBe(second);
  });

  it("produces a 64-character sha256 hex digest", () => {
    const hash = service.hashPasswordResetToken("raw-reset-token");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("TokenService.passwordResetExpiry", () => {
  it("returns a future date", () => {
    const expiry = service.passwordResetExpiry();

    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });
});
