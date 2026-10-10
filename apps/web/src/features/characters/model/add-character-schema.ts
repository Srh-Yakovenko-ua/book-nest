import type { BookCharacterProfileInput, CharacterInput, CreateCharacterInBook } from "@app/shared";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";

const BOOK_PROFILE_DEFAULTS = {
  appearanceNotes: null,
  appearanceNotesIsSpoiler: false,
  attitude: null,
  description: null,
  descriptionIsSpoiler: false,
  displayName: null,
  displayNameIsSpoiler: false,
  firstAppearanceAudioSeconds: null,
  firstAppearanceChapter: null,
  firstAppearanceNote: null,
  firstAppearancePage: null,
  hidePresenceAsSpoiler: false,
  importance: BOOK_CHARACTER_UNSPECIFIED.importance,
  isPovCharacter: false,
  narratorType: null,
  personalImpression: null,
  personalImpressionIsSpoiler: false,
  portraitIsSpoiler: false,
  portraitMediaId: null,
  roles: [],
  sortOrder: null,
  speciesOverrideId: null,
  speciesOverrideIsSpoiler: false,
  status: BOOK_CHARACTER_UNSPECIFIED.status,
  statusCustomText: null,
  statusIsSpoiler: false,
} as const satisfies BookCharacterProfileInput;

const CHARACTER_DEFAULTS = {
  aliases: [],
  avatarMediaId: null,
  customGender: null,
  entityKind: "individual",
  gender: "unknown",
  globalAttitude: null,
  hideProfileAsSpoiler: false,
  isFavorite: false,
  neutralDescription: null,
  pronouns: null,
  speciesId: null,
} as const satisfies Omit<CharacterInput, "name">;

export function toCreateNewCharacterInBook(name: string): CreateCharacterInBook {
  return {
    bookProfile: BOOK_PROFILE_DEFAULTS,
    character: { ...CHARACTER_DEFAULTS, name },
    mode: "new",
  };
}

export function toLinkExistingCharacterInBook(characterId: string): CreateCharacterInBook {
  return { bookProfile: BOOK_PROFILE_DEFAULTS, characterId, mode: "existing" };
}
