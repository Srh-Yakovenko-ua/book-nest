import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { MailService } from "../../mail/application/mail.service.js";
import { AuthModule } from "../auth.module.js";

type SentReset = { resetPasswordUrl: string; to: string };
type SentVerification = { to: string; verificationUrl: string };

const sentVerifications: SentVerification[] = [];
const sentResets: SentReset[] = [];
let welcomeEmailCount = 0;
let passwordChangedCount = 0;

const mailServiceStub = {
  sendPasswordChangedEmail: (): Promise<void> => {
    passwordChangedCount += 1;
    return Promise.resolve();
  },
  sendPasswordResetEmail: ({
    resetPasswordUrl,
    to,
  }: {
    resetPasswordUrl: string;
    to: string;
  }): Promise<void> => {
    sentResets.push({ resetPasswordUrl, to });
    return Promise.resolve();
  },
  sendVerificationEmail: ({
    to,
    verificationUrl,
  }: {
    to: string;
    verificationUrl: string;
  }): Promise<void> => {
    sentVerifications.push({ to, verificationUrl });
    return Promise.resolve();
  },
  sendWelcomeEmail: (): Promise<void> => {
    welcomeEmailCount += 1;
    return Promise.resolve();
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const validBody = {
  email: "reader@example.com",
  name: "Reader",
  nickname: "reader",
  password: "Supersecret123!",
};

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  app = await createTestApp([AuthModule], [{ provide: MailService, useValue: mailServiceStub }]);
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  sentVerifications.length = 0;
  sentResets.length = 0;
  welcomeEmailCount = 0;
  passwordChangedCount = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await app.close();
});

function cookieMaxAgeSeconds(cookie: string): number {
  const match = /max-age=(\d+)/i.exec(cookie);
  if (match?.[1] === undefined) throw new Error("refresh_token cookie has no Max-Age");
  return Number(match[1]);
}

function cookieValue(cookie: string): string {
  const pair = cookie.split(";")[0];
  if (pair === undefined) throw new Error("empty cookie");
  return pair;
}

async function loginAndExtractCookie(rememberMe?: boolean): Promise<string> {
  await seedVerifiedUser();
  await prisma.session.deleteMany();
  const res = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email: validBody.email, password: validBody.password, rememberMe });
  return readRefreshCookie(res.headers["set-cookie"]);
}

function readRefreshCookie(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie : setCookie === undefined ? [] : [setCookie];
  const cookie = header.find((entry) => entry.startsWith("refresh_token="));
  if (cookie === undefined) throw new Error("refresh_token cookie not set");
  return cookie;
}

async function registerAndExtractToken(): Promise<string> {
  await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);
  const sent = sentVerifications.at(-1);
  if (sent === undefined) throw new Error("verification email not sent");
  return tokenFromUrl(sent.verificationUrl);
}

async function requestResetToken(): Promise<string> {
  await request(app.getHttpServer())
    .post("/api/auth/forgot-password")
    .send({ email: validBody.email });
  const sent = sentResets.at(-1);
  if (sent === undefined) throw new Error("reset email not sent");
  return tokenFromUrl(sent.resetPasswordUrl);
}

async function seedVerifiedUser(): Promise<void> {
  const token = await registerAndExtractToken();
  await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });
}

async function seedVerifiedUserAndLoginToken(): Promise<string> {
  await seedVerifiedUser();
  const res = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email: validBody.email, password: validBody.password });
  const accessToken = res.body.accessToken;
  if (typeof accessToken !== "string") throw new Error("login did not return an access token");
  return accessToken;
}

function tokenFromUrl(verificationUrl: string): string {
  const token = new URL(verificationUrl).searchParams.get("token");
  if (token === null) throw new Error("token query param missing");
  return token;
}

