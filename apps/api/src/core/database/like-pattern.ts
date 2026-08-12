import { Prisma } from "../../generated/prisma/client.js";

export function ilikeContains({
  column,
  search,
}: {
  column: Prisma.Sql;
  search: string;
}): Prisma.Sql {
  return Prisma.sql`${column} ILIKE ${`%${escapeLikePattern(search)}%`} ESCAPE '\\'`;
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
