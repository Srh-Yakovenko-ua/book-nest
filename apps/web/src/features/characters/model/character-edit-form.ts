import type { CharacterDetailsView, UpdateBookCharacter, UpdateCharacter } from "@app/shared";

import {
  BOOK_CHARACTER_UNSPECIFIED,
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

import type { CharacterAliasRow } from "./character-aliases";

import { findAliasConflicts, toAliasPayload, toAliasRows } from "./character-aliases";
import { CHARACTER_NAME_MAX } from "./character-form-schema";
import { BOOK_CHARACTER_STATUS } from "./character-options";

export type CharacterEditMessages = {
  aliasDuplicate: string;
  aliasReservedBook: string;
  aliasReservedGlobal: string;
  customGenderRequired: string;
  firstAppearancePageInvalid: string;
  nameRequired: string;
  nameTooLong: string;
};

export type CharacterEditScope = "book" | "global";

export type CharacterEditValues = z.infer<ReturnType<typeof buildCharacterEditSchema>>;

const attitudeOrNone = z.union([CharacterAttitudeSchema, z.literal("")]);

const AliasRowSchema = z.object({
  isSpoiler: z.boolean(),
  name: z.string(),
  type: CharacterAliasTypeSchema,
});

const BookScopeSchema = z.object({
  aliases: z.array(AliasRowSchema),
  attitude: CharacterAttitudeSchema.nullable(),
  description: z.string(),
  displayName: z.string().nullable(),
  firstAppearanceChapter: z.string(),
  firstAppearanceNote: z.string(),
  firstAppearancePage: z.string(),
  importance: BookCharacterImportanceSchema,
  isPovCharacter: z.boolean(),
  narratorType: BookCharacterNarratorTypeSchema.nullable(),
  personalImpression: z.string(),
  portraitMediaId: z.string().nullable(),
  roles: z.array(
    z.object({
      customRole: z.string(),
      isSpoiler: z.boolean(),
      roleType: BookCharacterRoleTypeSchema,
    }),
  ),
  speciesOverride: z.string().nullable(),
  status: BookCharacterStatusSchema,
  statusCustomText: z.string(),
});

export function buildCharacterEditSchema(messages: CharacterEditMessages) {
  return z
    .object({
      book: BookScopeSchema,
      global: z
        .object({
          aliases: z.array(AliasRowSchema),
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
    })
    .superRefine((value, ctx) => {
      if (parseFirstAppearancePage(value.book.firstAppearancePage) === "invalid") {
        ctx.addIssue({
          code: "custom",
          message: messages.firstAppearancePageInvalid,
          path: ["book", "firstAppearancePage"],
        });
      }

      addAliasIssues({
        aliases: value.global.aliases,
        ctx,
        duplicateMessage: messages.aliasDuplicate,
        reservedMessage: messages.aliasReservedGlobal,
        reservedName: value.global.name,
        scope: "global",
      });

      addAliasIssues({
        aliases: value.book.aliases,
        ctx,
        duplicateMessage: messages.aliasDuplicate,
        reservedMessage: messages.aliasReservedBook,
        reservedName: value.book.displayName ?? value.global.name,
        scope: "book",
      });
    });
}

export function emptyBookScopeValues(): CharacterEditValues["book"] {
  return {
    aliases: [],
    attitude: null,
    description: "",
    displayName: null,
    firstAppearanceChapter: "",
    firstAppearanceNote: "",
    firstAppearancePage: "",
    importance: BOOK_CHARACTER_UNSPECIFIED.importance,
    isPovCharacter: false,
    narratorType: null,
    personalImpression: "",
    portraitMediaId: null,
    roles: [],
    speciesOverride: null,
    status: BOOK_CHARACTER_UNSPECIFIED.status,
    statusCustomText: "",
  };
}

export function isScopeDirty({
  baseline,
  current,
  maskedFields = [],
  scope,
}: {
  baseline: CharacterEditValues;
  current: CharacterEditValues;
  maskedFields?: readonly string[];
  scope: CharacterEditScope;
}): boolean {
  if (scope === "global") {
    return !isSamePayload(toGlobalUpdate(baseline.global), toGlobalUpdate(current.global));
  }
  return !isSamePayload(
    toBookUpdate(baseline.book, maskedFields),
    toBookUpdate(current.book, maskedFields),
  );
}

export function toBookUpdate(
  values: CharacterEditValues["book"],
  maskedFields: readonly string[] = [],
): UpdateBookCharacter {
  const inherited = {
    attitude: values.attitude,
    displayName: values.displayName === null ? null : textOrNull(values.displayName),
    portraitMediaId: values.portraitMediaId,
    speciesOverride: values.speciesOverride === null ? null : textOrNull(values.speciesOverride),
  };

  const page = parseFirstAppearancePage(values.firstAppearancePage);

  return {
    aliases: toAliasPayload(values.aliases),
    description: textOrNull(values.description),
    firstAppearanceChapter: textOrNull(values.firstAppearanceChapter),
    firstAppearanceNote: textOrNull(values.firstAppearanceNote),
    firstAppearancePage: page === "invalid" ? null : page,
    importance: values.importance,
    isPovCharacter: values.isPovCharacter,
    narratorType: values.isPovCharacter ? values.narratorType : null,
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
    ...withoutMasked(inherited, maskedFields),
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
            aliases: toAliasRows({ bookId: bookId ?? null, character }),
            attitude: appearance.attitude,
            description: appearance.description ?? "",
            displayName: appearance.displayName,
            firstAppearanceChapter: appearance.firstAppearanceChapter ?? "",
            firstAppearanceNote: appearance.firstAppearanceNote ?? "",
            firstAppearancePage:
              appearance.firstAppearancePage === null ? "" : String(appearance.firstAppearancePage),
            importance: appearance.importance,
            isPovCharacter: appearance.isPovCharacter,
            narratorType: appearance.narratorType,
            personalImpression: appearance.personalImpression ?? "",
            portraitMediaId: appearance.portrait?.id ?? null,
            roles: appearance.roles.map((role) => ({
              customRole: role.customRole ?? "",
              isSpoiler: role.isSpoiler,
              roleType: role.roleType,
            })),
            speciesOverride: appearance.speciesOverride,
            status: appearance.status ?? BOOK_CHARACTER_UNSPECIFIED.status,
            statusCustomText: appearance.statusCustomText ?? "",
          },
    global: {
      aliases: toAliasRows({ bookId: null, character }),
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
    aliases: toAliasPayload(values.aliases),
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

function addAliasIssues({
  aliases,
  ctx,
  duplicateMessage,
  reservedMessage,
  reservedName,
  scope,
}: {
  aliases: CharacterAliasRow[];
  ctx: z.RefinementCtx;
  duplicateMessage: string;
  reservedMessage: string;
  reservedName: string;
  scope: CharacterEditScope;
}): void {
  const { duplicateIndexes, reservedIndexes } = findAliasConflicts({ aliases, reservedName });

  for (const index of duplicateIndexes) {
    ctx.addIssue({
      code: "custom",
      message: duplicateMessage,
      path: [scope, "aliases", index, "name"],
    });
  }

  for (const index of reservedIndexes) {
    ctx.addIssue({
      code: "custom",
      message: reservedMessage,
      path: [scope, "aliases", index, "name"],
    });
  }
}

function isSamePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function maskedKeyOf(payloadKey: string): string {
  return payloadKey === "portraitMediaId" ? "portrait" : payloadKey;
}

function parseFirstAppearancePage(value: string): "invalid" | null | number {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const parsed = Number(trimmed);
  return parsed > 0 ? parsed : "invalid";
}

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function withoutMasked<T extends Record<string, unknown>>(
  values: T,
  maskedFields: readonly string[],
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => !maskedFields.includes(maskedKeyOf(key))),
  ) as Partial<T>;
}
