import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { LoginAttemptKeys } from "../domain/login-attempt-policy.js";

import { RedisService } from "../../../core/redis/redis.service.js";
import { LOGIN_ATTEMPT_POLICY } from "../domain/login-attempt-policy.js";

const REGISTER_ATTEMPT_SCRIPT = `
local client = redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], ARGV[1])
local account = redis.call('INCR', KEYS[2])
if account == 1 then
  redis.call('PEXPIRE', KEYS[2], ARGV[1])
end
return { client, account }
`;

const ATTEMPT_KEY_COUNT = 2;

const attemptCountSchema = z.coerce.number().int().nonnegative();
const attemptCountsSchema = z.tuple([attemptCountSchema, attemptCountSchema]);

export type LoginAttemptCounts = {
  account: number;
  client: number;
};

@Injectable()
export class LoginAttemptsRepository {
  constructor(private readonly redis: RedisService) {}

  async clear(keys: LoginAttemptKeys): Promise<void> {
    await this.redis.del(keys.client, keys.account);
  }

  async registerAttempt(keys: LoginAttemptKeys): Promise<LoginAttemptCounts> {
    const counts = await this.redis.eval(
      REGISTER_ATTEMPT_SCRIPT,
      ATTEMPT_KEY_COUNT,
      keys.client,
      keys.account,
      LOGIN_ATTEMPT_POLICY.windowMs,
    );
    const [client, account] = attemptCountsSchema.parse(counts);

    return { account, client };
  }
}
