import type {
  BookCharacterView,
  CharacterDetailsView,
  CharacterGlobalSummaryView,
  CharacterRevealFieldKey,
  CharacterSeriesProfileView,
  CharacterSummaryView,
  MediaView,
  Nullable,
  SeriesCharacterAppearanceView,
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
import { compareAsc } from "date-fns";

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
  tags: { tag: { id: string; name: string } }[];
};

export type SeriesProfileAppearanceSource = SummaryHiddenFieldFlags & {
  attitude: Nullable<string>;
  bookId: string;
  createdAt: Date;
  displayName: Nullable<string>;
  id: string;
  importance: string;
  portrait: Nullable<MediaView>;
  roles: CharacterRoleSource[];
  status: string;
};

export type SeriesProfileCharacterSource = {
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

export type SummaryHiddenFieldFlags = {
  displayNameIsSpoiler: boolean;
  portraitIsSpoiler: boolean;
  statusIsSpoiler: boolean;
};

type SeriesAppearancePoint = Omit<
  SeriesCharacterAppearanceView,
  "attitudeChangedFromPrevious" | "importanceChangedFromPrevious" | "statusChangedFromPrevious"
>;

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
    tags: character.tags.map((link) => ({ id: link.tag.id, name: link.tag.name })),
  };
}

