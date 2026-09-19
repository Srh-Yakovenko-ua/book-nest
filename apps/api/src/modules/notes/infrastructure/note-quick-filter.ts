import type { NoteFilter } from "@app/shared";

import { Prisma } from "../../../generated/prisma/client.js";

export const NOTE_QUICK_FILTER_WHERE: Record<NoteFilter, Prisma.NoteWhereInput> = {
  all: {},
  favorite: { isFavorite: true },
  no_spoiler: { isSpoiler: false },
  pinned: { isPinned: true },
  with_spoiler: { isSpoiler: true },
};

export const NOTE_QUICK_FILTER_SQL: Record<NoteFilter, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  favorite: Prisma.sql`note.is_favorite`,
  no_spoiler: Prisma.sql`NOT note.is_spoiler`,
  pinned: Prisma.sql`note.is_pinned`,
  with_spoiler: Prisma.sql`note.is_spoiler`,
};
