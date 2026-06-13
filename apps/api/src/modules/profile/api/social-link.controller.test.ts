import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";
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
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

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
  const sent = await waitForVerification(credentials.email);
  await request(app.getHttpServer())
    .post("/api/auth/verify-email")
    .send({ token: tokenFromUrl(sent.verificationUrl) });
  const res = await request(app.getHttpServer())
    .post("/api/auth/login")
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

async function waitForVerification(email: string): Promise<SentVerification> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    for (let index = sentVerifications.length - 1; index >= 0; index -= 1) {
      const sent = sentVerifications[index];
      if (sent !== undefined && sent.to === email) return sent;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("verification email not sent");
}

describe("POST /api/profile/social-links", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .send({ platform: "INSTAGRAM", username: "reader" });

    expect(res.status).toBe(401);
  });

  it("creates a link and returns 201 with the SocialLinkView shape", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ label: "My IG", platform: "INSTAGRAM", username: "reader" });

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(UUID);
    expect(res.body.platform).toBe("INSTAGRAM");
    expect(res.body.username).toBe("reader");
    expect(res.body.label).toBe("My IG");
    expect(res.body.url).toBeNull();
  });

  it("strips a leading @ from the username before storing it", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM", username: "@reader" });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe("reader");
  });

  it("persists the created link to the database", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEBSITE", url: "https://reader.example.com" });

    const stored = await prisma.userSocialLink.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.platform).toBe("WEBSITE");
    expect(stored.url).toBe("https://reader.example.com");
  });

  it("returns 400 when neither username nor url is provided", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-https url", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEBSITE", url: "http://reader.example.com" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "url" })]),
    );
  });

  it("returns 400 for a javascript: url", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEBSITE", url: "javascript:alert(1)" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "url" })]),
    );
  });

  it("returns 400 when the username is too short", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM", username: "a" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "username" })]),
    );
  });

  it("returns 400 when the username is too long", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM", username: "x".repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "username" })]),
    );
  });

  it("returns 400 when the label is longer than 40 characters", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ label: "x".repeat(41), platform: "INSTAGRAM", username: "reader" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "label" })]),
    );
  });

  it("returns 400 for an unknown platform", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "MYSPACE", username: "reader" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "platform" })]),
    );
  });

  it("returns 400 when the url is longer than 300 characters", async () => {
    const accessToken = await registerVerifyAndLogin();
    const longUrl = `https://reader.example.com/${"x".repeat(300)}`;

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEBSITE", url: longUrl });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "url" })]),
    );
  });

  it("returns 409 when the non-OTHER platform is already linked", async () => {
    const accessToken = await registerVerifyAndLogin();
    await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM", username: "reader" });

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM", username: "another" });

    expect(res.status).toBe(409);
  });

  it("returns 409 when the url is already added", async () => {
    const accessToken = await registerVerifyAndLogin();
    await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEBSITE", url: "https://reader.example.com" });

    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "OTHER", url: "https://reader.example.com" });

    expect(res.status).toBe(409);
  });

  it("allows a second OTHER link", async () => {
    const accessToken = await registerVerifyAndLogin();

    const first = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "OTHER", url: "https://first.example.com" });
    const second = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "OTHER", url: "https://second.example.com" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("accepts one link for every distinct platform", async () => {
    const accessToken = await registerVerifyAndLogin();
    const platforms = [
      "INSTAGRAM",
      "TIKTOK",
      "TWITTER",
      "THREADS",
      "YOUTUBE",
      "GOODREADS",
      "STORYGRAPH",
      "TELEGRAM",
      "WEBSITE",
      "OTHER",
    ];

    for (const [index, platform] of platforms.entries()) {
      const res = await request(app.getHttpServer())
        .post("/api/profile/social-links")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform, url: `https://link-${index}.example.com` });
      expect(res.status).toBe(201);
    }

    const profile = await request(app.getHttpServer())
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profile.body.socialLinks).toHaveLength(platforms.length);
  });
});

