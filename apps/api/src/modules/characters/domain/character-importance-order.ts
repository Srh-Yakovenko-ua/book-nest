import type { BookCharacterImportance } from "@app/shared";

import { BookCharacterImportanceSchema } from "@app/shared";

export const BOOK_CHARACTER_IMPORTANCE_RANK: Record<BookCharacterImportance, number> = {
  central: 0,
  episodic: 3,
  major: 1,
  mentioned: 4,
  not_specified: 5,
  supporting: 2,
};

export function bookCharacterImportanceRank(importance: string): number {
  return BOOK_CHARACTER_IMPORTANCE_RANK[BookCharacterImportanceSchema.parse(importance)];
}
