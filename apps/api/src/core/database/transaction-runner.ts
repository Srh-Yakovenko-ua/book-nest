import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../generated/prisma/client.js";

import { isRetryableTransactionError } from "../prisma-errors.js";
import { PrismaService } from "./prisma.service.js";

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
};

export const HEAVY_TRANSACTION_OPTIONS: TransactionOptions = {
  maxWait: 10_000,
  timeout: 30_000,
};

const MAX_TRANSACTION_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 25;
const RETRY_JITTER_MS = 25;

@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(fn, options);
      } catch (error) {
        if (!isRetryableTransactionError(error) || attempt >= MAX_TRANSACTION_ATTEMPTS) {
          throw error;
        }
        await delayBeforeRetry(attempt);
      }
    }
  }
}

function delayBeforeRetry(attempt: number): Promise<void> {
  const backoff = RETRY_BASE_DELAY_MS * attempt + Math.random() * RETRY_JITTER_MS;
  return new Promise((resolve) => {
    setTimeout(resolve, backoff);
  });
}
