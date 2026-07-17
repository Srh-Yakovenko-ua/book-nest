import type {
  BookCharacterView,
  CharacterDetailsView,
  CharacterGlobalSummaryView,
  CharacterSummaryView,
  MediaView,
  Nullable,
} from "@app/shared";

import {
  BookCharacterImportanceSchema,
  BookCharacterNarratorTypeSchema,
  BookCharacterRoleTypeSchema,
  BookCharacterStatusSchema,
  CharacterAliasTypeSchema,
  CharacterAttitudeSchema,
  CharacterEntityKindSchema,
  CharacterGenderSchema,
} from "@app/shared";

import { emptyToNull } from "./character-fields.js";

export type CharacterAliasSource = {
  bookId: Nullable<string>;
  id: string;
  isSpoiler: boolean;
  name: string;
  position: number;
  type: string;
};

export type CharacterAppearanceSource = SpoilerFlags & {
  appearanceNotes: Nullable<string>;
  attitude: Nullable<string>;
  bookId: string;
  characterId: string;
  createdAt: Date;
  description: Nullable<string>;
  displayName: Nullable<string>;
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
  roles: CharacterRoleSource[];
  sortOrder: Nullable<number>;
  speciesOverride: Nullable<string>;
  status: string;
  statusCustomText: Nullable<string>;
  updatedAt: Date;
};

export type CharacterRoleSource = {
  customRole: Nullable<string>;
  id: string;
  isSpoiler: boolean;
  position: number;
  roleType: string;
};

export type CharacterSource = {
  aliases: CharacterAliasSource[];
  archivedAt: Nullable<Date>;
  createdAt: Date;
  customGender: Nullable<string>;
  entityKind: string;
  gender: string;
  globalAttitude: Nullable<string>;
  id: string;
  isFavorite: boolean;
  name: string;
  neutralDescription: Nullable<string>;
  pronouns: Nullable<string>;
  species: Nullable<string>;
  updatedAt: Date;
};

export type GlobalSummaryCharacterSource = {
  archivedAt: Nullable<Date>;
  customGender: Nullable<string>;
  entityKind: string;
  gender: string;
  globalAttitude: Nullable<string>;
  id: string;
  isFavorite: boolean;
  name: string;
  neutralDescription: Nullable<string>;
  pronouns: Nullable<string>;
  species: Nullable<string>;
};

export type SpoilerFlags = {
  appearanceNotesIsSpoiler: boolean;
  descriptionIsSpoiler: boolean;
  displayNameIsSpoiler: boolean;
  personalImpressionIsSpoiler: boolean;
  portraitIsSpoiler: boolean;
  speciesOverrideIsSpoiler: boolean;
  statusIsSpoiler: boolean;
};

export type SummaryAppearanceSource = SpoilerFlags & {
  displayName: Nullable<string>;
  id: string;
  importance: string;
  status: string;
};

export type SummaryCharacterSource = {
  entityKind: string;
  id: string;
  isFavorite: boolean;
  name: string;
};

export function toBookCharacterView({
  appearance,
  portrait,
}: {
  appearance: CharacterAppearanceSource;
  portrait: Nullable<MediaView>;
}): BookCharacterView {
  return {
    appearanceNotes: emptyToNull(appearance.appearanceNotes),
    appearanceNotesIsSpoiler: appearance.appearanceNotesIsSpoiler,
    attitude:
      appearance.attitude === null ? null : CharacterAttitudeSchema.parse(appearance.attitude),
    bookId: appearance.bookId,
    characterId: appearance.characterId,
    createdAt: appearance.createdAt.toISOString(),
    description: emptyToNull(appearance.description),
    descriptionIsSpoiler: appearance.descriptionIsSpoiler,
    displayName: emptyToNull(appearance.displayName),
    displayNameIsSpoiler: appearance.displayNameIsSpoiler,
    firstAppearanceAudioSeconds: appearance.firstAppearanceAudioSeconds,
    firstAppearanceChapter: emptyToNull(appearance.firstAppearanceChapter),
    firstAppearanceNote: emptyToNull(appearance.firstAppearanceNote),
    firstAppearancePage: appearance.firstAppearancePage,
    hiddenFields: computeHiddenFields(appearance),
    hidePresenceAsSpoiler: appearance.hidePresenceAsSpoiler,
    id: appearance.id,
    importance: BookCharacterImportanceSchema.parse(appearance.importance),
    isPovCharacter: appearance.isPovCharacter,
    narratorType:
      appearance.narratorType === null
        ? null
        : BookCharacterNarratorTypeSchema.parse(appearance.narratorType),
    personalImpression: emptyToNull(appearance.personalImpression),
    personalImpressionIsSpoiler: appearance.personalImpressionIsSpoiler,
    portrait,
    portraitIsSpoiler: appearance.portraitIsSpoiler,
    roles: appearance.roles.map((role) => toRoleView(role)),
    sortOrder: appearance.sortOrder,
    speciesOverride: emptyToNull(appearance.speciesOverride),
    speciesOverrideIsSpoiler: appearance.speciesOverrideIsSpoiler,
    status: BookCharacterStatusSchema.parse(appearance.status),
    statusCustomText: emptyToNull(appearance.statusCustomText),
    statusIsSpoiler: appearance.statusIsSpoiler,
    updatedAt: appearance.updatedAt.toISOString(),
  };
}

