import type { INestApplication } from "@nestjs/common";

import { PrismaService } from "../core/database/prisma.service.js";

export async function truncateAllTables(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (rows.length === 0) return;
  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}
