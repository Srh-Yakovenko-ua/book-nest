import type { CharacterDetailsView, UpdateBookCharacter, UpdateCharacter } from "@app/shared";

import {
  BOOK_CHARACTER_UNSPECIFIED,
  BookCharacterImportanceSchema,
  BookCharacterRoleTypeSchema,
  BookCharacterStatusSchema,
  CharacterAttitudeSchema,
  CharacterEntityKindSchema,
  CharacterGenderSchema,
} from "@app/shared";
import { z } from "zod";

import { CHARACTER_NAME_MAX } from "./character-form-schema";
import { BOOK_CHARACTER_STATUS } from "./character-options";

export type CharacterEditMessages = {
  customGenderRequired: string;
  nameRequired: string;
  nameTooLong: string;
};

export type CharacterEditScope = "book" | "global";

export type CharacterEditValues = z.infer<ReturnType<typeof buildCharacterEditSchema>>;

const attitudeOrNone = z.union([CharacterAttitudeSchema, z.literal("")]);

const BookScopeSchema = z.object({
  description: z.string(),
  importance: BookCharacterImportanceSchema,
  personalImpression: z.string(),
  roles: z.array(
    z.object({
      customRole: z.string(),
      isSpoiler: z.boolean(),
      roleType: BookCharacterRoleTypeSchema,
    }),
  ),
  status: BookCharacterStatusSchema,
  statusCustomText: z.string(),
});

export function buildCharacterEditSchema(messages: CharacterEditMessages) {
  return z.object({
    book: BookScopeSchema,
    global: z
      .object({
        attitude: attitudeOrNone,
        customGender: z.string(),
        entityKind: CharacterEntityKindSchema,
        gender: CharacterGenderSchema,
        name: z
          .string()
          .trim()
          .min(1, { error: messages.nameRequired })
          .max(CHARACTER_NAME_MAX, { error: messages.nameTooLong }),
        neutralDescription: z.string(),
        pronouns: z.string(),
        species: z.string(),
      })
      .superRefine((value, ctx) => {
        if (value.gender === "custom" && value.customGender.trim().length === 0) {
          ctx.addIssue({
            code: "custom",
            message: messages.customGenderRequired,
            path: ["customGender"],
          });
        }
      }),
  });
}

export function emptyBookScopeValues(): CharacterEditValues["book"] {
  return {
    description: "",
    importance: BOOK_CHARACTER_UNSPECIFIED.importance,
    personalImpression: "",
    roles: [],
    status: BOOK_CHARACTER_UNSPECIFIED.status,
    statusCustomText: "",
  };
}

export function isScopeDirty({
  baseline,
  current,
  scope,
}: {
  baseline: CharacterEditValues;
  current: CharacterEditValues;
  scope: CharacterEditScope;
}): boolean {
  if (scope === "global") {
    return !isSamePayload(toGlobalUpdate(baseline.global), toGlobalUpdate(current.global));
  }
  return !isSamePayload(toBookUpdate(baseline.book), toBookUpdate(current.book));
}

export function toBookUpdate(values: CharacterEditValues["book"]): UpdateBookCharacter {
  return {
    description: textOrNull(values.description),
    importance: values.importance,
    personalImpression: textOrNull(values.personalImpression),
    roles: values.roles.map((role, index) => ({
      customRole: role.roleType === "custom" ? textOrNull(role.customRole) : null,
      isSpoiler: role.isSpoiler,
      position: index,
      roleType: role.roleType,
    })),
    status: values.status,
    statusCustomText:
      values.status === BOOK_CHARACTER_STATUS.custom ? textOrNull(values.statusCustomText) : null,
  };
}

export function toCharacterEditValues(
  character: CharacterDetailsView,
  bookId: string | undefined,
): CharacterEditValues {
  const appearance =
    bookId === undefined
      ? undefined
      : character.appearances.find((entry) => entry.bookId === bookId);

  return {
    book:
      appearance === undefined
        ? emptyBookScopeValues()
        : {
            description: appearance.description ?? "",
            importance: appearance.importance,
            personalImpression: appearance.personalImpression ?? "",
            roles: appearance.roles.map((role) => ({
              customRole: role.customRole ?? "",
              isSpoiler: role.isSpoiler,
              roleType: role.roleType,
            })),
            status: appearance.status ?? BOOK_CHARACTER_UNSPECIFIED.status,
            statusCustomText: appearance.statusCustomText ?? "",
          },
    global: {
      attitude: character.globalAttitude ?? "",
      customGender: character.customGender ?? "",
      entityKind: character.entityKind,
      gender: character.gender,
      name: character.name,
      neutralDescription: character.neutralDescription ?? "",
      pronouns: character.pronouns ?? "",
      species: character.species ?? "",
    },
  };
}

export function toGlobalUpdate(values: CharacterEditValues["global"]): UpdateCharacter {
  return {
    customGender: values.gender === "custom" ? textOrNull(values.customGender) : null,
    entityKind: values.entityKind,
    gender: values.gender,
    globalAttitude: values.attitude === "" ? null : values.attitude,
    name: values.name.trim(),
    neutralDescription: textOrNull(values.neutralDescription),
    pronouns: textOrNull(values.pronouns),
    species: textOrNull(values.species),
  };
}

function isSamePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
