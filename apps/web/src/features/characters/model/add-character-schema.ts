import type { BookCharacterProfileInput, CharacterInput, CreateCharacterInBook } from "@app/shared";

import { BOOK_CHARACTER_UNSPECIFIED, CHARACTER_NAME_MAX } from "@app/shared";
import { z } from "zod";

export const ADD_CHARACTER_DESCRIPTION_MAX = 5000;

export type AddCharacterMessages = {
  nameRequired: string;
  nameTooLong: string;
};

export type AddCharacterValues = z.infer<ReturnType<typeof buildAddCharacterSchema>>;

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
  speciesOverride: null,
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
  species: null,
} as const satisfies Omit<CharacterInput, "name">;

export function buildAddCharacterSchema(messages: AddCharacterMessages) {
  return z.object({
    description: z.string().max(ADD_CHARACTER_DESCRIPTION_MAX),
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(CHARACTER_NAME_MAX, messages.nameTooLong),
  });
}

export function emptyAddCharacterValues(name = ""): AddCharacterValues {
  return { description: "", name };
}

export function toCreateNewCharacterInBook(values: AddCharacterValues): CreateCharacterInBook {
  const description = values.description.trim();

  return {
    bookProfile: { ...BOOK_PROFILE_DEFAULTS, description: description === "" ? null : description },
    character: { ...CHARACTER_DEFAULTS, name: values.name.trim() },
    mode: "new",
  };
}

export function toLinkExistingCharacterInBook(characterId: string): CreateCharacterInBook {
  return { bookProfile: BOOK_PROFILE_DEFAULTS, characterId, mode: "existing" };
}
