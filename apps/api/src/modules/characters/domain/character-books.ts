import type { CharacterBookOrderKey, Nullable } from "@app/shared";

import { compareCharacterBooks } from "@app/shared";

export type CharacterBookKeySource = {
  book: CharacterBookSource;
  characterId: string;
};

export type CharacterBookSource = {
  id: string;
  partNumber: Nullable<number>;
  series: Nullable<{ id: string; name: string }>;
  title: string;
};

export function groupSortedCharacterBooks(
  keys: readonly CharacterBookKeySource[],
): Map<string, CharacterBookOrderKey[]> {
  const booksByCharacterId = new Map<string, CharacterBookOrderKey[]>();
  for (const key of keys) {
    const orderKey = toCharacterBookOrderKey(key.book);
    const characterBooks = booksByCharacterId.get(key.characterId);
    if (characterBooks === undefined) {
      booksByCharacterId.set(key.characterId, [orderKey]);
      continue;
    }
    characterBooks.push(orderKey);
  }
  for (const characterBooks of booksByCharacterId.values()) {
    characterBooks.sort(compareCharacterBooks);
  }
  return booksByCharacterId;
}

export function toCharacterBookOrderKey(book: CharacterBookSource): CharacterBookOrderKey {
  return {
    id: book.id,
    series:
      book.series === null
        ? null
        : { id: book.series.id, name: book.series.name, partNumber: book.partNumber },
    title: book.title,
  };
}
