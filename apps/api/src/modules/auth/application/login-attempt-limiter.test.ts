import { describe, expect, it } from "vitest";

import type { LoginAttemptKeys } from "../domain/login-attempt-policy.js";
import type {
  LoginAttemptCounts,
  LoginAttemptsRepository,
} from "../infrastructure/login-attempts.repository.js";

import { TooManyRequestsError } from "../../../core/exceptions/errors.js";
import { LOGIN_ATTEMPT_POLICY } from "../domain/login-attempt-policy.js";
import { LoginAttemptLimiter } from "./login-attempt-limiter.js";

const READER = { clientIp: "203.0.113.10", email: "reader@example.com" };
const OTHER_CLIENT = { clientIp: "198.51.100.7", email: "reader@example.com" };
const OTHER_ACCOUNT = { clientIp: "203.0.113.10", email: "other@example.com" };

type Harness = {
  limiter: LoginAttemptLimiter;
  storedKeys: () => string[];
};

async function attempt({
  count,
  identity,
  limiter,
}: {
  count: number;
  identity: { clientIp: string; email: string };
  limiter: LoginAttemptLimiter;
}): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await limiter.assertAttemptAllowed(identity).catch(() => undefined);
  }
}

function buildLimiter(): Harness {
  const attempts = new Map<string, number>();
  const bump = (key: string): number => {
    const next = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, next);
    return next;
  };

  const loginAttemptsRepository = {
    clear: (keys: LoginAttemptKeys): Promise<void> => {
      attempts.delete(keys.client);
      attempts.delete(keys.account);
      return Promise.resolve();
    },
    registerAttempt: (keys: LoginAttemptKeys): Promise<LoginAttemptCounts> =>
      Promise.resolve({ account: bump(keys.account), client: bump(keys.client) }),
  } as unknown as LoginAttemptsRepository;

  return {
    limiter: new LoginAttemptLimiter(loginAttemptsRepository),
    storedKeys: () => [...attempts.keys()],
  };
}

describe("LoginAttemptLimiter", () => {
  it("allows attempts up to the per-client threshold", async () => {
    const { limiter } = buildLimiter();

    await attempt({
      count: LOGIN_ATTEMPT_POLICY.client.maxAttempts - 1,
      identity: READER,
      limiter,
    });

    await expect(limiter.assertAttemptAllowed(READER)).resolves.toBeUndefined();
  });

  it("locks the client once its attempts pass the threshold", async () => {
    const { limiter } = buildLimiter();

    await attempt({ count: LOGIN_ATTEMPT_POLICY.client.maxAttempts, identity: READER, limiter });

    await expect(limiter.assertAttemptAllowed(READER)).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("codes the lock as login_locked so the client can tell it apart from a wrong password", async () => {
    const { limiter } = buildLimiter();

    await attempt({ count: LOGIN_ATTEMPT_POLICY.client.maxAttempts, identity: READER, limiter });
    const error = await limiter.assertAttemptAllowed(READER).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect((error as TooManyRequestsError).code).toBe("login_locked");
  });

  it("leaves the same account open from another client while it stays under the account cap", async () => {
    const { limiter } = buildLimiter();

    await attempt({ count: LOGIN_ATTEMPT_POLICY.client.maxAttempts, identity: READER, limiter });

    await expect(limiter.assertAttemptAllowed(OTHER_CLIENT)).resolves.toBeUndefined();
  });

  it("locks the account for every client once the account cap is passed", async () => {
    const { limiter } = buildLimiter();

    await attempt({ count: LOGIN_ATTEMPT_POLICY.account.maxAttempts, identity: READER, limiter });

    await expect(limiter.assertAttemptAllowed(OTHER_CLIENT)).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );
  });

  it("clears both counters so a locked client can sign in again", async () => {
    const { limiter } = buildLimiter();

    await attempt({ count: LOGIN_ATTEMPT_POLICY.client.maxAttempts, identity: READER, limiter });
    await limiter.clear(READER);

    await expect(limiter.assertAttemptAllowed(READER)).resolves.toBeUndefined();
  });

  it("counts attempts per account and leaves other accounts unlocked", async () => {
    const { limiter } = buildLimiter();

    await attempt({ count: LOGIN_ATTEMPT_POLICY.client.maxAttempts, identity: READER, limiter });

    await expect(limiter.assertAttemptAllowed(OTHER_ACCOUNT)).resolves.toBeUndefined();
  });

  it("treats a differently cased email as the same account", async () => {
    const { limiter } = buildLimiter();

    await attempt({
      count: LOGIN_ATTEMPT_POLICY.client.maxAttempts,
      identity: { ...READER, email: READER.email.toUpperCase() },
      limiter,
    });

    await expect(limiter.assertAttemptAllowed(READER)).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("never stores the raw email or ip in a counter key", async () => {
    const { limiter, storedKeys } = buildLimiter();

    await limiter.assertAttemptAllowed(READER);

    expect(storedKeys()).toHaveLength(2);
    for (const key of storedKeys()) {
      expect(key).toMatch(/^login-attempts:(account|client):[0-9a-f]{64}$/);
      expect(key).not.toContain(READER.email);
      expect(key).not.toContain(READER.clientIp);
    }
  });
});
