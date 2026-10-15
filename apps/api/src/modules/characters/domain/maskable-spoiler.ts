import type { Nullable } from "@app/shared";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";

import { emptyToNull } from "./character-fields.js";

export const isMaskableSpoiler = {
  appearanceNotes: (source: {
    appearanceNotes: Nullable<string>;
    appearanceNotesIsSpoiler: boolean;
  }): boolean => source.appearanceNotesIsSpoiler && hasText(source.appearanceNotes),
  description: (source: {
    description: Nullable<string>;
    descriptionIsSpoiler: boolean;
  }): boolean => source.descriptionIsSpoiler && hasText(source.description),
  displayName: (source: {
    displayName: Nullable<string>;
    displayNameIsSpoiler: boolean;
  }): boolean => source.displayNameIsSpoiler && hasText(source.displayName),
  personalImpression: (source: {
    personalImpression: Nullable<string>;
    personalImpressionIsSpoiler: boolean;
  }): boolean => source.personalImpressionIsSpoiler && hasText(source.personalImpression),
  portrait: (source: { portraitIsSpoiler: boolean; portraitMediaId: Nullable<string> }): boolean =>
    source.portraitIsSpoiler && source.portraitMediaId !== null,
  speciesOverride: (source: {
    speciesOverrideId: Nullable<string>;
    speciesOverrideIsSpoiler: boolean;
  }): boolean => source.speciesOverrideIsSpoiler && source.speciesOverrideId !== null,
  status: (source: { status: string; statusIsSpoiler: boolean }): boolean =>
    source.statusIsSpoiler && source.status !== BOOK_CHARACTER_UNSPECIFIED.status,
};

function hasText(value: Nullable<string>): boolean {
  return emptyToNull(value) !== null;
}
