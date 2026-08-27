import { Injectable } from "@nestjs/common";
import { addDays, addMinutes, fromUnixTime } from "date-fns";
import { jwtVerify, SignJWT } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "../../../config/env.js";
import { UnauthorizedError } from "../../../core/exceptions/errors.js";

const TOKEN_BYTES = 32;
const ACCESS_TOKEN_ALG = "HS256";

export const ACCESS_TOKEN_CLAIMS = {
  audience: "book-nest-web",
  issuer: "book-nest-api",
} as const;

const AccessTokenPayloadSchema = z.object({
  exp: z.number().int().positive(),
  jti: z.uuid(),
  sub: z.uuid(),
});

@Injectable()
export class TokenService {
  private readonly accessSecret = new TextEncoder().encode(env.jwtAccessSecret);

  generatePasswordResetToken(): string {
    return this.randomToken();
  }

  generateRefreshToken(): string {
    return this.randomToken();
  }

  generateVerificationToken(): string {
    return this.randomToken();
  }

  hashPasswordResetToken(token: string): string {
    return this.hashToken(token);
  }

  hashRefreshToken(token: string): string {
    return this.hashToken(token);
  }

  hashVerificationToken(token: string): string {
    return this.hashToken(token);
  }

  passwordResetExpiry(): Date {
    return addMinutes(new Date(), env.passwordResetTtlMinutes);
  }

  refreshExpiry(ttlDays: number = env.refreshTokenTtlDays): Date {
    return addDays(new Date(), ttlDays);
  }

  signAccessToken(userId: string): Promise<string> {
    return new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALG })
      .setIssuer(ACCESS_TOKEN_CLAIMS.issuer)
      .setAudience(ACCESS_TOKEN_CLAIMS.audience)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(env.accessTokenTtl)
      .sign(this.accessSecret);
  }

  verificationExpiry(): Date {
    return addMinutes(new Date(), env.emailVerificationTtlMinutes);
  }

  async verifyAccessToken(token: string): Promise<{ expiresAt: Date; sub: string }> {
    let payload: unknown;
    try {
      ({ payload } = await jwtVerify(token, this.accessSecret, {
        algorithms: [ACCESS_TOKEN_ALG],
        audience: ACCESS_TOKEN_CLAIMS.audience,
        issuer: ACCESS_TOKEN_CLAIMS.issuer,
      }));
    } catch {
      throw new UnauthorizedError("Invalid access token");
    }

    const parsed = AccessTokenPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedError("Invalid access token");
    }

    return { expiresAt: fromUnixTime(parsed.data.exp), sub: parsed.data.sub };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(`${token}${env.jwtRefreshSecret}`).digest("hex");
  }

  private randomToken(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
  }
}
