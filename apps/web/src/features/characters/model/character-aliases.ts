import type { CharacterAliasType, CharacterDetailsView, Nullable } from "@app/shared";

import { normalizeName } from "@app/shared";

export const ALIAS_DEFAULT_TYPE = "other" satisfies CharacterAliasType;

export type CharacterAliasRow = {
  isSpoiler: boolean;
  name: string;
  type: CharacterAliasType;
};

type AliasConflict = "duplicate" | "reserved";

export function emptyAliasRow(): CharacterAliasRow {
  return { isSpoiler: false, name: "", type: ALIAS_DEFAULT_TYPE };
}

export function findAliasConflicts({
  aliases,
  reservedName,
}: {
  aliases: readonly CharacterAliasRow[];
  reservedName: Nullable<string>;
}): { duplicateIndexes: number[]; reservedIndexes: number[] } {
  const reserved = normalizeName(reservedName ?? "");
  const seen = new Set<string>();
  const duplicateIndexes: number[] = [];
  const reservedIndexes: number[] = [];

  aliases.forEach((alias, index) => {
    const normalized = normalizeName(alias.name);
    if (normalized === "") return;

    if (reserved !== "" && normalized === reserved) {
      reservedIndexes.push(index);
      return;
    }

    const identity = `${alias.type}:${normalized}`;
    if (seen.has(identity)) {
      duplicateIndexes.push(index);
      return;
    }
    seen.add(identity);
  });

  return { duplicateIndexes, reservedIndexes };
}

export function findAliasDraftConflict({
  aliases,
  draft,
  editingIndex,
  reservedName,
}: {
  aliases: readonly CharacterAliasRow[];
  draft: CharacterAliasRow;
  editingIndex: Nullable<number>;
  reservedName: Nullable<string>;
}): Nullable<AliasConflict> {
  const others = aliases.filter((_, index) => index !== editingIndex);
  const draftIndex = others.length;
  const { duplicateIndexes, reservedIndexes } = findAliasConflicts({
    aliases: [...others, draft],
    reservedName,
  });

  if (reservedIndexes.includes(draftIndex)) return "reserved";
  if (duplicateIndexes.includes(draftIndex)) return "duplicate";
  return null;
}

export function toAliasPayload(aliases: readonly CharacterAliasRow[]) {
  return aliases
    .filter((alias) => alias.name.trim().length > 0)
    .map((alias, index) => ({
      isSpoiler: alias.isSpoiler,
      name: alias.name.trim(),
      position: index,
      type: alias.type,
    }));
}

export function toAliasRows({
  bookId,
  character,
}: {
  bookId: Nullable<string>;
  character: CharacterDetailsView;
}): CharacterAliasRow[] {
  return character.aliases
    .filter((alias) => alias.bookId === bookId)
    .map((alias) => ({ isSpoiler: alias.isSpoiler, name: alias.name, type: alias.type }));
}
