import type { CharacterAliasType, CharacterDetailsView, Nullable } from "@app/shared";

import { CHARACTER_ALIASES_MAX, normalizeName } from "@app/shared";

export const ALIAS_DEFAULT_TYPE = "other" satisfies CharacterAliasType;

export type AliasRestoreRefusal = "duplicate" | "limit" | "reserved";

export type CharacterAliasRow = {
  isSpoiler: boolean;
  name: string;
  type: CharacterAliasType;
};

type AliasConflict = "duplicate" | "reserved";

export function aliasRestoreIndex({
  keys,
  originalIndex,
  previousKey,
}: {
  keys: readonly string[];
  originalIndex: number;
  previousKey: Nullable<string>;
}): number {
  if (previousKey === null) return 0;
  const previousIndex = keys.indexOf(previousKey);
  if (previousIndex === -1) return Math.min(originalIndex, keys.length);
  return previousIndex + 1;
}

export function aliasRestoreRefusal({
  aliases,
  countBeforeRemoval,
  removed,
  reservedName,
}: {
  aliases: readonly CharacterAliasRow[];
  countBeforeRemoval: number;
  removed: CharacterAliasRow;
  reservedName: Nullable<string>;
}): Nullable<AliasRestoreRefusal> {
  if (aliases.length >= Math.max(CHARACTER_ALIASES_MAX, countBeforeRemoval)) return "limit";
  return findAliasDraftConflict({ aliases, draft: removed, editingIndex: null, reservedName });
}

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

export function isAliasDraftChanged({
  draft,
  original,
}: {
  draft: CharacterAliasRow;
  original: CharacterAliasRow;
}): boolean {
  return (
    draft.name.trim() !== original.name.trim() ||
    draft.type !== original.type ||
    draft.isSpoiler !== original.isSpoiler
  );
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
