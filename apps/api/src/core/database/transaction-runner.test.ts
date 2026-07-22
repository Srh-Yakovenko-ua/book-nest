import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "./prisma.service.js";

import { HEAVY_TRANSACTION_OPTIONS, TransactionRunner } from "./transaction-runner.js";

function buildRunner(): {
  runner: TransactionRunner;
  transaction: ReturnType<typeof vi.fn>;
} {
  const transaction = vi.fn().mockResolvedValue("result");
  const runner = new TransactionRunner({ $transaction: transaction } as unknown as PrismaService);
  return { runner, transaction };
}

describe("TransactionRunner.run", () => {
  it("forwards the callback with no options by default", async () => {
    const { runner, transaction } = buildRunner();
    const callback = vi.fn(async () => "result");

    await runner.run(callback);

    expect(transaction).toHaveBeenCalledWith(callback, undefined);
  });

  it("passes explicit transaction options through to $transaction", async () => {
    const { runner, transaction } = buildRunner();
    const callback = vi.fn(async () => "result");

    await runner.run(callback, HEAVY_TRANSACTION_OPTIONS);

    expect(transaction).toHaveBeenCalledWith(callback, HEAVY_TRANSACTION_OPTIONS);
  });

  it("defines heavy-transaction bounds above Prisma's 5s/2s defaults", () => {
    expect(HEAVY_TRANSACTION_OPTIONS.timeout).toBeGreaterThan(5_000);
    expect(HEAVY_TRANSACTION_OPTIONS.maxWait).toBeGreaterThan(2_000);
  });
});
