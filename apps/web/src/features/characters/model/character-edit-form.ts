import type {
  BookCharacterView,
  CharacterDetailsView,
  Nullable,
  UpdateBookCharacter,
  UpdateCharacter,
} from "@app/shared";

import {
  BOOK_CHARACTER_UNSPECIFIED,
  BookCharacterImportanceSchema,
  BookCharacterNarratorTypeSchema,
  BookCharacterRoleTypeSchema,
  BookCharacterStatusSchema,
  CHARACTER_TEXT_MAX,
  CharacterAliasTypeSchema,
  CharacterAttitudeSchema,
  CharacterEntityKindSchema,
  CharacterGenderSchema,
} from "@app/shared";
import { z } from "zod";

import type { CharacterAliasRow } from "./character-aliases";

import { findAliasConflicts, toAliasPayload, toAliasRows } from "./character-aliases";
import { BOOK_CHARACTER_ROLE, BOOK_CHARACTER_STATUS } from "./character-options";

export type CharacterEditMessages = {
  aliasDuplicate: string;
  aliasReservedBook: string;
  aliasReservedGlobal: string;
  customGenderRequired: string;
  firstAppearancePageInvalid: string;
  nameRequired: string;
  nameTooLong: string;
  textTooLong: (max: number) => string;
};

export type CharacterEditScope = "book" | "global";

export type CharacterEditValues = z.infer<ReturnType<typeof buildCharacterEditSchema>>;

type CappedText = (max: number) => z.ZodString;

const attitudeOrNone = z.union([CharacterAttitudeSchema, z.literal("")]);

