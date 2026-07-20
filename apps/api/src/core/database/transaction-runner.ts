import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../generated/prisma/client.js";

import { PrismaService } from "./prisma.service.js";

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
};

export const HEAVY_TRANSACTION_OPTIONS: TransactionOptions = {
  maxWait: 10_000,
  timeout: 30_000,
};

@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.prisma.$transaction(fn, options);
  }
}
