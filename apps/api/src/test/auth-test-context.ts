import type { INestApplication, InjectionToken, ModuleMetadata } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request, { type Response } from "supertest";

import { MailService } from "../modules/mail/application/mail.service.js";
import { createTestApp } from "./create-test-app.js";
import { TRUSTED_ORIGIN } from "./trusted-origin.js";

export type AuthenticatedUser = {
  accessToken: string;
  userId: string;
};

export type AuthTestContext = {
  app: INestApplication;
  close: () => Promise<void>;
  registerVerifyAndLogin: (overrides?: Partial<RegisterCredentials>) => Promise<AuthenticatedUser>;
  reset: () => void;
};

export type ProviderOverride = {
  provide: InjectionToken;
  useValue: Record<string, unknown>;
};

type RegisterCredentials = {
  email: string;
  name: string;
  nickname: string;
  password: string;
};

type SentVerification = { to: string; verificationUrl: string };

const NICKNAME_SUFFIX_LENGTH = 8;

const defaultCredentials: RegisterCredentials = {
  email: "reader@example.com",
  name: "Reader",
  nickname: "reader",
  password: "Supersecret123!",
};

export async function createAuthTestContext(
  imports: NonNullable<ModuleMetadata["imports"]>,
  extraOverrides: ProviderOverride[] = [],
): Promise<AuthTestContext> {
  const sentVerifications: SentVerification[] = [];

  const mailServiceStub = {
    sendNotificationDigestEmailOrThrow: (): Promise<void> => Promise.resolve(),
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

  const mailOverride = extraOverrides.find((override) => override.provide === MailService);

  const app = await createTestApp(imports, [
    { provide: MailService, useValue: { ...mailServiceStub, ...(mailOverride?.useValue ?? {}) } },
    ...extraOverrides.filter((override) => override.provide !== MailService),
  ]);

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

  async function registerVerifyAndLogin(
    overrides: Partial<RegisterCredentials> = {},
  ): Promise<AuthenticatedUser> {
    const uniqueId = randomUUID().replace(/-/g, "");
    const credentials: RegisterCredentials = {
      ...defaultCredentials,
      email: defaultCredentials.email.replace("@", `+${uniqueId}@`),
      nickname: `${defaultCredentials.nickname}_${uniqueId.slice(0, NICKNAME_SUFFIX_LENGTH)}`,
      ...overrides,
    };

    const registerRes = await request(app.getHttpServer())
      .post("/api/auth/registration")
      .send(credentials);
    if (registerRes.status !== HttpStatus.CREATED) {
      throw new Error(`registration failed — ${describeResponse(registerRes)}`);
    }

    const sent = await waitForVerification(credentials.email);
    const verifyRes = await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token: tokenFromUrl(sent.verificationUrl) });
    if (verifyRes.status !== HttpStatus.OK) {
      throw new Error(`email verification failed — ${describeResponse(verifyRes)}`);
    }

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", TRUSTED_ORIGIN)
      .send({ email: credentials.email, password: credentials.password });

    const accessToken = res.body.accessToken;
    const userId = res.body.user?.id;
    if (typeof accessToken !== "string") throw new Error("login did not return an access token");
    if (typeof userId !== "string") throw new Error("login did not return a user id");
    return { accessToken, userId };
  }

  return {
    app,
    close: () => app.close(),
    registerVerifyAndLogin,
    reset: () => {
      sentVerifications.length = 0;
    },
  };
}

function describeResponse(res: Response): string {
  const contentType = res.headers["content-type"] ?? "no content-type";
  const payload = res.text === "" ? JSON.stringify(res.body) : res.text;
  return `status ${res.status} (${contentType}) from ${res.request.url}: ${payload}`;
}

function tokenFromUrl(verificationUrl: string): string {
  const token = new URL(verificationUrl).searchParams.get("token");
  if (token === null) throw new Error("token query param missing");
  return token;
}
