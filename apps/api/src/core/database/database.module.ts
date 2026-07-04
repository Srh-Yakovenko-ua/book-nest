import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service.js";
import { TransactionRunner } from "./transaction-runner.js";

@Global()
@Module({
  exports: [PrismaService, TransactionRunner],
  providers: [PrismaService, TransactionRunner],
})
export class DatabaseModule {}
