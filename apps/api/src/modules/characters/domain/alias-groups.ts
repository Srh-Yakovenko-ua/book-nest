import type { CharacterRevealFieldKey, Nullable } from "@app/shared";

export type VisibleAliases<TAlias extends AliasGroupMember> = {
  aliases: TAlias[];
  hiddenFields: AliasGroupKey[];
};

type AliasGroupKey = Extract<CharacterRevealFieldKey, "bookAliases" | "globalAliases">;

type AliasGroupMember = {
  bookId: Nullable<string>;
  isSpoiler: boolean;
};

export function selectVisibleAliases<TAlias extends AliasGroupMember>({
  aliases,
  contextBookId,
  revealedFields,
}: {
  aliases: readonly TAlias[];
  contextBookId: Nullable<string>;
  revealedFields: ReadonlySet<CharacterRevealFieldKey>;
}): VisibleAliases<TAlias> {
  const groupKeyOf = (alias: TAlias): Nullable<AliasGroupKey> => {
    if (alias.bookId === null) {
      return "globalAliases";
    }
    return alias.bookId === contextBookId ? "bookAliases" : null;
  };

  const hiddenGroups = new Set<AliasGroupKey>();
  const visibleAliases = aliases.filter((alias) => {
    const groupKey = groupKeyOf(alias);
    if (groupKey === null) {
      return false;
    }
    if (!alias.isSpoiler || revealedFields.has(groupKey)) {
      return true;
    }
    hiddenGroups.add(groupKey);
    return false;
  });

  return { aliases: visibleAliases, hiddenFields: [...hiddenGroups] };
}
