import type { CharacterMergeCounts, Nullable } from "@app/shared";

import {
  normalizeName,
  RelationshipDirectionalitySchema,
  RelationshipTypeSchema,
} from "@app/shared";

import {
  buildRelationshipLockKey,
  canonicalizeRelationshipEndpoints,
} from "./character-relationship-graph.js";

export type CharacterMergePlan = {
  counts: CharacterMergeCounts;
  dropAliasIds: string[];
  dropBookCharacterIds: string[];
  dropFormIds: string[];
  dropMembershipIds: string[];
  droppedMediaIds: string[];
  dropRelationshipIds: string[];
  dropTagIds: string[];
  relationshipRepoints: RelationshipRepoint[];
  repointAliasIds: string[];
  repointBookCharacterIds: string[];
  repointFormIds: string[];
  repointMembershipIds: string[];
  repointTagIds: string[];
};

export type CharacterMergePlanInput = {
  loserAliases: { bookId: Nullable<string>; id: string; normalizedName: string; type: string }[];
  loserAvatarMediaId: Nullable<string>;
  loserBookCharacters: {
    bookId: string;
    id: string;
    portraitMediaId: Nullable<string>;
    roleCount: number;
  }[];
  loserForms: { id: string; normalizedName: string; portraitMediaId: Nullable<string> }[];
  loserMemberships: { bookId: Nullable<string>; groupId: string; id: string }[];
  loserTagIds: string[];
  loserTheoryCount: number;
  relationshipCandidates: RelationshipCandidate[];
  survivorAliasKeys: { bookId: Nullable<string>; normalizedName: string; type: string }[];
  survivorBookIds: string[];
  survivorFormKeys: string[];
  survivorMembershipKeys: { bookId: Nullable<string>; groupId: string }[];
  survivorRelationshipKeys: Set<string>;
  survivorTagIds: string[];
};

export type KeyedEntry = {
  id: string;
  key: string;
};

export type KeyedRepointPlan = {
  dropIds: string[];
  repointIds: string[];
};

export type LoserRelationshipRow = {
  customType: Nullable<string>;
  directionality: string;
  id: string;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
  type: string;
};

export type RelationshipCandidate = {
  dedupKey: Nullable<string>;
  id: string;
  isSelfLoop: boolean;
  repoint: Nullable<RelationshipRepoint>;
};

export type RelationshipCandidatePlan = {
  candidates: RelationshipCandidate[];
  lockKeys: string[];
};

export type RelationshipMergePlan = {
  dropIds: string[];
  repoints: RelationshipRepoint[];
};

export type RelationshipRepoint = {
  id: string;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
};

export type SurvivorRelationshipRow = {
  customType: Nullable<string>;
  directionality: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: string;
};

export function aliasMergeKey({
  bookId,
  normalizedName,
  type,
}: {
  bookId: Nullable<string>;
  normalizedName: string;
  type: string;
}): string {
  return `${bookId ?? "global"}::${normalizedName}::${type}`;
}

export function buildCharacterMergePlan(input: CharacterMergePlanInput): CharacterMergePlan {
  const bookCharacters = resolveKeyedRepoint({
    loserEntries: input.loserBookCharacters.map((row) => ({ id: row.id, key: row.bookId })),
    survivorKeys: new Set(input.survivorBookIds),
  });
  const aliases = resolveKeyedRepoint({
    loserEntries: input.loserAliases.map((row) => ({ id: row.id, key: aliasMergeKey(row) })),
    survivorKeys: new Set(input.survivorAliasKeys.map((key) => aliasMergeKey(key))),
  });
  const memberships = resolveKeyedRepoint({
    loserEntries: input.loserMemberships.map((row) => ({
      id: row.id,
      key: membershipMergeKey(row),
    })),
    survivorKeys: new Set(input.survivorMembershipKeys.map((key) => membershipMergeKey(key))),
  });
  const tags = resolveKeyedRepoint({
    loserEntries: input.loserTagIds.map((tagId) => ({ id: tagId, key: tagId })),
    survivorKeys: new Set(input.survivorTagIds),
  });
  const forms = resolveKeyedRepoint({
    loserEntries: input.loserForms.map((row) => ({ id: row.id, key: row.normalizedName })),
    survivorKeys: new Set(input.survivorFormKeys),
  });
  const relationshipPlan = resolveRelationshipPlan({
    candidates: input.relationshipCandidates,
    survivorKeys: input.survivorRelationshipKeys,
  });

  const roleCountById = new Map(
    input.loserBookCharacters.map((row) => [row.id, row.roleCount] as const),
  );
  const portraitById = new Map(
    input.loserBookCharacters.map((row) => [row.id, row.portraitMediaId] as const),
  );
  const formPortraitById = new Map(
    input.loserForms.map((row) => [row.id, row.portraitMediaId] as const),
  );
  const sumRoles = (ids: string[]): number =>
    ids.reduce((total, id) => total + (roleCountById.get(id) ?? 0), 0);

  const droppedMediaIds = [
    ...new Set(
      [
        input.loserAvatarMediaId,
        ...bookCharacters.dropIds.map((id) => portraitById.get(id) ?? null),
        ...forms.dropIds.map((id) => formPortraitById.get(id) ?? null),
      ].filter((id): id is string => id !== null),
    ),
  ];

  const counts: CharacterMergeCounts = {
    aliases: { dropped: aliases.dropIds.length, moved: aliases.repointIds.length },
    appearances: {
      dropped: bookCharacters.dropIds.length,
      moved: bookCharacters.repointIds.length,
    },
    forms: { dropped: forms.dropIds.length, moved: forms.repointIds.length },
    memberships: { dropped: memberships.dropIds.length, moved: memberships.repointIds.length },
    relationships: {
      dropped: relationshipPlan.dropIds.length,
      moved: relationshipPlan.repoints.length,
    },
    roles: {
      dropped: sumRoles(bookCharacters.dropIds),
      moved: sumRoles(bookCharacters.repointIds),
    },
    tags: { dropped: tags.dropIds.length, moved: tags.repointIds.length },
    theories: { dropped: 0, moved: input.loserTheoryCount },
  };

  return {
    counts,
    dropAliasIds: aliases.dropIds,
    dropBookCharacterIds: bookCharacters.dropIds,
    dropFormIds: forms.dropIds,
    dropMembershipIds: memberships.dropIds,
    droppedMediaIds,
    dropRelationshipIds: relationshipPlan.dropIds,
    dropTagIds: tags.dropIds,
    relationshipRepoints: relationshipPlan.repoints,
    repointAliasIds: aliases.repointIds,
    repointBookCharacterIds: bookCharacters.repointIds,
    repointFormIds: forms.repointIds,
    repointMembershipIds: memberships.repointIds,
    repointTagIds: tags.repointIds,
  };
}

