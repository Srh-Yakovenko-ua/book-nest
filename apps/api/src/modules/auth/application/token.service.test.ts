import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { env } from "../../../config/env.js";
import { TokenService } from "./token.service.js";

const service = new TokenService();

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
