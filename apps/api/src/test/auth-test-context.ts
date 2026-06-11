import type { INestApplication, ModuleMetadata } from "@nestjs/common";

import request from "supertest";

import { MailService } from "../modules/mail/application/mail.service.js";
import { createTestApp } from "./create-test-app.js";

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

type RegisterCredentials = {
  email: string;
  name: string;
  nickname: string;
  password: string;
};

type SentVerification = { to: string; verificationUrl: string };

const defaultCredentials: RegisterCredentials = {
  email: "reader@example.com",
  name: "Reader",
  nickname: "reader",
  password: "Supersecret123!",
};

export async function createAuthTestContext(
  imports: NonNullable<ModuleMetadata["imports"]>,
): Promise<AuthTestContext> {
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

  const app = await createTestApp(imports, [{ provide: MailService, useValue: mailServiceStub }]);

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
    const credentials = { ...defaultCredentials, ...overrides };
    await request(app.getHttpServer()).post("/api/auth/registration").send(credentials);
    const sent = await waitForVerification(credentials.email);
    await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token: tokenFromUrl(sent.verificationUrl) });

    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
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

function tokenFromUrl(verificationUrl: string): string {
  const token = new URL(verificationUrl).searchParams.get("token");
  if (token === null) throw new Error("token query param missing");
  return token;
}
