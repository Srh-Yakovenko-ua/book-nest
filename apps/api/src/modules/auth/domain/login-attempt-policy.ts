import { milliseconds } from "date-fns";
import { createHash } from "node:crypto";

export const LOGIN_ATTEMPT_POLICY = {
  account: { maxAttempts: 50 },
  client: { maxAttempts: 5 },
  windowMs: milliseconds({ minutes: 15 }),
} as const;

export type LoginAttemptIdentity = {
  clientIp: string;
  email: string;
};

export type LoginAttemptKeys = {
  account: string;
  client: string;
};

export function loginAttemptKeys({ clientIp, email }: LoginAttemptIdentity): LoginAttemptKeys {
  const normalizedEmail = email.trim().toLowerCase();

  return {
    account: `login-attempts:account:${digest(normalizedEmail)}`,
    client: `login-attempts:client:${digest(`${normalizedEmail}\n${clientIp}`)}`,
  };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
