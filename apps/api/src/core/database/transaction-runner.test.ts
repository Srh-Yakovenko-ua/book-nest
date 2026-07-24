import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "./prisma.service.js";

import { Prisma } from "../../generated/prisma/client.js";
import { HEAVY_TRANSACTION_OPTIONS, TransactionRunner } from "./transaction-runner.js";

function buildRunner(): {
  runner: TransactionRunner;
  transaction: ReturnType<typeof vi.fn>;
} {
  const transaction = vi.fn().mockResolvedValue("result");
  const runner = new TransactionRunner({ $transaction: transaction } as unknown as PrismaService);
  return { runner, transaction };
}

function runnerWith(transaction: ReturnType<typeof vi.fn>): TransactionRunner {
  return new TransactionRunner({ $transaction: transaction } as unknown as PrismaService);
}

function writeConflictError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("write conflict", {
    clientVersion: "test",
    code: "P2034",
  });
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

  it("retries a write conflict and returns the result of a later attempt", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(writeConflictError())
      .mockRejectedValueOnce(writeConflictError())
      .mockResolvedValueOnce("result");
    const runner = runnerWith(transaction);

    await expect(runner.run(vi.fn(async () => "result"))).resolves.toBe("result");
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("gives up after three write-conflict attempts and rethrows the conflict", async () => {
    const transaction = vi.fn().mockRejectedValue(writeConflictError());
    const runner = runnerWith(transaction);

    await expect(runner.run(vi.fn(async () => "result"))).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry an error that is not a write conflict", async () => {
    const failure = new Error("boom");
    const transaction = vi.fn().mockRejectedValue(failure);
    const runner = runnerWith(transaction);

    await expect(runner.run(vi.fn(async () => "result"))).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
