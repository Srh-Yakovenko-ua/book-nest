import { Injectable } from "@nestjs/common";
import { addDays, addMinutes } from "date-fns";
import { SignJWT } from "jose";
import { createHash, randomBytes } from "node:crypto";

import { env } from "../../../config/env.js";

const REFRESH_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_BYTES = 32;
const ACCESS_TOKEN_ALG = "HS256";

@Injectable()
export class TokenService {
  private readonly accessSecret = new TextEncoder().encode(env.jwtAccessSecret);

  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  }

  generateVerificationToken(): string {
    return randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(`${token}${env.jwtRefreshSecret}`).digest("hex");
  }

  hashVerificationToken(token: string): string {
    return createHash("sha256").update(`${token}${env.jwtRefreshSecret}`).digest("hex");
  }

  refreshExpiry(): Date {
    return addDays(new Date(), env.refreshTokenTtlDays);
  }

  signAccessToken(userId: string): Promise<string> {
    return new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALG })
      .setIssuedAt()
      .setExpirationTime(env.accessTokenTtl)
      .sign(this.accessSecret);
  }

  verificationExpiry(): Date {
    return addMinutes(new Date(), env.emailVerificationTtlMinutes);
  }
}
