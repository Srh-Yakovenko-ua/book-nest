import type { BookCharacterProfileInput, UpdateBookCharacter } from "@app/shared";

import { normalizeName } from "@app/shared";

import type {
  CreateBookCharacterData,
  CreateRoleData,
  UpdateBookCharacterData,
} from "../infrastructure/characters.repository.js";

import { emptyToNull } from "./character-fields.js";

export function buildBookCharacterData({
  bookId,
  characterId,
  profile,
}: {
  bookId: string;
  characterId: string;
  profile: BookCharacterProfileInput;
}): CreateBookCharacterData {
  return {
    appearanceNotes: emptyToNull(profile.appearanceNotes),
    appearanceNotesIsSpoiler: profile.appearanceNotesIsSpoiler,
    attitude: profile.attitude ?? null,
    bookId,
    characterId,
    description: emptyToNull(profile.description),
    descriptionIsSpoiler: profile.descriptionIsSpoiler,
    displayName: emptyToNull(profile.displayName),
    displayNameIsSpoiler: profile.displayNameIsSpoiler,
    firstAppearanceAudioSeconds: profile.firstAppearanceAudioSeconds ?? null,
    firstAppearanceChapter: emptyToNull(profile.firstAppearanceChapter),
    firstAppearanceNote: emptyToNull(profile.firstAppearanceNote),
    firstAppearancePage: profile.firstAppearancePage ?? null,
    hidePresenceAsSpoiler: profile.hidePresenceAsSpoiler,
    importance: profile.importance,
    isPovCharacter: profile.isPovCharacter,
    narratorType: profile.narratorType ?? null,
    personalImpression: emptyToNull(profile.personalImpression),
    personalImpressionIsSpoiler: profile.personalImpressionIsSpoiler,
    portraitIsSpoiler: profile.portraitIsSpoiler,
    portraitMediaId: profile.portraitMediaId ?? null,
    roles: dedupeRoles(profile.roles).map((role) => ({
      customRole: emptyToNull(role.customRole),
      isSpoiler: role.isSpoiler,
      position: role.position ?? 0,
      roleType: role.roleType,
    })),
    sortOrder: profile.sortOrder ?? null,
    speciesOverride: emptyToNull(profile.speciesOverride),
    speciesOverrideIsSpoiler: profile.speciesOverrideIsSpoiler,
    status: profile.status,
    statusCustomText: emptyToNull(profile.statusCustomText),
    statusIsSpoiler: profile.statusIsSpoiler,
  };
}

export function buildBookCharacterUpdateData(input: UpdateBookCharacter): UpdateBookCharacterData {
  const data: UpdateBookCharacterData = {};
  if (input.displayName !== undefined) {
    data.displayName = emptyToNull(input.displayName);
  }
  if (input.displayNameIsSpoiler !== undefined) {
    data.displayNameIsSpoiler = input.displayNameIsSpoiler;
  }
  if (input.importance !== undefined) {
    data.importance = input.importance;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.statusCustomText !== undefined) {
    data.statusCustomText = emptyToNull(input.statusCustomText);
  }
  if (input.statusIsSpoiler !== undefined) {
    data.statusIsSpoiler = input.statusIsSpoiler;
  }
  if (input.description !== undefined) {
    data.description = emptyToNull(input.description);
  }
  if (input.descriptionIsSpoiler !== undefined) {
    data.descriptionIsSpoiler = input.descriptionIsSpoiler;
  }
  if (input.personalImpression !== undefined) {
    data.personalImpression = emptyToNull(input.personalImpression);
  }
  if (input.personalImpressionIsSpoiler !== undefined) {
    data.personalImpressionIsSpoiler = input.personalImpressionIsSpoiler;
  }
  if (input.appearanceNotes !== undefined) {
    data.appearanceNotes = emptyToNull(input.appearanceNotes);
  }
  if (input.appearanceNotesIsSpoiler !== undefined) {
    data.appearanceNotesIsSpoiler = input.appearanceNotesIsSpoiler;
  }
  if (input.speciesOverride !== undefined) {
    data.speciesOverride = emptyToNull(input.speciesOverride);
  }
  if (input.speciesOverrideIsSpoiler !== undefined) {
    data.speciesOverrideIsSpoiler = input.speciesOverrideIsSpoiler;
  }
  if (input.portraitMediaId !== undefined) {
    data.portraitMediaId = input.portraitMediaId ?? null;
  }
  if (input.portraitIsSpoiler !== undefined) {
    data.portraitIsSpoiler = input.portraitIsSpoiler;
  }
  if (input.attitude !== undefined) {
    data.attitude = input.attitude ?? null;
  }
  if (input.firstAppearanceChapter !== undefined) {
    data.firstAppearanceChapter = emptyToNull(input.firstAppearanceChapter);
  }
  if (input.firstAppearancePage !== undefined) {
    data.firstAppearancePage = input.firstAppearancePage ?? null;
  }
  if (input.firstAppearanceAudioSeconds !== undefined) {
    data.firstAppearanceAudioSeconds = input.firstAppearanceAudioSeconds ?? null;
  }
  if (input.firstAppearanceNote !== undefined) {
    data.firstAppearanceNote = emptyToNull(input.firstAppearanceNote);
  }
  if (input.isPovCharacter !== undefined) {
    data.isPovCharacter = input.isPovCharacter;
  }
  if (input.narratorType !== undefined) {
    data.narratorType = input.narratorType ?? null;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder ?? null;
  }
  if (input.hidePresenceAsSpoiler !== undefined) {
    data.hidePresenceAsSpoiler = input.hidePresenceAsSpoiler;
  }
  return data;
}

export function buildReplaceRoles(
  roles: NonNullable<UpdateBookCharacter["roles"]>,
): CreateRoleData[] {
  return dedupeRoles(roles).map((role) => ({
    customRole: emptyToNull(role.customRole),
    isSpoiler: role.isSpoiler,
    position: role.position ?? 0,
    roleType: role.roleType,
  }));
}

function dedupeRoles(
  roles: BookCharacterProfileInput["roles"],
): BookCharacterProfileInput["roles"] {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = `${role.roleType}::${normalizeName(role.customRole ?? "")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