export function buildSurvivorRelationshipKeys({
  rows,
  userId,
}: {
  rows: SurvivorRelationshipRow[];
  userId: string;
}): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    const directionality = RelationshipDirectionalitySchema.parse(row.directionality);
    const type = RelationshipTypeSchema.parse(row.type);
    const canonical = canonicalizeRelationshipEndpoints({
      directionality,
      sourceCharacterId: row.sourceCharacterId,
      sourceLabel: null,
      targetCharacterId: row.targetCharacterId,
      targetLabel: null,
    });
    keys.add(
      buildRelationshipLockKey({
        directionality,
        normalizedCustomType: row.customType === null ? null : normalizeName(row.customType),
        sourceCharacterId: canonical.sourceCharacterId,
        targetCharacterId: canonical.targetCharacterId,
        type,
        userId,
      }),
    );
  }
  return keys;
}

export function computeRelationshipCandidates({
  loserId,
  loserRows,
  survivorId,
  userId,
}: {
  loserId: string;
  loserRows: LoserRelationshipRow[];
  survivorId: string;
  userId: string;
}): RelationshipCandidatePlan {
  const candidates: RelationshipCandidate[] = [];
  const lockKeys = new Set<string>();
  for (const row of loserRows) {
    const directionality = RelationshipDirectionalitySchema.parse(row.directionality);
    const type = RelationshipTypeSchema.parse(row.type);
    const sourceCharacterId =
      row.sourceCharacterId === loserId ? survivorId : row.sourceCharacterId;
    const targetCharacterId =
      row.targetCharacterId === loserId ? survivorId : row.targetCharacterId;
    if (sourceCharacterId === targetCharacterId) {
      candidates.push({ dedupKey: null, id: row.id, isSelfLoop: true, repoint: null });
      continue;
    }
    const canonical = canonicalizeRelationshipEndpoints({
      directionality,
      sourceCharacterId,
      sourceLabel: row.sourceLabel,
      targetCharacterId,
      targetLabel: row.targetLabel,
    });
    const dedupKey = buildRelationshipLockKey({
      directionality,
      normalizedCustomType: row.customType === null ? null : normalizeName(row.customType),
      sourceCharacterId: canonical.sourceCharacterId,
      targetCharacterId: canonical.targetCharacterId,
      type,
      userId,
    });
    lockKeys.add(dedupKey);
    candidates.push({
      dedupKey,
      id: row.id,
      isSelfLoop: false,
      repoint: {
        id: row.id,
        sourceCharacterId: canonical.sourceCharacterId,
        sourceLabel: canonical.sourceLabel,
        targetCharacterId: canonical.targetCharacterId,
        targetLabel: canonical.targetLabel,
      },
    });
  }
  return { candidates, lockKeys: [...lockKeys] };
}

export function membershipMergeKey({
  bookId,
  groupId,
}: {
  bookId: Nullable<string>;
  groupId: string;
}): string {
  return `${groupId}::${bookId ?? "global"}`;
}

export function resolveKeyedRepoint({
  loserEntries,
  survivorKeys,
}: {
  loserEntries: KeyedEntry[];
  survivorKeys: Set<string>;
}): KeyedRepointPlan {
  const seen = new Set(survivorKeys);
  const repointIds: string[] = [];
  const dropIds: string[] = [];
  for (const entry of loserEntries) {
    if (seen.has(entry.key)) {
      dropIds.push(entry.id);
      continue;
    }
    seen.add(entry.key);
    repointIds.push(entry.id);
  }
  return { dropIds, repointIds };
}

export function resolveRelationshipPlan({
  candidates,
  survivorKeys,
}: {
  candidates: RelationshipCandidate[];
  survivorKeys: Set<string>;
}): RelationshipMergePlan {
  const seen = new Set(survivorKeys);
  const repoints: RelationshipRepoint[] = [];
  const dropIds: string[] = [];
  for (const candidate of candidates) {
    if (candidate.isSelfLoop || candidate.dedupKey === null || candidate.repoint === null) {
      dropIds.push(candidate.id);
      continue;
    }
    if (seen.has(candidate.dedupKey)) {
      dropIds.push(candidate.id);
      continue;
    }
    seen.add(candidate.dedupKey);
    repoints.push(candidate.repoint);
  }
  return { dropIds, repoints };
}
