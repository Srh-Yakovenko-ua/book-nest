import { Prisma } from "../../generated/prisma/client.js";

export function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function ilikeContains({
  column,
  search,
}: {
  column: Prisma.Sql;
  search: string;
}): Prisma.Sql {
  return Prisma.sql`${column} ILIKE ${toLikePattern(search)} ESCAPE '\\'`;
}

export function toLikePattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}
