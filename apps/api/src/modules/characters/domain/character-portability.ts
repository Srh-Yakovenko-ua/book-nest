import type {
  CharacterBundle,
  CharacterImportCreated,
  CharacterImportSkipped,
  Nullable,
} from "@app/shared";
import type { ZodError } from "zod";

import {
  BookCharacterImportanceSchema,
  BookCharacterNarratorTypeSchema,
  BookCharacterRoleTypeSchema,
  BookCharacterStatusSchema,
  CHARACTER_BUNDLE_FORMAT_VERSION,
  CharacterAliasTypeSchema,
  CharacterAttitudeSchema,
  CharacterEntityKindSchema,
  CharacterGenderSchema,
  CharacterGroupTypeSchema,
  CharacterTheoryStatusSchema,
  normalizeName,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "@app/shared";

import { emptyToNull } from "./character-fields.js";
import {
  buildRelationshipLockKey,
  canonicalizeRelationshipEndpoints,
} from "./character-relationship-graph.js";

export type CharacterExportSource = {
  characters: ExportCharacterRow[];
  groups: ExportGroupRow[];
  relationships: ExportRelationshipRow[];
  theories: ExportTheoryRow[];
};

export type CharacterImportPlan = {
  aliases: ImportAliasRow[];
  bookCharacters: ImportBookCharacterRow[];
  bookStates: ImportBookStateRow[];
  characters: ImportCharacterRow[];
  characterTags: ImportCharacterTagRow[];
  created: CharacterImportCreated;
  groups: ImportGroupRow[];
  memberships: ImportMembershipRow[];
  relationships: ImportRelationshipRow[];
  roles: ImportRoleRow[];
  skipped: CharacterImportSkipped;
  theories: ImportTheoryRow[];
};

export type ExportAliasRow = {
  bookId: Nullable<string>;
  isSpoiler: boolean;
  name: string;
  position: number;
  type: string;
};

export type ExportAppearanceRow = {
  appearanceNotes: Nullable<string>;
  appearanceNotesIsSpoiler: boolean;
  attitude: Nullable<string>;
  bookId: string;
  description: Nullable<string>;
  descriptionIsSpoiler: boolean;
  displayName: Nullable<string>;
  displayNameIsSpoiler: boolean;
  firstAppearanceAudioSeconds: Nullable<number>;
  firstAppearanceChapter: Nullable<string>;
  firstAppearanceNote: Nullable<string>;
  firstAppearancePage: Nullable<number>;
  hidePresenceAsSpoiler: boolean;
  importance: string;
  isPovCharacter: boolean;
  narratorType: Nullable<string>;
  personalImpression: Nullable<string>;
  personalImpressionIsSpoiler: boolean;
  portraitIsSpoiler: boolean;
  portraitMediaId: Nullable<string>;
  roles: ExportRoleRow[];
  sortOrder: Nullable<number>;
  speciesOverride: Nullable<string>;
  speciesOverrideIsSpoiler: boolean;
  status: string;
  statusCustomText: Nullable<string>;
  statusIsSpoiler: boolean;
};

export type ExportBookStateRow = {
  bookId: string;
  description: Nullable<string>;
  endedAudioSeconds: Nullable<number>;
  endedChapter: Nullable<string>;
  endedPage: Nullable<number>;
  hideRelationshipAsSpoiler: boolean;
  intensity: Nullable<string>;
  introducedAudioSeconds: Nullable<number>;
  introducedChapter: Nullable<string>;
  introducedPage: Nullable<number>;
  isDescriptionSpoiler: boolean;
  isTypeSpoiler: boolean;
  status: string;
};

export type ExportCharacterRow = {
  aliases: ExportAliasRow[];
  archivedAt: Nullable<Date>;
  avatarMediaId: Nullable<string>;
  bookAppearances: ExportAppearanceRow[];
  customGender: Nullable<string>;
  entityKind: string;
  gender: string;
  globalAttitude: Nullable<string>;
  hideProfileAsSpoiler: boolean;
  id: string;
  isFavorite: boolean;
  name: string;
  neutralDescription: Nullable<string>;
  pronouns: Nullable<string>;
  species: Nullable<string>;
  tags: { tagId: string }[];
};

export type ExportGroupRow = {
  customType: Nullable<string>;
  description: Nullable<string>;
  isSpoiler: boolean;
  memberships: ExportMembershipRow[];
  name: string;
  seriesId: Nullable<string>;
  type: string;
};

export type ExportMembershipRow = {
  bookId: Nullable<string>;
  characterId: string;
  isSpoiler: boolean;
  role: Nullable<string>;
  status: Nullable<string>;
};

export type ExportRelationshipRow = {
  bookStates: ExportBookStateRow[];
  category: string;
  customType: Nullable<string>;
  directionality: string;
  isCanonical: boolean;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
  type: string;
};

export type ExportRoleRow = {
  customRole: Nullable<string>;
  isSpoiler: boolean;
  position: number;
  roleType: string;
};

export type ExportTheoryRow = {
  bookId: Nullable<string>;
  characterId: Nullable<string>;
  isSpoiler: boolean;
  seriesId: Nullable<string>;
  status: string;
  text: string;
};

export type ImportAliasRow = {
  bookId: Nullable<string>;
  characterId: string;
  id: string;
  isSpoiler: boolean;
  name: string;
  normalizedName: string;
  position: number;
  type: string;
};

export type ImportBookCharacterRow = {
  appearanceNotes: Nullable<string>;
  appearanceNotesIsSpoiler: boolean;
  attitude: Nullable<string>;
  bookId: string;
  characterId: string;
  description: Nullable<string>;
  descriptionIsSpoiler: boolean;
  displayName: Nullable<string>;
  displayNameIsSpoiler: boolean;
  firstAppearanceAudioSeconds: Nullable<number>;
  firstAppearanceChapter: Nullable<string>;
  firstAppearanceNote: Nullable<string>;
  firstAppearancePage: Nullable<number>;
  hidePresenceAsSpoiler: boolean;
  id: string;
  importance: string;
  isPovCharacter: boolean;
  narratorType: Nullable<string>;
  personalImpression: Nullable<string>;
  personalImpressionIsSpoiler: boolean;
  portraitIsSpoiler: boolean;
  portraitMediaId: Nullable<string>;
  sortOrder: Nullable<number>;
  speciesOverride: Nullable<string>;
  speciesOverrideIsSpoiler: boolean;
  status: string;
  statusCustomText: Nullable<string>;
  statusIsSpoiler: boolean;
};

export type ImportBookStateRow = {
  bookId: string;
  description: Nullable<string>;
  endedAudioSeconds: Nullable<number>;
  endedChapter: Nullable<string>;
  endedPage: Nullable<number>;
  hideRelationshipAsSpoiler: boolean;
  id: string;
  intensity: Nullable<string>;
  introducedAudioSeconds: Nullable<number>;
  introducedChapter: Nullable<string>;
  introducedPage: Nullable<number>;
  isDescriptionSpoiler: boolean;
  isTypeSpoiler: boolean;
  relationshipId: string;
  status: string;
};

export type ImportCharacterRow = {
  archivedAt: Nullable<Date>;
  avatarMediaId: Nullable<string>;
  customGender: Nullable<string>;
  entityKind: string;
  gender: string;
  globalAttitude: Nullable<string>;
  hideProfileAsSpoiler: boolean;
  id: string;
  isFavorite: boolean;
  name: string;
  neutralDescription: Nullable<string>;
  normalizedName: string;
  pronouns: Nullable<string>;
  species: Nullable<string>;
  userId: string;
};

export type ImportCharacterTagRow = {
  characterId: string;
  tagId: string;
};

export type ImportGroupRow = {
  customType: Nullable<string>;
  description: Nullable<string>;
  id: string;
  isSpoiler: boolean;
  name: string;
  normalizedName: string;
  seriesId: Nullable<string>;
  type: string;
  userId: string;
};

export type ImportMembershipRow = {
  bookId: Nullable<string>;
  characterId: string;
  groupId: string;
  id: string;
  isSpoiler: boolean;
  role: Nullable<string>;
  status: Nullable<string>;
};

export type ImportRelationshipRow = {
  category: string;
  customType: Nullable<string>;
  directionality: string;
  id: string;
  isCanonical: boolean;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
  type: string;
  userId: string;
};

export type ImportRoleRow = {
  bookCharacterId: string;
  customRole: Nullable<string>;
  id: string;
  isSpoiler: boolean;
  position: number;
  roleType: string;
};

export type ImportTheoryRow = {
  bookId: Nullable<string>;
  characterId: Nullable<string>;
  id: string;
  isSpoiler: boolean;
  seriesId: Nullable<string>;
  status: string;
  text: string;
  userId: string;
};

export type OwnedLibraryRefs = {
  bookIds: Set<string>;
  mediaIds: Set<string>;
  seriesIds: Set<string>;
  tagIds: Set<string>;
};

export function classifyBundleParseError(error: ZodError): "invalid" | "tooLarge" {
  const hasCollectionOverflow = error.issues.some(
    (issue) => issue.code === "too_big" && "origin" in issue && issue.origin === "array",
  );
  return hasCollectionOverflow ? "tooLarge" : "invalid";
}

export function planCharacterImport({
  bundle,
  newId,
  now,
  owned,
  userId,
}: {
  bundle: CharacterBundle;
  newId: () => string;
  now: Date;
  owned: OwnedLibraryRefs;
  userId: string;
}): CharacterImportPlan {
  const created = emptyCreatedCounts();
  const skipped = emptySkippedCounts();
  const characterIdMap = new Map<string, string>();
  for (const character of bundle.characters) {
    characterIdMap.set(character.id, newId());
  }

  const plan: CharacterImportPlan = {
    aliases: [],
    bookCharacters: [],
    bookStates: [],
    characters: [],
    characterTags: [],
    created,
    groups: [],
    memberships: [],
    relationships: [],
    roles: [],
    skipped,
    theories: [],
  };

  for (const character of bundle.characters) {
    const freshCharacterId = characterIdMap.get(character.id);
    if (freshCharacterId === undefined) {
      continue;
    }
    planCharacter({ character, freshCharacterId, newId, now, owned, plan, userId });
  }

  for (const group of bundle.groups) {
    planGroup({ characterIdMap, group, newId, owned, plan, userId });
  }

  const seenRelationshipKeys = new Set<string>();
  for (const relationship of bundle.relationships) {
    planRelationship({
      characterIdMap,
      newId,
      owned,
      plan,
      relationship,
      seenRelationshipKeys,
      userId,
    });
  }

  for (const theory of bundle.theories) {
    planTheory({ characterIdMap, newId, owned, plan, theory, userId });
  }

  return plan;
}

export function serializeCharacterBundle({
  exportedAt,
  source,
}: {
  exportedAt: Date;
  source: CharacterExportSource;
}): CharacterBundle {
  return {
    characters: source.characters.map(serializeCharacter),
    exportedAt: exportedAt.toISOString(),
    formatVersion: CHARACTER_BUNDLE_FORMAT_VERSION,
    groups: source.groups.map(serializeGroup),
    relationships: source.relationships.map(serializeRelationship),
    theories: source.theories.map(serializeTheory),
  };
}

function emptyCreatedCounts(): CharacterImportCreated {
  return {
    aliases: 0,
    appearances: 0,
    bookStates: 0,
    characters: 0,
    groups: 0,
    memberships: 0,
    relationships: 0,
    roles: 0,
    tags: 0,
    theories: 0,
  };
}

function emptySkippedCounts(): CharacterImportSkipped {
  return {
    aliasesMissingBook: 0,
    appearancesMissingBook: 0,
    bookStatesMissingBook: 0,
    membershipsMissingBook: 0,
    relationshipsInvalid: 0,
    tagsMissing: 0,
    theoriesWithoutTarget: 0,
    unlinkedMedia: 0,
    unlinkedSeries: 0,
  };
}

function planCharacter({
  character,
  freshCharacterId,
  newId,
  now,
  owned,
  plan,
  userId,
}: {
  character: CharacterBundle["characters"][number];
  freshCharacterId: string;
  newId: () => string;
  now: Date;
  owned: OwnedLibraryRefs;
  plan: CharacterImportPlan;
  userId: string;
}): void {
  const avatarMediaId = resolveOptionalOwned({
    id: character.avatarMediaId,
    owned: owned.mediaIds,
  });
  if (avatarMediaId.unlinked) {
    plan.skipped.unlinkedMedia += 1;
  }
  plan.characters.push({
    archivedAt: character.isArchived ? now : null,
    avatarMediaId: avatarMediaId.value,
    customGender: emptyToNull(character.customGender),
    entityKind: character.entityKind,
    gender: character.gender,
    globalAttitude: character.globalAttitude,
    hideProfileAsSpoiler: character.hideProfileAsSpoiler,
    id: freshCharacterId,
    isFavorite: character.isFavorite,
    name: character.name,
    neutralDescription: emptyToNull(character.neutralDescription),
    normalizedName: normalizeName(character.name),
    pronouns: emptyToNull(character.pronouns),
    species: emptyToNull(character.species),
    userId,
  });
  plan.created.characters += 1;

  const seenAliasKeys = new Set<string>();
  for (const alias of character.aliases) {
    const key = `${alias.bookId ?? "global"}::${normalizeName(alias.name)}::${alias.type}`;
    if (seenAliasKeys.has(key)) {
      continue;
    }
    if (alias.bookId !== null && !owned.bookIds.has(alias.bookId)) {
      plan.skipped.aliasesMissingBook += 1;
      continue;
    }
    seenAliasKeys.add(key);
    plan.aliases.push({
      bookId: alias.bookId,
      characterId: freshCharacterId,
      id: newId(),
      isSpoiler: alias.isSpoiler,
      name: alias.name,
      normalizedName: normalizeName(alias.name),
      position: alias.position,
      type: alias.type,
    });
    plan.created.aliases += 1;
  }

  const seenTagIds = new Set<string>();
  for (const tagId of character.tagIds) {
    if (seenTagIds.has(tagId)) {
      continue;
    }
    seenTagIds.add(tagId);
    if (!owned.tagIds.has(tagId)) {
      plan.skipped.tagsMissing += 1;
      continue;
    }
    plan.characterTags.push({ characterId: freshCharacterId, tagId });
    plan.created.tags += 1;
  }

  const seenAppearanceBookIds = new Set<string>();
  for (const appearance of character.appearances) {
    if (seenAppearanceBookIds.has(appearance.bookId)) {
      continue;
    }
    if (!owned.bookIds.has(appearance.bookId)) {
      plan.skipped.appearancesMissingBook += 1;
      continue;
    }
    seenAppearanceBookIds.add(appearance.bookId);
    const portraitMediaId = resolveOptionalOwned({
      id: appearance.portraitMediaId,
      owned: owned.mediaIds,
    });
    if (portraitMediaId.unlinked) {
      plan.skipped.unlinkedMedia += 1;
    }
    const bookCharacterId = newId();
    plan.bookCharacters.push({
      appearanceNotes: emptyToNull(appearance.appearanceNotes),
      appearanceNotesIsSpoiler: appearance.appearanceNotesIsSpoiler,
      attitude: appearance.attitude,
      bookId: appearance.bookId,
      characterId: freshCharacterId,
      description: emptyToNull(appearance.description),
      descriptionIsSpoiler: appearance.descriptionIsSpoiler,
      displayName: emptyToNull(appearance.displayName),
      displayNameIsSpoiler: appearance.displayNameIsSpoiler,
      firstAppearanceAudioSeconds: appearance.firstAppearanceAudioSeconds,
      firstAppearanceChapter: emptyToNull(appearance.firstAppearanceChapter),
      firstAppearanceNote: emptyToNull(appearance.firstAppearanceNote),
      firstAppearancePage: appearance.firstAppearancePage,
      hidePresenceAsSpoiler: appearance.hidePresenceAsSpoiler,
      id: bookCharacterId,
      importance: appearance.importance,
      isPovCharacter: appearance.isPovCharacter,
      narratorType: appearance.narratorType,
      personalImpression: emptyToNull(appearance.personalImpression),
      personalImpressionIsSpoiler: appearance.personalImpressionIsSpoiler,
      portraitIsSpoiler: appearance.portraitIsSpoiler,
      portraitMediaId: portraitMediaId.value,
      sortOrder: appearance.sortOrder,
      speciesOverride: emptyToNull(appearance.speciesOverride),
      speciesOverrideIsSpoiler: appearance.speciesOverrideIsSpoiler,
      status: appearance.status,
      statusCustomText: emptyToNull(appearance.statusCustomText),
      statusIsSpoiler: appearance.statusIsSpoiler,
    });
    plan.created.appearances += 1;

    const seenRoleKeys = new Set<string>();
    for (const role of appearance.roles) {
      const customRole = emptyToNull(role.customRole);
      const key = `${role.roleType}::${customRole ?? ""}`;
      if (seenRoleKeys.has(key)) {
        continue;
      }
      seenRoleKeys.add(key);
      plan.roles.push({
        bookCharacterId,
        customRole,
        id: newId(),
        isSpoiler: role.isSpoiler,
        position: role.position,
        roleType: role.roleType,
      });
      plan.created.roles += 1;
    }
  }
}

function planGroup({
  characterIdMap,
  group,
  newId,
  owned,
  plan,
  userId,
}: {
  characterIdMap: Map<string, string>;
  group: CharacterBundle["groups"][number];
  newId: () => string;
  owned: OwnedLibraryRefs;
  plan: CharacterImportPlan;
  userId: string;
}): void {
  const seriesId = resolveOptionalOwned({ id: group.seriesId, owned: owned.seriesIds });
  if (seriesId.unlinked) {
    plan.skipped.unlinkedSeries += 1;
  }
  const groupId = newId();
  plan.groups.push({
    customType: group.type === "custom" ? emptyToNull(group.customType) : null,
    description: emptyToNull(group.description),
    id: groupId,
    isSpoiler: group.isSpoiler,
    name: group.name,
    normalizedName: normalizeName(group.name),
    seriesId: seriesId.value,
    type: group.type,
    userId,
  });
  plan.created.groups += 1;

  const seenMembershipKeys = new Set<string>();
  for (const membership of group.memberships) {
    const freshCharacterId = characterIdMap.get(membership.characterId);
    if (freshCharacterId === undefined) {
      continue;
    }
    if (membership.bookId !== null && !owned.bookIds.has(membership.bookId)) {
      plan.skipped.membershipsMissingBook += 1;
      continue;
    }
    const key = `${freshCharacterId}::${membership.bookId ?? "global"}`;
    if (seenMembershipKeys.has(key)) {
      continue;
    }
    seenMembershipKeys.add(key);
    plan.memberships.push({
      bookId: membership.bookId,
      characterId: freshCharacterId,
      groupId,
      id: newId(),
      isSpoiler: membership.isSpoiler,
      role: emptyToNull(membership.role),
      status: emptyToNull(membership.status),
    });
    plan.created.memberships += 1;
  }
}

function planRelationship({
  characterIdMap,
  newId,
  owned,
  plan,
  relationship,
  seenRelationshipKeys,
  userId,
}: {
  characterIdMap: Map<string, string>;
  newId: () => string;
  owned: OwnedLibraryRefs;
  plan: CharacterImportPlan;
  relationship: CharacterBundle["relationships"][number];
  seenRelationshipKeys: Set<string>;
  userId: string;
}): void {
  const sourceCharacterId = characterIdMap.get(relationship.sourceCharacterId);
  const targetCharacterId = characterIdMap.get(relationship.targetCharacterId);
  if (sourceCharacterId === undefined || targetCharacterId === undefined) {
    return;
  }
  if (sourceCharacterId === targetCharacterId) {
    plan.skipped.relationshipsInvalid += 1;
    return;
  }
  const directionality = RelationshipDirectionalitySchema.parse(relationship.directionality);
  const type = RelationshipTypeSchema.parse(relationship.type);
  const customType = type === "custom" ? emptyToNull(relationship.customType) : null;
  const canonical = canonicalizeRelationshipEndpoints({
    directionality,
    sourceCharacterId,
    sourceLabel: emptyToNull(relationship.sourceLabel),
    targetCharacterId,
    targetLabel: emptyToNull(relationship.targetLabel),
  });
  const dedupKey = buildRelationshipLockKey({
    directionality,
    normalizedCustomType: customType === null ? null : normalizeName(customType),
    sourceCharacterId: canonical.sourceCharacterId,
    targetCharacterId: canonical.targetCharacterId,
    type,
    userId,
  });
  if (seenRelationshipKeys.has(dedupKey)) {
    plan.skipped.relationshipsInvalid += 1;
    return;
  }
  seenRelationshipKeys.add(dedupKey);

  const relationshipId = newId();
  plan.relationships.push({
    category: relationship.category,
    customType,
    directionality,
    id: relationshipId,
    isCanonical: relationship.isCanonical,
    sourceCharacterId: canonical.sourceCharacterId,
    sourceLabel: canonical.sourceLabel,
    targetCharacterId: canonical.targetCharacterId,
    targetLabel: canonical.targetLabel,
    type,
    userId,
  });
  plan.created.relationships += 1;

  const seenBookIds = new Set<string>();
  for (const bookState of relationship.bookStates) {
    if (seenBookIds.has(bookState.bookId)) {
      continue;
    }
    if (!owned.bookIds.has(bookState.bookId)) {
      plan.skipped.bookStatesMissingBook += 1;
      continue;
    }
    seenBookIds.add(bookState.bookId);
    plan.bookStates.push({
      bookId: bookState.bookId,
      description: emptyToNull(bookState.description),
      endedAudioSeconds: bookState.endedAudioSeconds,
      endedChapter: emptyToNull(bookState.endedChapter),
      endedPage: bookState.endedPage,
      hideRelationshipAsSpoiler: bookState.hideRelationshipAsSpoiler,
      id: newId(),
      intensity: bookState.intensity,
      introducedAudioSeconds: bookState.introducedAudioSeconds,
      introducedChapter: emptyToNull(bookState.introducedChapter),
      introducedPage: bookState.introducedPage,
      isDescriptionSpoiler: bookState.isDescriptionSpoiler,
      isTypeSpoiler: bookState.isTypeSpoiler,
      relationshipId,
      status: bookState.status,
    });
    plan.created.bookStates += 1;
  }
}

function planTheory({
  characterIdMap,
  newId,
  owned,
  plan,
  theory,
  userId,
}: {
  characterIdMap: Map<string, string>;
  newId: () => string;
  owned: OwnedLibraryRefs;
  plan: CharacterImportPlan;
  theory: CharacterBundle["theories"][number];
  userId: string;
}): void {
  const characterId =
    theory.characterId === null ? null : (characterIdMap.get(theory.characterId) ?? null);
  const bookId = theory.bookId !== null && owned.bookIds.has(theory.bookId) ? theory.bookId : null;
  const seriesId =
    theory.seriesId !== null && owned.seriesIds.has(theory.seriesId) ? theory.seriesId : null;
  if (characterId === null && bookId === null && seriesId === null) {
    plan.skipped.theoriesWithoutTarget += 1;
    return;
  }
  if (theory.seriesId !== null && seriesId === null) {
    plan.skipped.unlinkedSeries += 1;
  }
  plan.theories.push({
    bookId,
    characterId,
    id: newId(),
    isSpoiler: theory.isSpoiler,
    seriesId,
    status: theory.status,
    text: theory.text,
    userId,
  });
  plan.created.theories += 1;
}

function resolveOptionalOwned({ id, owned }: { id: Nullable<string>; owned: Set<string> }): {
  unlinked: boolean;
  value: Nullable<string>;
} {
  if (id === null) {
    return { unlinked: false, value: null };
  }
  if (owned.has(id)) {
    return { unlinked: false, value: id };
  }
  return { unlinked: true, value: null };
}

function serializeAlias(
  row: ExportAliasRow,
): CharacterBundle["characters"][number]["aliases"][number] {
  return {
    bookId: row.bookId,
    isSpoiler: row.isSpoiler,
    name: row.name,
    position: row.position,
    type: CharacterAliasTypeSchema.parse(row.type),
  };
}

function serializeAppearance(
  row: ExportAppearanceRow,
): CharacterBundle["characters"][number]["appearances"][number] {
  return {
    appearanceNotes: row.appearanceNotes,
    appearanceNotesIsSpoiler: row.appearanceNotesIsSpoiler,
    attitude: row.attitude === null ? null : CharacterAttitudeSchema.parse(row.attitude),
    bookId: row.bookId,
    description: row.description,
    descriptionIsSpoiler: row.descriptionIsSpoiler,
    displayName: row.displayName,
    displayNameIsSpoiler: row.displayNameIsSpoiler,
    firstAppearanceAudioSeconds: row.firstAppearanceAudioSeconds,
    firstAppearanceChapter: row.firstAppearanceChapter,
    firstAppearanceNote: row.firstAppearanceNote,
    firstAppearancePage: row.firstAppearancePage,
    hidePresenceAsSpoiler: row.hidePresenceAsSpoiler,
    importance: BookCharacterImportanceSchema.parse(row.importance),
    isPovCharacter: row.isPovCharacter,
    narratorType:
      row.narratorType === null ? null : BookCharacterNarratorTypeSchema.parse(row.narratorType),
    personalImpression: row.personalImpression,
    personalImpressionIsSpoiler: row.personalImpressionIsSpoiler,
    portraitIsSpoiler: row.portraitIsSpoiler,
    portraitMediaId: row.portraitMediaId,
    roles: row.roles.map(serializeRole),
    sortOrder: row.sortOrder,
    speciesOverride: row.speciesOverride,
    speciesOverrideIsSpoiler: row.speciesOverrideIsSpoiler,
    status: BookCharacterStatusSchema.parse(row.status),
    statusCustomText: row.statusCustomText,
    statusIsSpoiler: row.statusIsSpoiler,
  };
}

function serializeBookState(
  row: ExportBookStateRow,
): CharacterBundle["relationships"][number]["bookStates"][number] {
  return {
    bookId: row.bookId,
    description: row.description,
    endedAudioSeconds: row.endedAudioSeconds,
    endedChapter: row.endedChapter,
    endedPage: row.endedPage,
    hideRelationshipAsSpoiler: row.hideRelationshipAsSpoiler,
    intensity: row.intensity === null ? null : RelationshipIntensitySchema.parse(row.intensity),
    introducedAudioSeconds: row.introducedAudioSeconds,
    introducedChapter: row.introducedChapter,
    introducedPage: row.introducedPage,
    isDescriptionSpoiler: row.isDescriptionSpoiler,
    isTypeSpoiler: row.isTypeSpoiler,
    status: RelationshipBookStateStatusSchema.parse(row.status),
  };
}

function serializeCharacter(row: ExportCharacterRow): CharacterBundle["characters"][number] {
  return {
    aliases: row.aliases.map(serializeAlias),
    appearances: row.bookAppearances.map(serializeAppearance),
    avatarMediaId: row.avatarMediaId,
    customGender: row.customGender,
    entityKind: CharacterEntityKindSchema.parse(row.entityKind),
    gender: CharacterGenderSchema.parse(row.gender),
    globalAttitude:
      row.globalAttitude === null ? null : CharacterAttitudeSchema.parse(row.globalAttitude),
    hideProfileAsSpoiler: row.hideProfileAsSpoiler,
    id: row.id,
    isArchived: row.archivedAt !== null,
    isFavorite: row.isFavorite,
    name: row.name,
    neutralDescription: row.neutralDescription,
    pronouns: row.pronouns,
    species: row.species,
    tagIds: row.tags.map((tag) => tag.tagId),
  };
}

function serializeGroup(row: ExportGroupRow): CharacterBundle["groups"][number] {
  return {
    customType: row.customType,
    description: row.description,
    isSpoiler: row.isSpoiler,
    memberships: row.memberships.map(serializeMembership),
    name: row.name,
    seriesId: row.seriesId,
    type: CharacterGroupTypeSchema.parse(row.type),
  };
}

function serializeMembership(
  row: ExportMembershipRow,
): CharacterBundle["groups"][number]["memberships"][number] {
  return {
    bookId: row.bookId,
    characterId: row.characterId,
    isSpoiler: row.isSpoiler,
    role: row.role,
    status: row.status,
  };
}

function serializeRelationship(
  row: ExportRelationshipRow,
): CharacterBundle["relationships"][number] {
  return {
    bookStates: row.bookStates.map(serializeBookState),
    category: RelationshipCategorySchema.parse(row.category),
    customType: row.customType,
    directionality: RelationshipDirectionalitySchema.parse(row.directionality),
    isCanonical: row.isCanonical,
    sourceCharacterId: row.sourceCharacterId,
    sourceLabel: row.sourceLabel,
    targetCharacterId: row.targetCharacterId,
    targetLabel: row.targetLabel,
    type: RelationshipTypeSchema.parse(row.type),
  };
}

function serializeRole(
  row: ExportRoleRow,
): CharacterBundle["characters"][number]["appearances"][number]["roles"][number] {
  return {
    customRole: row.customRole,
    isSpoiler: row.isSpoiler,
    position: row.position,
    roleType: BookCharacterRoleTypeSchema.parse(row.roleType),
  };
}

function serializeTheory(row: ExportTheoryRow): CharacterBundle["theories"][number] {
  return {
    bookId: row.bookId,
    characterId: row.characterId,
    isSpoiler: row.isSpoiler,
    seriesId: row.seriesId,
    status: CharacterTheoryStatusSchema.parse(row.status),
    text: row.text,
  };
}
