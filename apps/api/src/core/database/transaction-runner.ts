import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../generated/prisma/client.js";

import { PrismaService } from "./prisma.service.js";

@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
