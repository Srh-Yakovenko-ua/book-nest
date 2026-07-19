import type { CharacterTheoryStatus, CharacterTheoryView, Nullable } from "@app/shared";

import { CharacterTheoryStatusSchema } from "@app/shared";

export type CharacterTheorySource = {
  book: Nullable<{ id: string; title: string }>;
  character: Nullable<{ deletedAt: Nullable<Date>; id: string; name: string }>;
  createdAt: Date;
  id: string;
  isSpoiler: boolean;
  series: Nullable<{ id: string; name: string }>;
  status: string;
  text: string;
  updatedAt: Date;
};

export function toCharacterTheoryView(theory: CharacterTheorySource): CharacterTheoryView {
  const status = CharacterTheoryStatusSchema.parse(theory.status);
  const characterNameHidden = theory.character !== null && theory.character.deletedAt !== null;
  return {
    bookId: theory.book?.id ?? null,
    bookTitle: theory.book?.title ?? null,
    characterId: theory.character?.id ?? null,
    characterName: characterNameHidden ? null : (theory.character?.name ?? null),
    createdAt: theory.createdAt.toISOString(),
    id: theory.id,
    isResolved: isResolvedStatus(status),
    isSpoiler: theory.isSpoiler,
    seriesId: theory.series?.id ?? null,
    seriesName: theory.series?.name ?? null,
    status,
    text: theory.text,
    updatedAt: theory.updatedAt.toISOString(),
  };
}

function isResolvedStatus(status: CharacterTheoryStatus): boolean {
  switch (status) {
    case "confirmed":
    case "disproved":
      return true;
    case "unverified":
      return false;
    default: {
      const _exhaustiveCheck: never = status;
      return _exhaustiveCheck;
    }
  }
}