export function toCharacterSeriesProfileView({
  aliases,
  appearances,
  avatar,
  character,
  partNumberByBookId,
}: {
  aliases: CharacterAliasSource[];
  appearances: SeriesProfileAppearanceSource[];
  avatar: Nullable<MediaView>;
  character: SeriesProfileCharacterSource;
  partNumberByBookId: Map<string, Nullable<number>>;
}): CharacterSeriesProfileView {
  const ordered = [...appearances].sort(
    (left, right) =>
      comparePartNumberAscNullsLast(
        partNumberByBookId.get(left.bookId) ?? null,
        partNumberByBookId.get(right.bookId) ?? null,
      ) || compareAsc(left.createdAt, right.createdAt),
  );
  const points = ordered.map((appearance) =>
    toSeriesAppearancePoint({
      appearance,
      partNumber: partNumberByBookId.get(appearance.bookId) ?? null,
    }),
  );
  const entries = attachArcChangeMarkers(points);

  const hiddenFields = [...new Set(entries.flatMap((entry) => entry.hiddenFields))];
  hiddenFields.sort((left, right) => left.localeCompare(right));

  return {
    aliases: aliases.map((alias) => toAliasView(alias)),
    appearances: entries,
    avatar,
    characterId: character.id,
    customGender: emptyToNull(character.customGender),
    entityKind: CharacterEntityKindSchema.parse(character.entityKind),
    gender: CharacterGenderSchema.parse(character.gender),
    globalAttitude:
      character.globalAttitude === null
        ? null
        : CharacterAttitudeSchema.parse(character.globalAttitude),
    hiddenFields,
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

export function toMaskedBookCharacterView({
  appearance,
  portrait,
  revealedFields,
}: {
  appearance: CharacterAppearanceSource;
  portrait: Nullable<MediaView>;
  revealedFields: ReadonlySet<CharacterRevealFieldKey>;
}): BookCharacterView {
  const hiddenFields: string[] = [];
  const isVisible = (field: CharacterRevealFieldKey, isSpoiler: boolean): boolean => {
    if (!isSpoiler || revealedFields.has(field)) {
      return true;
    }
    hiddenFields.push(field);
    return false;
  };

  const showAppearanceNotes = isVisible("appearanceNotes", appearance.appearanceNotesIsSpoiler);
  const showDescription = isVisible("description", appearance.descriptionIsSpoiler);
  const showDisplayName = isVisible("displayName", appearance.displayNameIsSpoiler);
  const showPersonalImpression = isVisible(
    "personalImpression",
    appearance.personalImpressionIsSpoiler,
  );
  const showPortrait = isVisible("portrait", appearance.portraitIsSpoiler);
  const showSpeciesOverride = isVisible("speciesOverride", appearance.speciesOverrideIsSpoiler);
  const showStatus = isVisible("status", appearance.statusIsSpoiler);

  return {
    appearanceNotes: showAppearanceNotes ? emptyToNull(appearance.appearanceNotes) : null,
    appearanceNotesIsSpoiler: appearance.appearanceNotesIsSpoiler,
    attitude:
      appearance.attitude === null ? null : CharacterAttitudeSchema.parse(appearance.attitude),
    bookId: appearance.bookId,
    characterId: appearance.characterId,
    createdAt: appearance.createdAt.toISOString(),
    description: showDescription ? emptyToNull(appearance.description) : null,
    descriptionIsSpoiler: appearance.descriptionIsSpoiler,
    displayName: showDisplayName ? emptyToNull(appearance.displayName) : null,
    displayNameIsSpoiler: appearance.displayNameIsSpoiler,
    firstAppearanceAudioSeconds: appearance.firstAppearanceAudioSeconds,
    firstAppearanceChapter: emptyToNull(appearance.firstAppearanceChapter),
    firstAppearanceNote: emptyToNull(appearance.firstAppearanceNote),
    firstAppearancePage: appearance.firstAppearancePage,
    hiddenFields,
    hidePresenceAsSpoiler: appearance.hidePresenceAsSpoiler,
    id: appearance.id,
    importance: BookCharacterImportanceSchema.parse(appearance.importance),
    isPovCharacter: appearance.isPovCharacter,
    narratorType:
      appearance.narratorType === null
        ? null
        : BookCharacterNarratorTypeSchema.parse(appearance.narratorType),
    personalImpression: showPersonalImpression ? emptyToNull(appearance.personalImpression) : null,
    personalImpressionIsSpoiler: appearance.personalImpressionIsSpoiler,
    portrait: showPortrait ? portrait : null,
    portraitIsSpoiler: appearance.portraitIsSpoiler,
    roles: appearance.roles.filter((role) => !role.isSpoiler).map((role) => toRoleView(role)),
    sortOrder: appearance.sortOrder,
    speciesOverride: showSpeciesOverride ? emptyToNull(appearance.speciesOverride) : null,
    speciesOverrideIsSpoiler: appearance.speciesOverrideIsSpoiler,
    status: showStatus ? BookCharacterStatusSchema.parse(appearance.status) : null,
    statusCustomText: showStatus ? emptyToNull(appearance.statusCustomText) : null,
    statusIsSpoiler: appearance.statusIsSpoiler,
    updatedAt: appearance.updatedAt.toISOString(),
  };
}

function attachArcChangeMarkers(points: SeriesAppearancePoint[]): SeriesCharacterAppearanceView[] {
  return points.map((point, index) => {
    const previous = points[index - 1];
    return {
      ...point,
      attitudeChangedFromPrevious: previous !== undefined && previous.attitude !== point.attitude,
      importanceChangedFromPrevious:
        previous !== undefined && previous.importance !== point.importance,
      statusChangedFromPrevious: previous !== undefined && previous.status !== point.status,
    };
  });
}

function comparePartNumberAscNullsLast(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
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

function computeSummaryHiddenFields(flags: SummaryHiddenFieldFlags): string[] {
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

function toSeriesAppearancePoint({
  appearance,
  partNumber,
}: {
  appearance: SeriesProfileAppearanceSource;
  partNumber: Nullable<number>;
}): SeriesAppearancePoint {
  return {
    attitude:
      appearance.attitude === null ? null : CharacterAttitudeSchema.parse(appearance.attitude),
    bookCharacterId: appearance.id,
    bookId: appearance.bookId,
    displayName: appearance.displayNameIsSpoiler ? null : emptyToNull(appearance.displayName),
    hiddenFields: computeSummaryHiddenFields(appearance),
    importance: BookCharacterImportanceSchema.parse(appearance.importance),
    partNumber,
    portrait: appearance.portraitIsSpoiler ? null : appearance.portrait,
    roles: appearance.roles.filter((role) => !role.isSpoiler).map((role) => toRoleView(role)),
    status: appearance.statusIsSpoiler ? null : BookCharacterStatusSchema.parse(appearance.status),
  };
}