export function toCharacterDetailsView({
  appearances,
  avatar,
  character,
}: {
  appearances: BookCharacterView[];
  avatar: Nullable<MediaView>;
  character: CharacterSource;
}): CharacterDetailsView {
  const hiddenFields = [...new Set(appearances.flatMap((appearance) => appearance.hiddenFields))];
  hiddenFields.sort((left, right) => left.localeCompare(right));

  return {
    aliases: character.aliases.map((alias) => toAliasView(alias)),
    appearances,
    archivedAt: character.archivedAt === null ? null : character.archivedAt.toISOString(),
    avatar,
    createdAt: character.createdAt.toISOString(),
    customGender: emptyToNull(character.customGender),
    entityKind: CharacterEntityKindSchema.parse(character.entityKind),
    gender: CharacterGenderSchema.parse(character.gender),
    globalAttitude:
      character.globalAttitude === null
        ? null
        : CharacterAttitudeSchema.parse(character.globalAttitude),
    hiddenFields,
    id: character.id,
    isFavorite: character.isFavorite,
    name: character.name,
    neutralDescription: emptyToNull(character.neutralDescription),
    pronouns: emptyToNull(character.pronouns),
    species: emptyToNull(character.species),
    updatedAt: character.updatedAt.toISOString(),
  };
}

export function toCharacterGlobalSummaryView({
  appearanceCount,
  avatar,
  character,
}: {
  appearanceCount: number;
  avatar: Nullable<MediaView>;
  character: GlobalSummaryCharacterSource;
}): CharacterGlobalSummaryView {
  return {
    appearanceCount,
    archivedAt: character.archivedAt === null ? null : character.archivedAt.toISOString(),
    avatar,
    customGender: emptyToNull(character.customGender),
    entityKind: CharacterEntityKindSchema.parse(character.entityKind),
    gender: CharacterGenderSchema.parse(character.gender),
    globalAttitude:
      character.globalAttitude === null
        ? null
        : CharacterAttitudeSchema.parse(character.globalAttitude),
    id: character.id,
    isFavorite: character.isFavorite,
    name: character.name,
    neutralDescription: emptyToNull(character.neutralDescription),
    pronouns: emptyToNull(character.pronouns),
    species: emptyToNull(character.species),
  };
}

export function toCharacterSummaryView({
  appearance,
  avatar,
  character,
  portrait,
}: {
  appearance: SummaryAppearanceSource;
  avatar: Nullable<MediaView>;
  character: SummaryCharacterSource;
  portrait: Nullable<MediaView>;
}): CharacterSummaryView {
  return {
    avatar,
    characterId: character.id,
    displayName: appearance.displayNameIsSpoiler ? null : emptyToNull(appearance.displayName),
    entityKind: CharacterEntityKindSchema.parse(character.entityKind),
    hiddenFields: computeSummaryHiddenFields(appearance),
    id: appearance.id,
    importance: BookCharacterImportanceSchema.parse(appearance.importance),
    isFavorite: character.isFavorite,
    name: character.name,
    portrait: appearance.portraitIsSpoiler ? null : portrait,
    status: appearance.statusIsSpoiler ? null : BookCharacterStatusSchema.parse(appearance.status),
  };
}

function computeHiddenFields(flags: SpoilerFlags): string[] {
  const hidden: string[] = [];
  if (flags.appearanceNotesIsSpoiler) {
    hidden.push("appearanceNotes");
  }
  if (flags.descriptionIsSpoiler) {
    hidden.push("description");
  }
  if (flags.displayNameIsSpoiler) {
    hidden.push("displayName");
  }
  if (flags.personalImpressionIsSpoiler) {
    hidden.push("personalImpression");
  }
  if (flags.portraitIsSpoiler) {
    hidden.push("portrait");
  }
  if (flags.speciesOverrideIsSpoiler) {
    hidden.push("speciesOverride");
  }
  if (flags.statusIsSpoiler) {
    hidden.push("status");
  }
  return hidden;
}

function computeSummaryHiddenFields(flags: SpoilerFlags): string[] {
  const hidden: string[] = [];
  if (flags.displayNameIsSpoiler) {
    hidden.push("displayName");
  }
  if (flags.portraitIsSpoiler) {
    hidden.push("portrait");
  }
  if (flags.statusIsSpoiler) {
    hidden.push("status");
  }
  return hidden;
}

function toAliasView(alias: CharacterAliasSource): CharacterDetailsView["aliases"][number] {
  return {
    bookId: alias.bookId,
    id: alias.id,
    isSpoiler: alias.isSpoiler,
    name: alias.name,
    position: alias.position,
    type: CharacterAliasTypeSchema.parse(alias.type),
  };
}

function toRoleView(role: CharacterRoleSource): BookCharacterView["roles"][number] {
  return {
    customRole: emptyToNull(role.customRole),
    id: role.id,
    isSpoiler: role.isSpoiler,
    position: role.position,
    roleType: BookCharacterRoleTypeSchema.parse(role.roleType),
  };
}
