import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { MailService } from "../../mail/application/mail.service.js";
import { AuthModule } from "../auth.module.js";

type SentVerification = { to: string; verificationUrl: string };

const sentVerifications: SentVerification[] = [];
let welcomeEmailCount = 0;

const mailServiceStub = {
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
  welcomeEmailCount = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await app.close();
});

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

async function seedVerifiedUser(): Promise<void> {
  const token = await registerAndExtractToken();
  await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });
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

  it("returns 403 when the credentials are correct but the email is unverified", async () => {
    await request(app.getHttpServer()).post("/api/auth/registration").send(validBody);

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: validBody.email, password: validBody.password });

    expect(res.status).toBe(403);
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
