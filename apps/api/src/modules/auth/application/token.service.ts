import { Injectable } from "@nestjs/common";
import { addDays, addMinutes } from "date-fns";
import { SignJWT } from "jose";
import { createHash, randomBytes } from "node:crypto";

import { env } from "../../../config/env.js";

const TOKEN_BYTES = 32;
const ACCESS_TOKEN_ALG = "HS256";

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

  private hashToken(token: string): string {
    return createHash("sha256").update(`${token}${env.jwtRefreshSecret}`).digest("hex");
  }

  private randomToken(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
  }
}
