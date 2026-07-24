import type {
  BookCharacterProfileInput,
  CharacterDetailsView,
  CharacterInput,
  UpdateBookCharacter,
  UpdateCharacter,
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
import { z } from "zod";

export const CHARACTER_NAME_MAX = 200;

const ALIAS_SCOPES = ["global", "book"] as const;

const attitudeOrNone = z.union([CharacterAttitudeSchema, z.literal("")]);
const narratorOrNone = z.union([BookCharacterNarratorTypeSchema, z.literal("")]);

export type CharacterFormMessages = {
  customGenderRequired: string;
  nameRequired: string;
  nameTooLong: string;
};

export type CharacterFormValues = z.infer<ReturnType<typeof buildCharacterFormSchema>>;

export function buildCharacterFormSchema(messages: CharacterFormMessages) {
  return z
    .object({
      aliases: z.array(
        z.object({
          isSpoiler: z.boolean(),
          name: z.string(),
          scope: z.enum(ALIAS_SCOPES),
          type: CharacterAliasTypeSchema,
        }),
      ),
      appearanceNotes: z.string(),
      appearanceNotesIsSpoiler: z.boolean(),
      attitude: attitudeOrNone,
      avatarMediaId: z.string().nullable(),
      customGender: z.string(),
      description: z.string(),
      descriptionIsSpoiler: z.boolean(),
      displayName: z.string(),
      displayNameIsSpoiler: z.boolean(),
      entityKind: CharacterEntityKindSchema,
      firstAppearanceChapter: z.string(),
      firstAppearanceNote: z.string(),
      firstAppearancePage: z.string(),
      gender: CharacterGenderSchema,
      globalAttitude: attitudeOrNone,
      hidePresenceAsSpoiler: z.boolean(),
      importance: BookCharacterImportanceSchema,
      isFavorite: z.boolean(),
      isPovCharacter: z.boolean(),
      name: z
        .string()
        .trim()
        .min(1, { error: messages.nameRequired })
        .max(CHARACTER_NAME_MAX, { error: messages.nameTooLong }),
      narratorType: narratorOrNone,
      neutralDescription: z.string(),
      personalImpression: z.string(),
      personalImpressionIsSpoiler: z.boolean(),
      portraitIsSpoiler: z.boolean(),
      portraitMediaId: z.string().nullable(),
      pronouns: z.string(),
      roles: z.array(
        z.object({
          customRole: z.string(),
          isSpoiler: z.boolean(),
          roleType: BookCharacterRoleTypeSchema,
        }),
      ),
      species: z.string(),
      speciesOverride: z.string(),
      speciesOverrideIsSpoiler: z.boolean(),
      status: BookCharacterStatusSchema,
      statusCustomText: z.string(),
      statusIsSpoiler: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.gender === "custom" && value.customGender.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          message: messages.customGenderRequired,
          path: ["customGender"],
        });
      }
    });
}