describe("PATCH /api/profile/social-links/:id", () => {
  async function createLink(accessToken: string, body: Record<string, unknown>): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
    if (typeof res.body.id !== "string") throw new Error("create did not return an id");
    return res.body.id;
  }

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${MISSING_UUID}`)
      .send({ username: "renamed" });

    expect(res.status).toBe(401);
  });

  it("updates the username and returns 200 with the new value", async () => {
    const accessToken = await registerVerifyAndLogin();
    const id = await createLink(accessToken, { platform: "INSTAGRAM", username: "reader" });

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: "renamed" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("renamed");
  });

  it("clears a field when an explicit null is sent", async () => {
    const accessToken = await registerVerifyAndLogin();
    const id = await createLink(accessToken, {
      label: "My books",
      platform: "GOODREADS",
      username: "reader",
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ label: null });

    expect(res.status).toBe(200);
    expect(res.body.label).toBeNull();
  });

  it("returns 400 when the update would leave both username and url empty", async () => {
    const accessToken = await registerVerifyAndLogin();
    const id = await createLink(accessToken, { platform: "INSTAGRAM", username: "reader" });

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: null });

    expect(res.status).toBe(400);
  });

  it("returns 409 when switching to a platform another link already holds", async () => {
    const accessToken = await registerVerifyAndLogin();
    await createLink(accessToken, { platform: "INSTAGRAM", username: "reader" });
    const websiteId = await createLink(accessToken, {
      platform: "WEBSITE",
      url: "https://reader.example.com",
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${websiteId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM" });

    expect(res.status).toBe(409);
  });

  it("returns 409 when switching to a url another link already holds", async () => {
    const accessToken = await registerVerifyAndLogin();
    await createLink(accessToken, { platform: "WEBSITE", url: "https://taken.example.com" });
    const otherId = await createLink(accessToken, {
      platform: "OTHER",
      url: "https://other.example.com",
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${otherId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ url: "https://taken.example.com" });

    expect(res.status).toBe(409);
  });

  it("returns 404 for a link owned by another user", async () => {
    const ownerToken = await registerVerifyAndLogin();
    const id = await createLink(ownerToken, { platform: "INSTAGRAM", username: "reader" });
    const intruderToken = await registerVerifyAndLogin({
      email: "intruder@example.com",
      nickname: "intruder",
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${intruderToken}`)
      .send({ username: "hijacked" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent link id", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch(`/api/profile/social-links/${MISSING_UUID}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: "renamed" });

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-UUID id param", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile/social-links/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: "renamed" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/profile/social-links/:id", () => {
  async function createLink(accessToken: string, body: Record<string, unknown>): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
    if (typeof res.body.id !== "string") throw new Error("create did not return an id");
    return res.body.id;
  }

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(
      `/api/profile/social-links/${MISSING_UUID}`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 204 and removes the link", async () => {
    const accessToken = await registerVerifyAndLogin();
    const id = await createLink(accessToken, { platform: "INSTAGRAM", username: "reader" });

    const res = await request(app.getHttpServer())
      .delete(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    const stored = await prisma.userSocialLink.findUnique({ where: { id } });
    expect(stored).toBeNull();
  });

  it("returns 404 when deleting an already-deleted link", async () => {
    const accessToken = await registerVerifyAndLogin();
    const id = await createLink(accessToken, { platform: "INSTAGRAM", username: "reader" });
    await request(app.getHttpServer())
      .delete(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app.getHttpServer())
      .delete(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting a link owned by another user", async () => {
    const ownerToken = await registerVerifyAndLogin();
    const id = await createLink(ownerToken, { platform: "INSTAGRAM", username: "reader" });
    const intruderToken = await registerVerifyAndLogin({
      email: "intruder@example.com",
      nickname: "intruder",
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/profile/social-links/${id}`)
      .set("Authorization", `Bearer ${intruderToken}`);

    expect(res.status).toBe(404);
  });
});

describe("GET /api/profile reflects social links", () => {
  it("returns created links in socialLinks ordered by createdAt ascending", async () => {
    const accessToken = await registerVerifyAndLogin();
    await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "INSTAGRAM", username: "reader" });
    await request(app.getHttpServer())
      .post("/api/profile/social-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEBSITE", url: "https://reader.example.com" });

    const res = await request(app.getHttpServer())
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.socialLinks).toHaveLength(2);
    expect(res.body.socialLinks.map((link: { platform: string }) => link.platform)).toEqual([
      "INSTAGRAM",
      "WEBSITE",
    ]);
  });
});
