import type { CharacterAliasType, CharacterDetailsView, Nullable } from "@app/shared";

export const ALIAS_DEFAULT_TYPE = "other" satisfies CharacterAliasType;

export type CharacterAliasRow = {
  isSpoiler: boolean;
  name: string;
  type: CharacterAliasType;
};

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
  const reserved = normalizeAlias(reservedName ?? "");
  const seen = new Map<string, number>();
  const duplicateIndexes: number[] = [];
  const reservedIndexes: number[] = [];

  aliases.forEach((alias, index) => {
    const normalized = normalizeAlias(alias.name);
    if (normalized === "") return;

    if (reserved !== "" && normalized === reserved) {
      reservedIndexes.push(index);
      return;
    }

    const first = seen.get(normalized);
    if (first === undefined) {
      seen.set(normalized, index);
      return;
    }
    duplicateIndexes.push(index);
  });

  return { duplicateIndexes, reservedIndexes };
}

export function normalizeAlias(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
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