export function buildCharacterEditSchema(messages: CharacterEditMessages) {
  const cappedText: CappedText = (max) => z.string().max(max, { error: messages.textTooLong(max) });

  return z
    .object({
      book: bookScopeSchema(cappedText),
      global: z
        .object({
          aliases: z.array(aliasRowSchema(cappedText)),
          attitude: attitudeOrNone,
          customGender: cappedText(CHARACTER_TEXT_MAX.customGender),
          entityKind: CharacterEntityKindSchema,
          gender: CharacterGenderSchema,
          name: z
            .string()
            .trim()
            .min(1, { error: messages.nameRequired })
            .max(CHARACTER_TEXT_MAX.name, { error: messages.nameTooLong }),
          neutralDescription: cappedText(CHARACTER_TEXT_MAX.longText),
          pronouns: cappedText(CHARACTER_TEXT_MAX.pronouns),
          species: cappedText(CHARACTER_TEXT_MAX.species),
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

export function effectiveCharacterName({
  displayName,
  globalName,
}: {
  displayName: Nullable<string>;
  globalName: string;
}): string {
  const bookName = displayName === null ? null : textOrNull(displayName);
  return bookName ?? globalName.trim();
}

export function emptyBookScopeValues(): CharacterEditValues["book"] {
  return {
    aliases: [],
    appearanceNotes: "",
    appearanceNotesIsSpoiler: false,
    attitude: null,
    description: "",
    descriptionIsSpoiler: false,
    displayName: null,
    displayNameIsSpoiler: false,
    firstAppearanceChapter: "",
    firstAppearanceNote: "",
    firstAppearancePage: "",
    hidePresenceAsSpoiler: false,
    importance: BOOK_CHARACTER_UNSPECIFIED.importance,
    isPovCharacter: false,
    narratorType: null,
    personalImpression: "",
    personalImpressionIsSpoiler: false,
    portraitIsSpoiler: false,
    portraitMediaId: null,
    roles: [],
    speciesOverride: null,
    speciesOverrideIsSpoiler: false,
    status: BOOK_CHARACTER_UNSPECIFIED.status,
    statusCustomText: "",
    statusIsSpoiler: false,
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
    return !isSamePayload(
      toGlobalUpdate(baseline.global, maskedFields),
      toGlobalUpdate(current.global, maskedFields),
    );
  }
  return !isSamePayload(
    toBookUpdate(baseline.book, maskedFields),
    toBookUpdate(current.book, maskedFields),
  );
}

export function maskedEditFields({
  appearance,
  character,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
}): string[] {
  return [
    ...(appearance?.hiddenFields ?? []),
    ...(character.hiddenFields.includes("aliases") ? ["aliases"] : []),
  ];
}

export function toBookUpdate(
  values: CharacterEditValues["book"],
  maskedFields: readonly string[] = [],
): UpdateBookCharacter {
  const maskable = {
    aliases: toAliasPayload(values.aliases),
    attitude: values.attitude,
    displayName: values.displayName === null ? null : textOrNull(values.displayName),
    portraitMediaId: values.portraitMediaId,
    roles: values.roles.map((role, index) => ({
      customRole: role.roleType === BOOK_CHARACTER_ROLE.custom ? textOrNull(role.customRole) : null,
      isSpoiler: role.isSpoiler,
      position: index,
      roleType: role.roleType,
    })),
    speciesOverride: values.speciesOverride === null ? null : textOrNull(values.speciesOverride),
  };

  const page = parseFirstAppearancePage(values.firstAppearancePage);

  return {
    appearanceNotes: textOrNull(values.appearanceNotes),
    appearanceNotesIsSpoiler: values.appearanceNotesIsSpoiler,
    description: textOrNull(values.description),
    descriptionIsSpoiler: values.descriptionIsSpoiler,
    displayNameIsSpoiler: values.displayNameIsSpoiler,
    firstAppearanceChapter: textOrNull(values.firstAppearanceChapter),
    firstAppearanceNote: textOrNull(values.firstAppearanceNote),
    firstAppearancePage: page === "invalid" ? null : page,
    hidePresenceAsSpoiler: values.hidePresenceAsSpoiler,
    importance: values.importance,
    isPovCharacter: values.isPovCharacter,
    narratorType: values.isPovCharacter ? values.narratorType : null,
    personalImpression: textOrNull(values.personalImpression),
    personalImpressionIsSpoiler: values.personalImpressionIsSpoiler,
    portraitIsSpoiler: values.portraitIsSpoiler,
    speciesOverrideIsSpoiler: values.speciesOverrideIsSpoiler,
    status: values.status,
    statusCustomText:
      values.status === BOOK_CHARACTER_STATUS.custom ? textOrNull(values.statusCustomText) : null,
    statusIsSpoiler: values.statusIsSpoiler,
    ...withoutMasked(maskable, maskedFields),
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
            appearanceNotes: appearance.appearanceNotes ?? "",
            appearanceNotesIsSpoiler: appearance.appearanceNotesIsSpoiler,
            attitude: appearance.attitude,
            description: appearance.description ?? "",
            descriptionIsSpoiler: appearance.descriptionIsSpoiler,
            displayName: appearance.displayName,
            displayNameIsSpoiler: appearance.displayNameIsSpoiler,
            firstAppearanceChapter: appearance.firstAppearanceChapter ?? "",
            firstAppearanceNote: appearance.firstAppearanceNote ?? "",
            firstAppearancePage:
              appearance.firstAppearancePage === null ? "" : String(appearance.firstAppearancePage),
            hidePresenceAsSpoiler: appearance.hidePresenceAsSpoiler,
            importance: appearance.importance,
            isPovCharacter: appearance.isPovCharacter,
            narratorType: appearance.narratorType,
            personalImpression: appearance.personalImpression ?? "",
            personalImpressionIsSpoiler: appearance.personalImpressionIsSpoiler,
            portraitIsSpoiler: appearance.portraitIsSpoiler,
            portraitMediaId: appearance.portrait?.id ?? null,
            roles: appearance.roles.map((role) => ({
              customRole: role.customRole ?? "",
              isSpoiler: role.isSpoiler,
              roleType: role.roleType,
            })),
            speciesOverride: appearance.speciesOverride,
            speciesOverrideIsSpoiler: appearance.speciesOverrideIsSpoiler,
            status: appearance.status ?? BOOK_CHARACTER_UNSPECIFIED.status,
            statusCustomText: appearance.statusCustomText ?? "",
            statusIsSpoiler: appearance.statusIsSpoiler,
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

export function toGlobalUpdate(
  values: CharacterEditValues["global"],
  maskedFields: readonly string[] = [],
): UpdateCharacter {
  return {
    customGender: values.gender === "custom" ? textOrNull(values.customGender) : null,
    entityKind: values.entityKind,
    gender: values.gender,
    globalAttitude: values.attitude === "" ? null : values.attitude,
    name: values.name.trim(),
    neutralDescription: textOrNull(values.neutralDescription),
    pronouns: textOrNull(values.pronouns),
    species: textOrNull(values.species),
    ...withoutMasked({ aliases: toAliasPayload(values.aliases) }, maskedFields),
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

function aliasRowSchema(cappedText: CappedText) {
  return z.object({
    isSpoiler: z.boolean(),
    name: cappedText(CHARACTER_TEXT_MAX.name),
    type: CharacterAliasTypeSchema,
  });
}

function bookScopeSchema(cappedText: CappedText) {
  return z.object({
    aliases: z.array(aliasRowSchema(cappedText)),
    appearanceNotes: cappedText(CHARACTER_TEXT_MAX.longText),
    appearanceNotesIsSpoiler: z.boolean(),
    attitude: CharacterAttitudeSchema.nullable(),
    description: cappedText(CHARACTER_TEXT_MAX.longText),
    descriptionIsSpoiler: z.boolean(),
    displayName: cappedText(CHARACTER_TEXT_MAX.shortText).nullable(),
    displayNameIsSpoiler: z.boolean(),
    firstAppearanceChapter: cappedText(CHARACTER_TEXT_MAX.shortText),
    firstAppearanceNote: cappedText(CHARACTER_TEXT_MAX.shortText),
    firstAppearancePage: z.string(),
    hidePresenceAsSpoiler: z.boolean(),
    importance: BookCharacterImportanceSchema,
    isPovCharacter: z.boolean(),
    narratorType: BookCharacterNarratorTypeSchema.nullable(),
    personalImpression: cappedText(CHARACTER_TEXT_MAX.longText),
    personalImpressionIsSpoiler: z.boolean(),
    portraitIsSpoiler: z.boolean(),
    portraitMediaId: z.string().nullable(),
    roles: z.array(
      z.object({
        customRole: z.string(),
        isSpoiler: z.boolean(),
        roleType: BookCharacterRoleTypeSchema,
      }),
    ),
    speciesOverride: cappedText(CHARACTER_TEXT_MAX.shortText).nullable(),
    speciesOverrideIsSpoiler: z.boolean(),
    status: BookCharacterStatusSchema,
    statusCustomText: cappedText(CHARACTER_TEXT_MAX.shortText),
    statusIsSpoiler: z.boolean(),
  });
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
