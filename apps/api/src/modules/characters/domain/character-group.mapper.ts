import type {
  CharacterGroupDetailsView,
  CharacterGroupMembershipView,
  CharacterGroupSummaryView,
  Nullable,
} from "@app/shared";

import { CharacterGroupTypeSchema } from "@app/shared";

import { emptyToNull } from "./character-fields.js";

export type GroupMembershipSource = {
  bookId: Nullable<string>;
  character: { name: string };
  characterId: string;
  createdAt: Date;
  id: string;
  isSpoiler: boolean;
  role: Nullable<string>;
  status: Nullable<string>;
  updatedAt: Date;
};

export type GroupSource = {
  createdAt: Date;
  customType: Nullable<string>;
  description: Nullable<string>;
  id: string;
  isSpoiler: boolean;
  name: string;
  seriesId: Nullable<string>;
  type: string;
  updatedAt: Date;
};

export function toCharacterGroupDetailsView({
  group,
  members,
  nameHidden,
}: {
  group: GroupSource;
  members: GroupMembershipSource[];
  nameHidden: boolean;
}): CharacterGroupDetailsView {
  return {
    ...toCharacterGroupSummaryView({ group, memberCount: members.length, nameHidden }),
    members: members.map((membership) => toCharacterGroupMembershipView(membership)),
  };
}

export function toCharacterGroupMembershipView(
  membership: GroupMembershipSource,
): CharacterGroupMembershipView {
  return {
    bookId: membership.bookId,
    characterId: membership.characterId,
    characterName: membership.character.name,
    createdAt: membership.createdAt.toISOString(),
    id: membership.id,
    isSpoiler: membership.isSpoiler,
    role: emptyToNull(membership.role),
    status: emptyToNull(membership.status),
    updatedAt: membership.updatedAt.toISOString(),
  };
}

export function toCharacterGroupSummaryView({
  group,
  memberCount,
  nameHidden,
}: {
  group: GroupSource;
  memberCount: number;
  nameHidden: boolean;
}): CharacterGroupSummaryView {
  return {
    createdAt: group.createdAt.toISOString(),
    customType: nameHidden ? null : emptyToNull(group.customType),
    description: nameHidden ? null : emptyToNull(group.description),
    hiddenFields: nameHidden ? ["customType", "description", "name"] : [],
    id: group.id,
    isSpoiler: group.isSpoiler,
    memberCount,
    name: nameHidden ? null : group.name,
    seriesId: group.seriesId,
    type: CharacterGroupTypeSchema.parse(group.type),
    updatedAt: group.updatedAt.toISOString(),
  };
}