describe("POST /api/auth/registration", () => {
  it("returns 201 with a verification_sent status and no access token", async () => {
    const res = await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ email: "reader@example.com", status: "verification_sent" });
    expect(res.body).not.toHaveProperty("accessToken");
  });

  it("does not set a refresh_token cookie", async () => {
    const res = await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("persists one unverified user row and one verification token row, no session", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    const user = await prisma.user.findFirstOrThrow();
    const tokenCount = await prisma.emailVerificationToken.count();
    const sessionCount = await prisma.session.count();

    expect(user.emailVerifiedAt).toBeNull();
    expect(tokenCount).toBe(1);
    expect(sessionCount).toBe(0);
  });

  it("fires the verification email and not the welcome email", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    expect(sentVerifications).toHaveLength(1);
    expect(welcomeEmailCount).toBe(0);
  });

  it("registers successfully when the optional nickname and dateOfBirth are omitted", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ email: validBody.email, name: validBody.name, password: validBody.password });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("verification_sent");
  });

  it("returns 400 with a name field error when the name is missing", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ email: validBody.email, password: validBody.password });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("returns 400 with an email field error when the email is malformed", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ ...validBody, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });

  it("returns 400 with a password field error when the password is too short", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ ...validBody, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  it("returns 400 with a password field error when the password lacks complexity", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ ...validBody, password: "alllowercase" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  it("returns 400 with an email field error when a verified email is re-registered", async () => {
    const token = await registerAndExtractToken();
    await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ ...validBody, nickname: "another" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });

  it("overwrites a stale unverified account when the same email registers again", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    const res = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ ...validBody, name: "Second Reader" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ email: "reader@example.com", status: "verification_sent" });

    const userCount = await prisma.user.count();
    const user = await prisma.user.findFirstOrThrow();

    expect(userCount).toBe(1);
    expect(user.name).toBe("Second Reader");
  });

  it("keeps a single user row and one token when a verified email re-registration is rejected", async () => {
    const token = await registerAndExtractToken();
    await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send({ ...validBody, nickname: "another" });

    const userCount = await prisma.user.count();

    expect(userCount).toBe(1);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("returns 200 with an access token and a verified user view", async () => {
    const token = await registerAndExtractToken();

    const res = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.id).toMatch(UUID);
    expect(res.body.user.email).toBe("reader@example.com");
    expect(res.body.user.emailVerified).toBe(true);
  });

  it("sets an httpOnly refresh_token cookie scoped to /api/auth", async () => {
    const token = await registerAndExtractToken();

    const res = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    const cookie = readRefreshCookie(res.headers["set-cookie"]);

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it("marks the user verified, deletes the token and opens a session", async () => {
    const token = await registerAndExtractToken();

    await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    const user = await prisma.user.findFirstOrThrow();
    const tokenCount = await prisma.emailVerificationToken.count();
    const sessionCount = await prisma.session.count();

    expect(user.emailVerifiedAt).not.toBeNull();
    expect(tokenCount).toBe(0);
    expect(sessionCount).toBe(1);
  });

  it("fires the welcome email after verification", async () => {
    const token = await registerAndExtractToken();

    await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    expect(welcomeEmailCount).toBe(1);
  });

  it("returns 400 when the token is unknown", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token: "does-not-exist" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the same token is reused after a successful verification", async () => {
    const token = await registerAndExtractToken();
    await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    const res = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 with an access token and a verified user view for correct credentials", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.id).toMatch(UUID);
    expect(res.body.user.email).toBe("reader@example.com");
    expect(res.body.user.emailVerified).toBe(true);
  });

  it("sets an httpOnly refresh_token cookie scoped to /api/auth on success", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password });

    const cookie = readRefreshCookie(res.headers["set-cookie"]);

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it("opens a session row on successful login", async () => {
    await seedVerifiedUser();

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password });

    const sessionCount = await prisma.session.count();

    expect(sessionCount).toBe(2);
  });

  it("returns only the access token and user view in the body", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password, rememberMe: true });

    expect(Object.keys(res.body).sort()).toEqual(["accessToken", "user"]);
  });

  it("sets the refresh cookie Max-Age to the short TTL when rememberMe is omitted", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password });

    const maxAge = cookieMaxAgeSeconds(readRefreshCookie(res.headers["set-cookie"]));

    expect(maxAge).toBe(env.refreshTokenTtlDaysShort * 24 * 60 * 60);
  });

  it("sets the refresh cookie Max-Age to the short TTL when rememberMe is false", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password, rememberMe: false });

    const maxAge = cookieMaxAgeSeconds(readRefreshCookie(res.headers["set-cookie"]));

    expect(maxAge).toBe(env.refreshTokenTtlDaysShort * 24 * 60 * 60);
  });

  it("sets the refresh cookie Max-Age to the long TTL when rememberMe is true", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password, rememberMe: true });

    const maxAge = cookieMaxAgeSeconds(readRefreshCookie(res.headers["set-cookie"]));

    expect(maxAge).toBe(env.refreshTokenTtlDays * 24 * 60 * 60);
  });

  it("persists a short-TTL session expiry when rememberMe is false", async () => {
    await seedVerifiedUser();
    await prisma.session.deleteMany();

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password, rememberMe: false });

    const session = await prisma.session.findFirstOrThrow();
    const ttlDays = (session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);

    expect(ttlDays).toBeGreaterThan(env.refreshTokenTtlDaysShort - 0.1);
    expect(ttlDays).toBeLessThanOrEqual(env.refreshTokenTtlDaysShort + 0.1);
  });

  it("persists a long-TTL session expiry when rememberMe is true", async () => {
    await seedVerifiedUser();
    await prisma.session.deleteMany();

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password, rememberMe: true });

    const session = await prisma.session.findFirstOrThrow();
    const ttlDays = (session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);

    expect(ttlDays).toBeGreaterThan(env.refreshTokenTtlDays - 0.1);
    expect(ttlDays).toBeLessThanOrEqual(env.refreshTokenTtlDays + 0.1);
  });

  it("returns 401 with an empty body for a wrong password", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: "Wrongpassword123!" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({});
  });

  it("does not set a refresh_token cookie when the password is wrong", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: "Wrongpassword123!" });

    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("returns 401 for an unknown email", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: validBody.password });

    expect(res.status).toBe(401);
  });

  it("returns 403 with an email_not_verified code when the email is unverified", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
  });

  it("returns 400 with a password field error when the password is missing", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  it("returns 400 with an email field error when the email is malformed", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: validBody.password });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns 200 with a new access token and the user view for a valid cookie", async () => {
    const cookie = await loginAndExtractCookie();

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.id).toMatch(UUID);
    expect(res.body.user.email).toBe("reader@example.com");
  });

  it("rotates the cookie to a new refresh_token value", async () => {
    const cookie = await loginAndExtractCookie();

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    const rotated = readRefreshCookie(res.headers["set-cookie"]);

    expect(cookieValue(rotated)).not.toBe(cookieValue(cookie));
  });

  it("tombstones the old session row and persists a new live one", async () => {
    const cookie = await loginAndExtractCookie();

    await request(app.getHttpServer()).post("/api/auth/refresh").set("Cookie", cookieValue(cookie));

    const tombstoned = await prisma.session.count({ where: { rotatedAt: { not: null } } });
    const live = await prisma.session.count({ where: { rotatedAt: null } });

    expect(tombstoned).toBe(1);
    expect(live).toBe(1);
  });

  it("carries the original absolute expiry forward instead of resetting it on rotation", async () => {
    const cookie = await loginAndExtractCookie(false);
    const before = await prisma.session.findFirstOrThrow({ where: { rotatedAt: null } });

    await request(app.getHttpServer()).post("/api/auth/refresh").set("Cookie", cookieValue(cookie));

    const after = await prisma.session.findFirstOrThrow({ where: { rotatedAt: null } });

    expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
  });

  it("sets the rotated cookie Max-Age to the remaining short-session time, not the long TTL", async () => {
    const cookie = await loginAndExtractCookie(false);

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    const maxAge = cookieMaxAgeSeconds(readRefreshCookie(res.headers["set-cookie"]));
    const shortTtlSeconds = env.refreshTokenTtlDaysShort * 24 * 60 * 60;
    const longTtlSeconds = env.refreshTokenTtlDays * 24 * 60 * 60;

    expect(maxAge).toBeLessThanOrEqual(shortTtlSeconds);
    expect(maxAge).toBeGreaterThan(shortTtlSeconds - 60);
    expect(maxAge).toBeLessThan(longTtlSeconds);
  });

  it("keeps a rememberMe:false session under one day even after refreshing", async () => {
    const cookie = await loginAndExtractCookie(false);

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    const maxAgeDays = cookieMaxAgeSeconds(readRefreshCookie(res.headers["set-cookie"])) / 86400;

    expect(maxAgeDays).toBeLessThanOrEqual(env.refreshTokenTtlDaysShort);
  });

  it("caps the rotated cookie Max-Age below the full long TTL for a rememberMe:true session", async () => {
    const cookie = await loginAndExtractCookie(true);

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    const maxAge = cookieMaxAgeSeconds(readRefreshCookie(res.headers["set-cookie"]));
    const longTtlSeconds = env.refreshTokenTtlDays * 24 * 60 * 60;

    expect(maxAge).toBeLessThanOrEqual(longTtlSeconds);
    expect(maxAge).toBeGreaterThan(longTtlSeconds - 60);
  });

  it("returns 401 and wipes every session when a pre-rotation cookie is replayed", async () => {
    const cookie = await loginAndExtractCookie();
    const user = await prisma.user.findFirstOrThrow();

    await request(app.getHttpServer()).post("/api/auth/refresh").set("Cookie", cookieValue(cookie));

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    const sessionCount = await prisma.session.count({ where: { userId: user.id } });

    expect(res.status).toBe(401);
    expect(sessionCount).toBe(0);
  });

  it("returns 401 when no refresh cookie is present", async () => {
    const res = await request(app.getHttpServer()).post("/api/auth/refresh");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 with a logged_out status and clears the refresh cookie", async () => {
    const cookie = await loginAndExtractCookie();

    const res = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Cookie", cookieValue(cookie));

    const cleared = readRefreshCookie(res.headers["set-cookie"]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "logged_out" });
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("deletes the session row for the presented token", async () => {
    const cookie = await loginAndExtractCookie();

    await request(app.getHttpServer()).post("/api/auth/logout").set("Cookie", cookieValue(cookie));

    const sessionCount = await prisma.session.count();

    expect(sessionCount).toBe(0);
  });

  it("invalidates the cookie so a later refresh with it returns 401", async () => {
    const cookie = await loginAndExtractCookie();

    await request(app.getHttpServer()).post("/api/auth/logout").set("Cookie", cookieValue(cookie));

    const res = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", cookieValue(cookie));

    expect(res.status).toBe(401);
  });

  it("returns 200 with a logged_out status when no cookie is present", async () => {
    const res = await request(app.getHttpServer()).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "logged_out" });
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("returns 200 with a generic verification_sent status for a known unverified user", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);
    sentVerifications.length = 0;

    const res = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: validBody.email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "verification_sent" });
  });

  it("returns 200 with the same generic status for an unknown email and sends nothing", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "verification_sent" });
    expect(sentVerifications).toHaveLength(0);
  });

  it("does not send a second email when resent within the cooldown window", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);
    sentVerifications.length = 0;

    const first = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: validBody.email });
    const second = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: validBody.email });

    expect(first.body).toEqual({ status: "verification_sent" });
    expect(second.body).toEqual({ status: "verification_sent" });
    expect(sentVerifications).toHaveLength(0);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns 200 with a generic reset_email_sent status for a verified user", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email: validBody.email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "reset_email_sent" });
  });

  it("creates exactly one password reset token row for a verified user", async () => {
    await seedVerifiedUser();

    await request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email: validBody.email });

    const tokenCount = await prisma.passwordResetToken.count();

    expect(tokenCount).toBe(1);
  });

  it("returns the same generic status for an unknown email and creates no token", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" });

    const tokenCount = await prisma.passwordResetToken.count();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "reset_email_sent" });
    expect(tokenCount).toBe(0);
  });
});

