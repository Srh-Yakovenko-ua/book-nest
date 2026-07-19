import type { Nullable } from "@app/shared";

export type MembershipVisibilityContext = {
  allowedBookIds: Set<string>;
  hiddenPresenceCharacterIds: Set<string>;
  revealedCharacterIds: Set<string>;
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
  const presenceHidden =
    context.hiddenPresenceCharacterIds.has(membership.characterId) &&
    !context.revealedCharacterIds.has(membership.characterId);
  return !presenceHidden;
}
