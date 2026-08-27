import { Injectable } from "@nestjs/common";

import type { LoginAttemptIdentity } from "../domain/login-attempt-policy.js";

import { TooManyRequestsError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { LOGIN_ATTEMPT_POLICY, loginAttemptKeys } from "../domain/login-attempt-policy.js";
import { LoginAttemptsRepository } from "../infrastructure/login-attempts.repository.js";

const LOGIN_LOCKED = {
  code: "login_locked",
  message: "Too many failed sign-in attempts, try again later",
} as const;

const log = createLogger("auth.login-attempt-limiter");

@Injectable()
export class LoginAttemptLimiter {
  constructor(private readonly loginAttemptsRepository: LoginAttemptsRepository) {}

  async assertAttemptAllowed(identity: LoginAttemptIdentity): Promise<void> {
    const counts = await this.loginAttemptsRepository.registerAttempt(loginAttemptKeys(identity));
    const clientLocked = counts.client > LOGIN_ATTEMPT_POLICY.client.maxAttempts;
    const accountLocked = counts.account > LOGIN_ATTEMPT_POLICY.account.maxAttempts;
    if (!clientLocked && !accountLocked) return;

    log.warn(
      { accountAttempts: counts.account, clientAttempts: counts.client },
      "sign-in blocked after repeated attempts",
    );
    throw new TooManyRequestsError(LOGIN_LOCKED.message, { code: LOGIN_LOCKED.code });
  }

  async clear(identity: LoginAttemptIdentity): Promise<void> {
    await this.loginAttemptsRepository.clear(loginAttemptKeys(identity));
  }
}