export function characterToFormValues(
  character: CharacterDetailsView,
  bookId: string,
): CharacterFormValues {
  const appearance = character.appearances.find((entry) => entry.bookId === bookId);
  const base = emptyCharacterFormValues();

  const global: CharacterFormValues = {
    ...base,
    aliases: character.aliases
      .filter((alias) => alias.bookId === null || alias.bookId === bookId)
      .map((alias) => ({
        isSpoiler: alias.isSpoiler,
        name: alias.name,
        scope: alias.bookId === null ? "global" : "book",
        type: alias.type,
      })),
    avatarMediaId: character.avatar?.id ?? null,
    customGender: character.customGender ?? "",
    entityKind: character.entityKind,
    gender: character.gender,
    globalAttitude: character.globalAttitude ?? "",
    isFavorite: character.isFavorite,
    name: character.name,
    neutralDescription: character.neutralDescription ?? "",
    pronouns: character.pronouns ?? "",
    species: character.species ?? "",
  };

  if (appearance === undefined) return global;

  return {
    ...global,
    appearanceNotes: appearance.appearanceNotes ?? "",
    appearanceNotesIsSpoiler: appearance.appearanceNotesIsSpoiler,
    attitude: appearance.attitude ?? "",
    description: appearance.description ?? "",
    descriptionIsSpoiler: appearance.descriptionIsSpoiler,
    displayName: appearance.displayName ?? "",
    displayNameIsSpoiler: appearance.displayNameIsSpoiler,
    firstAppearanceChapter: appearance.firstAppearanceChapter ?? "",
    firstAppearanceNote: appearance.firstAppearanceNote ?? "",
    firstAppearancePage:
      appearance.firstAppearancePage === null ? "" : String(appearance.firstAppearancePage),
    hidePresenceAsSpoiler: appearance.hidePresenceAsSpoiler,
    importance: appearance.importance,
    isPovCharacter: appearance.isPovCharacter,
    narratorType: appearance.narratorType ?? "",
    personalImpression: appearance.personalImpression ?? "",
    personalImpressionIsSpoiler: appearance.personalImpressionIsSpoiler,
    portraitIsSpoiler: appearance.portraitIsSpoiler,
    portraitMediaId: appearance.portrait?.id ?? null,
    roles: appearance.roles.map((role) => ({
      customRole: role.customRole ?? "",
      isSpoiler: role.isSpoiler,
      roleType: role.roleType,
    })),
    speciesOverride: appearance.speciesOverride ?? "",
    speciesOverrideIsSpoiler: appearance.speciesOverrideIsSpoiler,
    status: appearance.status ?? "active",
    statusCustomText: appearance.statusCustomText ?? "",
    statusIsSpoiler: appearance.statusIsSpoiler,
  };
}

export function emptyCharacterFormValues(prefill?: { name?: string }): CharacterFormValues {
  return {
    aliases: [],
    appearanceNotes: "",
    appearanceNotesIsSpoiler: false,
    attitude: "",
    avatarMediaId: null,
    customGender: "",
    description: "",
    descriptionIsSpoiler: false,
    displayName: "",
    displayNameIsSpoiler: false,
    entityKind: "individual",
    firstAppearanceChapter: "",
    firstAppearanceNote: "",
    firstAppearancePage: "",
    gender: "unknown",
    globalAttitude: "",
    hidePresenceAsSpoiler: false,
    importance: "supporting",
    isFavorite: false,
    isPovCharacter: false,
    name: prefill?.name ?? "",
    narratorType: "",
    neutralDescription: "",
    personalImpression: "",
    personalImpressionIsSpoiler: false,
    portraitIsSpoiler: false,
    portraitMediaId: null,
    pronouns: "",
    roles: [],
    species: "",
    speciesOverride: "",
    speciesOverrideIsSpoiler: false,
    status: "active",
    statusCustomText: "",
    statusIsSpoiler: false,
  };
}

export function toBookProfileInput(values: CharacterFormValues): BookCharacterProfileInput {
  return {
    appearanceNotes: textOrNull(values.appearanceNotes),
    appearanceNotesIsSpoiler: values.appearanceNotesIsSpoiler,
    attitude: values.attitude === "" ? null : values.attitude,
    description: textOrNull(values.description),
    descriptionIsSpoiler: values.descriptionIsSpoiler,
    displayName: textOrNull(values.displayName),
    displayNameIsSpoiler: values.displayNameIsSpoiler,
    firstAppearanceChapter: textOrNull(values.firstAppearanceChapter),
    firstAppearanceNote: textOrNull(values.firstAppearanceNote),
    firstAppearancePage: pageOrNull(values.firstAppearancePage),
    hidePresenceAsSpoiler: values.hidePresenceAsSpoiler,
    importance: values.importance,
    isPovCharacter: values.isPovCharacter,
    narratorType: values.narratorType === "" ? null : values.narratorType,
    personalImpression: textOrNull(values.personalImpression),
    personalImpressionIsSpoiler: values.personalImpressionIsSpoiler,
    portraitIsSpoiler: values.portraitIsSpoiler,
    portraitMediaId: values.portraitMediaId,
    roles: mapRoles(values),
    speciesOverride: textOrNull(values.speciesOverride),
    speciesOverrideIsSpoiler: values.speciesOverrideIsSpoiler,
    status: values.status,
    statusCustomText: values.status === "other" ? textOrNull(values.statusCustomText) : null,
    statusIsSpoiler: values.statusIsSpoiler,
  };
}

