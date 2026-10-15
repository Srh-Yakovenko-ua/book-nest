import type { BookCharacterStatus, CharacterRevealFieldKey, Nullable } from "@app/shared";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";

import type { SpeciesSelection } from "@/features/species";

export const hasSpoilerValue = {
  appearanceNotesIsSpoiler: (appearanceNotes: string) => hasText(appearanceNotes),
  descriptionIsSpoiler: (description: string) => hasText(description),
  displayNameIsSpoiler: (displayName: Nullable<string>) =>
    displayName !== null && hasText(displayName),
  personalImpressionIsSpoiler: (personalImpression: string) => hasText(personalImpression),
  portraitIsSpoiler: (portraitMediaId: Nullable<string>) => portraitMediaId !== null,
  speciesOverrideIsSpoiler: (speciesOverride: Nullable<SpeciesSelection>) =>
    speciesOverride !== null,
  statusIsSpoiler: (status: BookCharacterStatus) => status !== BOOK_CHARACTER_UNSPECIFIED.status,
} as const;

export type BookSpoilerFlag = keyof typeof hasSpoilerValue;

export const REVEAL_KEY_BY_SPOILER_FLAG = {
  appearanceNotesIsSpoiler: "appearanceNotes",
  descriptionIsSpoiler: "description",
  displayNameIsSpoiler: "displayName",
  personalImpressionIsSpoiler: "personalImpression",
  portraitIsSpoiler: "portrait",
  speciesOverrideIsSpoiler: "speciesOverride",
  statusIsSpoiler: "status",
} as const satisfies Record<BookSpoilerFlag, CharacterRevealFieldKey>;

type SpoilerFlags = Record<BookSpoilerFlag, boolean>;

type SpoilerValues = {
  appearanceNotes: string;
  description: string;
  displayName: Nullable<string>;
  personalImpression: string;
  portraitMediaId: Nullable<string>;
  speciesOverride: Nullable<SpeciesSelection>;
  status: BookCharacterStatus;
};

export function spoilerValuePresence(values: SpoilerValues): SpoilerFlags {
  return {
    appearanceNotesIsSpoiler: hasSpoilerValue.appearanceNotesIsSpoiler(values.appearanceNotes),
    descriptionIsSpoiler: hasSpoilerValue.descriptionIsSpoiler(values.description),
    displayNameIsSpoiler: hasSpoilerValue.displayNameIsSpoiler(values.displayName),
    personalImpressionIsSpoiler: hasSpoilerValue.personalImpressionIsSpoiler(
      values.personalImpression,
    ),
    portraitIsSpoiler: hasSpoilerValue.portraitIsSpoiler(values.portraitMediaId),
    speciesOverrideIsSpoiler: hasSpoilerValue.speciesOverrideIsSpoiler(values.speciesOverride),
    statusIsSpoiler: hasSpoilerValue.statusIsSpoiler(values.status),
  };
}

export function withoutEmptySpoilerFlags<T extends SpoilerFlags & SpoilerValues>(
  values: T,
  maskedFields: readonly string[] = [],
): T {
  const present = spoilerValuePresence(values);
  const keepsFlag = (flag: BookSpoilerFlag) =>
    values[flag] && (present[flag] || maskedFields.includes(REVEAL_KEY_BY_SPOILER_FLAG[flag]));
  return {
    ...values,
    appearanceNotesIsSpoiler: keepsFlag("appearanceNotesIsSpoiler"),
    descriptionIsSpoiler: keepsFlag("descriptionIsSpoiler"),
    displayNameIsSpoiler: keepsFlag("displayNameIsSpoiler"),
    personalImpressionIsSpoiler: keepsFlag("personalImpressionIsSpoiler"),
    portraitIsSpoiler: keepsFlag("portraitIsSpoiler"),
    speciesOverrideIsSpoiler: keepsFlag("speciesOverrideIsSpoiler"),
    statusIsSpoiler: keepsFlag("statusIsSpoiler"),
  };
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}
