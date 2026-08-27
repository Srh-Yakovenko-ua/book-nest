import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { LoginAttemptKeys } from "../domain/login-attempt-policy.js";

import { RedisService } from "../../../core/redis/redis.service.js";
import { LOGIN_ATTEMPT_POLICY } from "../domain/login-attempt-policy.js";
import { LoginAttemptsRepository } from "./login-attempts.repository.js";

let redis: RedisService;
let repository: LoginAttemptsRepository;
let keys: LoginAttemptKeys;

beforeAll(() => {
  redis = new RedisService();
  repository = new LoginAttemptsRepository(redis);
});

beforeEach(() => {
  const suffix = randomUUID();
  keys = {
    account: `login-attempts:account:${suffix}`,
    client: `login-attempts:client:${suffix}`,
  };
});

afterEach(async () => {
  await repository.clear(keys);
});

afterAll(async () => {
  await redis.quit();
});

describe("LoginAttemptsRepository", () => {
  it("counts the first attempt on both keys and arms both windows", async () => {
    const counts = await repository.registerAttempt(keys);
    const clientTtl = await redis.pttl(keys.client);
    const accountTtl = await redis.pttl(keys.account);

    expect(counts).toEqual({ account: 1, client: 1 });
    expect(clientTtl).toBeGreaterThan(0);
    expect(clientTtl).toBeLessThanOrEqual(LOGIN_ATTEMPT_POLICY.windowMs);
    expect(accountTtl).toBeGreaterThan(0);
    expect(accountTtl).toBeLessThanOrEqual(LOGIN_ATTEMPT_POLICY.windowMs);
  });

  it("re-arms the client window on every attempt but leaves the account window anchored", async () => {
    await repository.registerAttempt(keys);
    await redis.pexpire(keys.client, 1_000);
    await redis.pexpire(keys.account, 1_000);

    const counts = await repository.registerAttempt(keys);
    const clientTtl = await redis.pttl(keys.client);
    const accountTtl = await redis.pttl(keys.account);

    expect(counts).toEqual({ account: 2, client: 2 });
    expect(clientTtl).toBeGreaterThan(1_000);
    expect(accountTtl).toBeLessThanOrEqual(1_000);
  });

  it("starts over from one after the keys are cleared", async () => {
    await repository.registerAttempt(keys);
    await repository.registerAttempt(keys);
    await repository.clear(keys);

    await expect(repository.registerAttempt(keys)).resolves.toEqual({ account: 1, client: 1 });
  });
});
