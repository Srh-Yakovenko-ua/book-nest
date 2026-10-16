import type { BookCharacterRosterItem, MediaView, Nullable } from "@app/shared";

import { BookCharacterStatusSchema } from "@app/shared";

import type { SpeciesRefSource } from "../../species/index.js";
import type {
  CharacterRoleSource,
  SummaryAppearanceSource,
  SummaryCharacterSource,
} from "./character.mapper.js";

import { toSpeciesRefView } from "../../species/index.js";
import { emptyToNull } from "./character-fields.js";
import { toCharacterSummaryView, toRoleView } from "./character.mapper.js";
import { isMaskableSpoiler } from "./maskable-spoiler.js";

export type RosterItemAppearanceSource = SummaryAppearanceSource & {
  description: Nullable<string>;
  descriptionIsSpoiler: boolean;
  roles: CharacterRoleSource[];
  speciesOverride: Nullable<SpeciesRefSource>;
  speciesOverrideId: Nullable<string>;
  speciesOverrideIsSpoiler: boolean;
  statusCustomText: Nullable<string>;
};

export type RosterItemCharacterSource = SummaryCharacterSource & {
  neutralDescription: Nullable<string>;
  species: Nullable<SpeciesRefSource>;
};

export function toBookCharacterRosterItem({
  appearance,
  avatar,
  character,
  portrait,
}: {
  appearance: RosterItemAppearanceSource;
  avatar: Nullable<MediaView>;
  character: RosterItemCharacterSource;
  portrait: Nullable<MediaView>;
}): BookCharacterRosterItem {
  const summary = toCharacterSummaryView({ appearance, avatar, character, portrait });
  const hiddenGroups = {
    description: isMaskableSpoiler.description(appearance),
    displayName: isMaskableSpoiler.displayName(appearance),
    portrait: isMaskableSpoiler.portrait(appearance),
    roles: appearance.roles.some((role) => role.isSpoiler),
    speciesOverride: isMaskableSpoiler.speciesOverride(appearance),
    status: isMaskableSpoiler.status(appearance),
  };

  return {
    ...summary,
    descriptionPreview:
      (hiddenGroups.description ? null : emptyToNull(appearance.description)) ??
      emptyToNull(character.neutralDescription),
    hiddenFields: Object.entries(hiddenGroups)
      .filter(([, isHidden]) => isHidden)
      .map(([group]) => group),
    roles: appearance.roles.filter((role) => !role.isSpoiler).map((role) => toRoleView(role)),
    species: hiddenGroups.speciesOverride
      ? null
      : toSpeciesRefView(appearance.speciesOverride ?? character.species),
    statusCustomText:
      summary.status === BookCharacterStatusSchema.enum.other
        ? emptyToNull(appearance.statusCustomText)
        : null,
  };
}