describe("POST /api/auth/reset-password", () => {
  const newPassword = "Brandnewpass123!";

  it("returns 200 with a password_reset status for a valid token", async () => {
    await seedVerifiedUser();
    const token = await requestResetToken();

    const res = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "password_reset" });
  });

  it("changes the stored password hash, consumes the token and clears all sessions", async () => {
    await seedVerifiedUser();
    const before = await prisma.user.findFirstOrThrow();
    const token = await requestResetToken();

    await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token });

    const after = await prisma.user.findFirstOrThrow();
    const tokenCount = await prisma.passwordResetToken.count();
    const sessionCount = await prisma.session.count();

    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(tokenCount).toBe(0);
    expect(sessionCount).toBe(0);
  });

  it("does not set a refresh_token cookie", async () => {
    await seedVerifiedUser();
    const token = await requestResetToken();

    const res = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token });

    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("fires the password changed email after a successful reset", async () => {
    await seedVerifiedUser();
    const token = await requestResetToken();

    await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token });

    expect(passwordChangedCount).toBe(1);
  });

  it("returns 400 when an already consumed token is reused", async () => {
    await seedVerifiedUser();
    const token = await requestResetToken();

    await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token });

    const res = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown token", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: newPassword, token: "does-not-exist" });

    expect(res.status).toBe(400);
  });

  it("returns 400 with a password field error when the new password lacks complexity", async () => {
    await seedVerifiedUser();
    const token = await requestResetToken();

    const res = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ password: "alllowercase", token });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });
});

