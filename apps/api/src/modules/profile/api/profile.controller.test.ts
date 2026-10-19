import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { TRUSTED_ORIGIN } from "../../../test/trusted-origin.js";
import { AuthModule } from "../../auth/auth.module.js";
import { MailService } from "../../mail/application/mail.service.js";
import { ProfileModule } from "../profile.module.js";

type SentVerification = { to: string; verificationUrl: string };

const sentVerifications: SentVerification[] = [];

const mailServiceStub = {
  sendPasswordChangedEmail: (): Promise<void> => Promise.resolve(),
  sendPasswordResetEmail: (): Promise<void> => Promise.resolve(),
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
  sendWelcomeEmail: (): Promise<void> => Promise.resolve(),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const reader = {
  email: "reader@example.com",
  name: "Reader",
  nickname: "reader",
  password: "Supersecret123!",
};

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  app = await createTestApp(
    [AuthModule, ProfileModule],
    [{ provide: MailService, useValue: mailServiceStub }],
  );
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  sentVerifications.length = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await app.close();
});

async function registerVerifyAndLogin(overrides: Partial<typeof reader> = {}): Promise<string> {
  const credentials = { ...reader, ...overrides };
  await request(app.getHttpServer()).post("/api/auth/registration").send(credentials);
  const sent = sentVerifications.at(-1);
  if (sent === undefined) throw new Error("verification email not sent");
  await request(app.getHttpServer())
    .post("/api/auth/verify-email")
    .send({ token: tokenFromUrl(sent.verificationUrl) });
  const res = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set("Origin", TRUSTED_ORIGIN)
    .send({ email: credentials.email, password: credentials.password });
  const accessToken = res.body.accessToken;
  if (typeof accessToken !== "string") throw new Error("login did not return an access token");
  return accessToken;
}

function tokenFromUrl(verificationUrl: string): string {
  const token = new URL(verificationUrl).searchParams.get("token");
  if (token === null) throw new Error("token query param missing");
  return token;
}

describe("GET /api/profile", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/profile");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a garbage bearer token", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/profile")
      .set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
  });

  it("returns 200 with the current user profile for a valid token", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toMatch(UUID);
    expect(res.body.email).toBe("reader@example.com");
    expect(res.body.name).toBe("Reader");
    expect(res.body.authProvider).toBe("PASSWORD");
    expect(res.body.emailVerified).toBe(true);
    expect(res.body.favoriteGenres).toEqual([]);
  });

  it("does not leak the password hash or token fields", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("accessToken");
    expect(res.body).not.toHaveProperty("refreshToken");
    expect(res.body).not.toHaveProperty("role");
  });
});

describe("PATCH /api/profile", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).patch("/api/profile").send({ name: "Nope" });

    expect(res.status).toBe(401);
  });

  it("updates name, bio and favoriteGenres and reflects them in the response", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "Reads at night", favoriteGenres: ["sci-fi", "fantasy"], name: "Night Reader" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Night Reader");
    expect(res.body.bio).toBe("Reads at night");
    expect(res.body.favoriteGenres).toEqual(["sci-fi", "fantasy"]);
  });

  it("persists the updated values to the database", async () => {
    const accessToken = await registerVerifyAndLogin();

    await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "Reads at night", name: "Night Reader" });

    const user = await prisma.user.findFirstOrThrow();

    expect(user.name).toBe("Night Reader");
    expect(user.bio).toBe("Reads at night");
  });

  it("trims surrounding whitespace from a bio before storing it", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "  hi  " });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("hi");
  });

  it("strips a leading @ from a nickname before storing it", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "@nightreader" });

    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe("nightreader");
  });

  it("clears a field when an explicit null is sent", async () => {
    const accessToken = await registerVerifyAndLogin();
    await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "temporary" });

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: null });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBeNull();
  });

  it("ignores avatarUrl since it is not part of the update schema", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ avatarUrl: "https://evil.example.com/a.png", name: "Night Reader" });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();

    const user = await prisma.user.findFirstOrThrow();
    expect(user.avatarUrl).toBeNull();
  });

  it("returns 400 when the name is shorter than 2 characters", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("returns 400 when the name is longer than 50 characters", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "x".repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("returns 400 when the name contains HTML tags", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "<b>Reader</b>" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("returns 400 when the bio contains HTML tags", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "<script>alert(1)</script>" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bio" })]),
    );
  });

  it("returns 400 when the bio is longer than 300 characters", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "x".repeat(301) });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bio" })]),
    );
  });

  it("returns 400 when the favoriteBookQuote is longer than 200 characters", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ favoriteBookQuote: "x".repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "favoriteBookQuote" })]),
    );
  });

  it("returns 400 when the dateOfBirth is in the future", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ dateOfBirth: "2999-01-01" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateOfBirth" })]),
    );
  });

  it("returns 400 when more than 10 favoriteGenres are sent", async () => {
    const accessToken = await registerVerifyAndLogin();
    const genres = Array.from({ length: 11 }, (_, index) => `genre-${index}`);

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ favoriteGenres: genres });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "favoriteGenres" })]),
    );
  });

  it("returns 400 when favoriteGenres contains duplicates", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ favoriteGenres: ["sci-fi", "Sci-Fi"] });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "favoriteGenres" })]),
    );
  });

  it("returns 400 when the nickname uses a disallowed character", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "bad nickname!" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nickname" })]),
    );
  });

  it("returns 409 when the nickname is already taken by another user", async () => {
    await registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "takenname",
    });
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "takenname" });

    expect(res.status).toBe(409);
  });
});
