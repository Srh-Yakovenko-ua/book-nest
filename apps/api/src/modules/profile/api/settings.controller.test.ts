import type { INestApplication } from "@nestjs/common";

import { defaultUserProfileSettings } from "@app/shared";
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

describe("GET /api/profile/settings", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/profile/settings");

    expect(res.status).toBe(401);
  });

  it("returns 200 with the defaults for a user with no settings row", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(defaultUserProfileSettings);
  });

  it("does not create a settings row when reading defaults", async () => {
    const accessToken = await registerVerifyAndLogin();

    await request(app.getHttpServer())
      .get("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`);

    const count = await prisma.userProfileSettings.count();
    expect(count).toBe(0);
  });

  it("never exposes id, userId, createdAt or updatedAt", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.body).not.toHaveProperty("id");
    expect(res.body).not.toHaveProperty("userId");
    expect(res.body).not.toHaveProperty("createdAt");
    expect(res.body).not.toHaveProperty("updatedAt");
  });
});

describe("PATCH /api/profile/settings", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .send({ themeMode: "dark" });

    expect(res.status).toBe(401);
  });

  it("creates the row, applies the changes and keeps defaults for untouched fields", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accentColor: "green",
        emailNotifications: { weeklyReadingSummary: true },
        themeMode: "dark",
      });

    expect(res.status).toBe(200);
    expect(res.body.themeMode).toBe("dark");
    expect(res.body.accentColor).toBe("green");
    expect(res.body.emailNotifications.weeklyReadingSummary).toBe(true);
    expect(res.body.language).toBe(defaultUserProfileSettings.language);
    expect(res.body.timezone).toBe(defaultUserProfileSettings.timezone);
    expect(res.body.confirmBeforeDelete).toBe(defaultUserProfileSettings.confirmBeforeDelete);
    expect(res.body.emailNotifications.deliveryReminders).toBe(
      defaultUserProfileSettings.emailNotifications.deliveryReminders,
    );
  });

  it("persists the changes so a subsequent GET reflects them", async () => {
    const accessToken = await registerVerifyAndLogin();
    await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accentColor: "green", themeMode: "dark" });

    const res = await request(app.getHttpServer())
      .get("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.themeMode).toBe("dark");
    expect(res.body.accentColor).toBe("green");
  });

  it("updates only the targeted field on the upsert-update path", async () => {
    const accessToken = await registerVerifyAndLogin();
    await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accentColor: "green", themeMode: "dark" });

    const res = await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ language: "en" });

    expect(res.status).toBe(200);
    expect(res.body.language).toBe("en");
    expect(res.body.themeMode).toBe("dark");
    expect(res.body.accentColor).toBe("green");
  });

  it("flips only the targeted notification toggle and retains the others", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ emailNotifications: { deliveryReminders: false } });

    expect(res.status).toBe(200);
    expect(res.body.emailNotifications).toEqual({
      borrowedBookReminders: defaultUserProfileSettings.emailNotifications.borrowedBookReminders,
      deliveryReminders: false,
      monthlyReadingReport: defaultUserProfileSettings.emailNotifications.monthlyReadingReport,
      readingGoalReminders: defaultUserProfileSettings.emailNotifications.readingGoalReminders,
      readingReminders: defaultUserProfileSettings.emailNotifications.readingReminders,
      weeklyReadingSummary: defaultUserProfileSettings.emailNotifications.weeklyReadingSummary,
    });
  });

  it("never exposes id, userId, createdAt or updatedAt", async () => {
    const accessToken = await registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ themeMode: "dark" });

    expect(res.body).not.toHaveProperty("id");
    expect(res.body).not.toHaveProperty("userId");
    expect(res.body).not.toHaveProperty("createdAt");
    expect(res.body).not.toHaveProperty("updatedAt");
  });
});

describe("PATCH /api/profile/settings validation", () => {
  async function patch(body: Record<string, unknown>): Promise<request.Response> {
    const accessToken = await registerVerifyAndLogin();
    return request(app.getHttpServer())
      .patch("/api/profile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  }

  it("returns 400 for an invalid themeMode", async () => {
    const res = await patch({ themeMode: "neon" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "themeMode" })]),
    );
  });

  it("returns 400 for an invalid accentColor", async () => {
    const res = await patch({ accentColor: "pink" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "accentColor" })]),
    );
  });

  it("returns 400 for the currently unsupported language ru", async () => {
    const res = await patch({ language: "ru" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "language" })]),
    );
  });

  it("returns 400 for an invalid dateFormat", async () => {
    const res = await patch({ dateFormat: "bad" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateFormat" })]),
    );
  });

  it("returns 400 for an invalid weekStartDay", async () => {
    const res = await patch({ weekStartDay: "friday" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "weekStartDay" })]),
    );
  });

  it("returns 400 for an invalid libraryViewMode", async () => {
    const res = await patch({ libraryViewMode: "table" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "libraryViewMode" })]),
    );
  });

  it("returns 400 for an empty timezone", async () => {
    const res = await patch({ timezone: "" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "timezone" })]),
    );
  });

  it("returns 400 for a timezone longer than 64 characters", async () => {
    const res = await patch({ timezone: "x".repeat(65) });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "timezone" })]),
    );
  });

  it("returns 400 for a timezone containing HTML", async () => {
    const res = await patch({ timezone: "<script>alert(1)</script>" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "timezone" })]),
    );
  });

  it("returns 400 for a non-boolean confirmBeforeDelete", async () => {
    const res = await patch({ confirmBeforeDelete: "yes" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "confirmBeforeDelete" })]),
    );
  });

  it("returns 400 for a non-boolean notification toggle", async () => {
    const res = await patch({ emailNotifications: { weeklyReadingSummary: "yes" } });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "emailNotifications.weeklyReadingSummary" }),
      ]),
    );
  });
});