describe("GET /api/auth/me", () => {
  it("returns 200 with the authenticated user view for a valid bearer token", async () => {
    const accessToken = await seedVerifiedUserAndLoginToken();

    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(UUID);
    expect(res.body.email).toBe("reader@example.com");
    expect(res.body.role).toBe("user");
    expect(res.body.emailVerified).toBe(true);
  });

  it("does not leak the password hash or any token fields", async () => {
    const accessToken = await seedVerifiedUserAndLoginToken();

    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("accessToken");
    expect(res.body).not.toHaveProperty("refreshToken");
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a garbage token", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a non-Bearer scheme", async () => {
    const accessToken = await seedVerifiedUserAndLoginToken();

    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Basic ${accessToken}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 for a raw token without the Bearer scheme", async () => {
    const accessToken = await seedVerifiedUserAndLoginToken();

    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", accessToken);

    expect(res.status).toBe(401);
  });

  it("returns 401 when the user was deleted after the token was issued", async () => {
    const accessToken = await seedVerifiedUserAndLoginToken();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
  });

  it("reflects fresh user state when the role changes after the token was issued", async () => {
    const accessToken = await seedVerifiedUserAndLoginToken();
    await prisma.user.updateMany({ data: { role: "super_admin" } });

    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("super_admin");
  });
});

describe("GET /api/auth/nickname-available", () => {
  it("returns 200 with available true for a nickname nobody has claimed", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/nickname-available")
      .query({ nickname: "freenick" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true });
  });

  it("returns available false for a nickname an existing user already holds", async () => {
    await seedVerifiedUser();

    const res = await request(app.getHttpServer())
      .get("/api/auth/nickname-available")
      .query({ nickname: validBody.nickname });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  it("returns 400 when the nickname is too short", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/nickname-available")
      .query({ nickname: "ab" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nickname" })]),
    );
  });

  it("returns 400 when the nickname starts with an underscore", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/nickname-available")
      .query({ nickname: "_bad" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nickname" })]),
    );
  });

  it("returns 400 when the nickname contains consecutive dots", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/nickname-available")
      .query({ nickname: "a..b" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nickname" })]),
    );
  });

  it("returns 400 when the nickname query parameter is missing", async () => {
    const res = await request(app.getHttpServer()).get("/api/auth/nickname-available");

    expect(res.status).toBe(400);
  });
});
