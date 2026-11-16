import { Prisma } from "../../../generated/prisma/client.js";

export function readerDaySql({
  instant,
  timeZone,
}: {
  instant: Prisma.Sql;
  timeZone: string;
}): Prisma.Sql {
  return Prisma.sql`(${instant} AT TIME ZONE ${timeZone}::text)::date`;
}