export function toCharacterInput(values: CharacterFormValues, bookId: string): CharacterInput {
  return {
    aliases: values.aliases
      .filter((alias) => alias.name.trim().length > 0)
      .map((alias) => ({
        bookId: alias.scope === "book" ? bookId : null,
        isSpoiler: alias.isSpoiler,
        name: alias.name.trim(),
        type: alias.type,
      })),
    avatarMediaId: values.avatarMediaId,
    customGender: values.gender === "custom" ? textOrNull(values.customGender) : null,
    entityKind: values.entityKind,
    gender: values.gender,
    globalAttitude: values.globalAttitude === "" ? null : values.globalAttitude,
    hideProfileAsSpoiler: false,
    isFavorite: values.isFavorite,
    name: values.name.trim(),
    neutralDescription: textOrNull(values.neutralDescription),
    pronouns: textOrNull(values.pronouns),
    species: textOrNull(values.species),
  };
}

export function toUpdateBookCharacter(values: CharacterFormValues): UpdateBookCharacter {
  return {
    aliases: values.aliases
      .filter((alias) => alias.scope === "book" && alias.name.trim().length > 0)
      .map((alias) => ({
        isSpoiler: alias.isSpoiler,
        name: alias.name.trim(),
        type: alias.type,
      })),
    appearanceNotes: textOrNull(values.appearanceNotes),
    appearanceNotesIsSpoiler: values.appearanceNotesIsSpoiler,
    attitude: values.attitude === "" ? null : values.attitude,
    description: textOrNull(values.description),
    descriptionIsSpoiler: values.descriptionIsSpoiler,
    displayName: textOrNull(values.displayName),
    displayNameIsSpoiler: values.displayNameIsSpoiler,
    firstAppearanceChapter: textOrNull(values.firstAppearanceChapter),
    firstAppearanceNote: textOrNull(values.firstAppearanceNote),
    firstAppearancePage: pageOrNull(values.firstAppearancePage),
    hidePresenceAsSpoiler: values.hidePresenceAsSpoiler,
    importance: values.importance,
    isPovCharacter: values.isPovCharacter,
    narratorType: values.narratorType === "" ? null : values.narratorType,
    personalImpression: textOrNull(values.personalImpression),
    personalImpressionIsSpoiler: values.personalImpressionIsSpoiler,
    portraitIsSpoiler: values.portraitIsSpoiler,
    portraitMediaId: values.portraitMediaId,
    roles: mapRoles(values),
    speciesOverride: textOrNull(values.speciesOverride),
    speciesOverrideIsSpoiler: values.speciesOverrideIsSpoiler,
    status: values.status,
    statusCustomText: values.status === "other" ? textOrNull(values.statusCustomText) : null,
    statusIsSpoiler: values.statusIsSpoiler,
  };
}

export function toUpdateCharacter(values: CharacterFormValues): UpdateCharacter {
  return {
    aliases: values.aliases
      .filter((alias) => alias.scope === "global" && alias.name.trim().length > 0)
      .map((alias) => ({
        isSpoiler: alias.isSpoiler,
        name: alias.name.trim(),
        type: alias.type,
      })),
    avatarMediaId: values.avatarMediaId,
    customGender: values.gender === "custom" ? textOrNull(values.customGender) : null,
    entityKind: values.entityKind,
    gender: values.gender,
    globalAttitude: values.globalAttitude === "" ? null : values.globalAttitude,
    isFavorite: values.isFavorite,
    name: values.name.trim(),
    neutralDescription: textOrNull(values.neutralDescription),
    pronouns: textOrNull(values.pronouns),
    species: textOrNull(values.species),
  };
}

function mapRoles(values: CharacterFormValues): BookCharacterProfileInput["roles"] {
  return values.roles.map((role, index) => ({
    customRole: role.roleType === "custom" ? textOrNull(role.customRole) : null,
    isSpoiler: role.isSpoiler,
    position: index,
    roleType: role.roleType,
  }));
}

function pageOrNull(value: string): null | number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
