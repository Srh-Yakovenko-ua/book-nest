import { Prisma } from "../../generated/prisma/client.js";

export const ACTIVE_BOOK_SQL = Prisma.sql`AND book.deleted_at IS NULL`;
