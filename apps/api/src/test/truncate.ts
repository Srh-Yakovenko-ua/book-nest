import type { INestApplication } from "@nestjs/common";

import { env } from "../config/env.js";
import { PrismaService } from "../core/database/prisma.service.js";
import { RedisService } from "../core/redis/redis.service.js";
import { deleteKeysUnderPrefix } from "./redis-keys.js";

export async function truncateAllTables(app: INestApplication): Promise<void> {
  await truncateTables(app.get(PrismaService));
  await deleteKeysUnderPrefix({ client: app.get(RedisService), prefix: env.redisKeyPrefix });
}

async function truncateTables(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (rows.length === 0) return;
  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}
