import type { Nullable } from "@app/shared";

export type MembershipVisibilityContext = {
  allowedBookIds: ReadonlySet<string>;
  unreachableCharacterIds: ReadonlySet<string>;
};

export type MembershipVisibilitySource = {
  bookId: Nullable<string>;
  characterId: string;
  isSpoiler: boolean;
};

export function isMembershipVisibleInContext({
  context,
  membership,
}: {
  context: MembershipVisibilityContext;
  membership: MembershipVisibilitySource;
}): boolean {
  if (membership.isSpoiler) {
    return false;
  }
  if (membership.bookId !== null && !context.allowedBookIds.has(membership.bookId)) {
    return false;
  }
  return !context.unreachableCharacterIds.has(membership.characterId);
}
