import type {
  BookCharacterView,
  CatalogLocale,
  CharacterDetailsView,
  CharacterRevealFieldKey,
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

import type { BookPageCeiling } from "@/features/books/model/book-page-ceiling";
import type { OwnSpeciesChange } from "@/features/species";

import {
  applyOwnSpeciesChange,
  selectionFromRef,
  SpeciesSelectionSchema,
} from "@/features/species";

import type { CharacterAliasRow } from "./character-aliases";

import {
  hasSpoilerValue,
  REVEAL_KEY_BY_SPOILER_FLAG,
  withoutEmptySpoilerFlags,
} from "./book-spoiler-flags";
import { findAliasConflicts, toAliasPayload, toAliasRows } from "./character-aliases";
import { BOOK_CHARACTER_ROLE, BOOK_CHARACTER_STATUS } from "./character-options";

export type CharacterEditMessages = {
  aliasDuplicate: string;
  aliasReservedBook: string;
  aliasReservedGlobal: string;
  customGenderRequired: string;
  firstAppearancePageExceedsBook: string;
  firstAppearancePageInvalid: string;
  nameRequired: string;
  nameTooLong: string;
  textTooLong: (max: number) => string;
};

export type CharacterEditScope = "book" | "global";

export type CharacterEditValues = z.infer<ReturnType<typeof buildCharacterEditSchema>>;

type CappedText = (max: number) => z.ZodString;

type FirstAppearancePageSchema = ReturnType<typeof firstAppearancePageSchema>;

const attitudeOrNone = z.union([CharacterAttitudeSchema, z.literal("")]);

const ALIAS_GROUP_REVEAL_KEYS = [
  "bookAliases",
  "globalAliases",
] as const satisfies readonly CharacterRevealFieldKey[];

type PovUpdate = Pick<
  UpdateBookCharacter,
  "isPovCharacter" | "isUnreliableNarrator" | "isUnreliableNarratorSpoiler" | "narratorType"
>;

const MASKED_KEY_BY_PAYLOAD_KEY = {
  ...REVEAL_KEY_BY_SPOILER_FLAG,
  aliases: "bookAliases",
  isUnreliableNarrator: "unreliableNarrator",
  isUnreliableNarratorSpoiler: "unreliableNarrator",
  portraitMediaId: "portrait",
  speciesOverrideId: "speciesOverride",
  statusCustomText: "status",
} as const satisfies Partial<Record<keyof UpdateBookCharacter, CharacterRevealFieldKey>>;

export function buildCharacterEditSchema(
  messages: CharacterEditMessages,
  pageCeiling: BookPageCeiling,
) {
  const cappedText: CappedText = (max) => z.string().max(max, { error: messages.textTooLong(max) });

  return z
    .object({
      book: bookScopeSchema(cappedText, firstAppearancePageSchema(messages, pageCeiling)),
      global: z
        .object({
          aliases: z.array(aliasRowSchema(cappedText)),
          attitude: attitudeOrNone,
          avatarMediaId: z.string().nullable(),
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
          species: SpeciesSelectionSchema.nullable(),
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
        reservedName: effectiveCharacterName({
          displayName: value.book.displayName,
          globalName: value.global.name,
        }),
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
    firstAppearancePage: null,
    importance: BOOK_CHARACTER_UNSPECIFIED.importance,
    isPovCharacter: false,
    isUnreliableNarrator: false,
    isUnreliableNarratorSpoiler: false,
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
  const hiddenAliasGroups = character.hiddenFields.filter((key) =>
    ALIAS_GROUP_REVEAL_KEYS.some((aliasGroup) => aliasGroup === key),
  );
  return [...(appearance?.hiddenFields ?? []), ...hiddenAliasGroups];
}

export function toBookPatch({
  baseline,
  current,
  maskedFields,
}: {
  baseline: CharacterEditValues["book"];
  current: CharacterEditValues["book"];
  maskedFields: readonly string[];
}): UpdateBookCharacter {
  const pov = toPovUpdate(current, maskedFields);
  const povChanged = !isSamePayload(toPovUpdate(baseline, maskedFields), pov);
  return { ...toBookProfileUpdate(current, maskedFields), ...(povChanged ? pov : {}) };
}

export function toBookUpdate(
  values: CharacterEditValues["book"],
  maskedFields: readonly string[] = [],
): UpdateBookCharacter {
  return { ...toBookProfileUpdate(values, maskedFields), ...toPovUpdate(values, maskedFields) };
}

export function toCharacterEditValues({
  bookId,
  character,
  locale,
}: {
  bookId: string | undefined;
  character: CharacterDetailsView;
  locale: CatalogLocale;
}): CharacterEditValues {
  const appearance =
    bookId === undefined
      ? undefined
      : character.appearances.find((entry) => entry.bookId === bookId);

  return {
    book:
      appearance === undefined
        ? emptyBookScopeValues()
        : withoutEmptySpoilerFlags(
            {
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
              firstAppearancePage: appearance.firstAppearancePage,
              importance: appearance.importance,
              isPovCharacter: appearance.isPovCharacter,
              isUnreliableNarrator: appearance.isUnreliableNarrator ?? false,
              isUnreliableNarratorSpoiler: appearance.isUnreliableNarratorSpoiler,
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
              speciesOverride: selectionFromRef(appearance.speciesOverride, locale),
              speciesOverrideIsSpoiler: appearance.speciesOverrideIsSpoiler,
              status: appearance.status ?? BOOK_CHARACTER_UNSPECIFIED.status,
              statusCustomText: appearance.statusCustomText ?? "",
              statusIsSpoiler: appearance.statusIsSpoiler,
            },
            appearance.hiddenFields,
          ),
    global: {
      aliases: toAliasRows({ bookId: null, character }),
      attitude: character.globalAttitude ?? "",
      avatarMediaId: character.avatar?.id ?? null,
      customGender: character.customGender ?? "",
      entityKind: character.entityKind,
      gender: character.gender,
      name: character.name,
      neutralDescription: character.neutralDescription ?? "",
      pronouns: character.pronouns ?? "",
      species: selectionFromRef(character.species, locale),
    },
  };
}

export function toGlobalUpdate(
  values: CharacterEditValues["global"],
  maskedFields: readonly string[] = [],
): UpdateCharacter {
  return {
    avatarMediaId: values.avatarMediaId,
    customGender: values.gender === "custom" ? textOrNull(values.customGender) : null,
    entityKind: values.entityKind,
    gender: values.gender,
    globalAttitude: values.attitude === "" ? null : values.attitude,
    name: values.name.trim(),
    neutralDescription: textOrNull(values.neutralDescription),
    pronouns: textOrNull(values.pronouns),
    speciesId: values.species?.id ?? null,
    ...(maskedFields.includes("globalAliases") ? {} : { aliases: toAliasPayload(values.aliases) }),
  };
}

export function withSpeciesChange(
  values: CharacterEditValues,
  change: OwnSpeciesChange,
): CharacterEditValues {
  const speciesOverride = applyOwnSpeciesChange(values.book.speciesOverride, change);
  return {
    book: {
      ...values.book,
      speciesOverride,
      speciesOverrideIsSpoiler:
        values.book.speciesOverrideIsSpoiler &&
        hasSpoilerValue.speciesOverrideIsSpoiler(speciesOverride),
    },
    global: { ...values.global, species: applyOwnSpeciesChange(values.global.species, change) },
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

function bookScopeSchema(cappedText: CappedText, firstAppearancePage: FirstAppearancePageSchema) {
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
    firstAppearancePage,
    importance: BookCharacterImportanceSchema,
    isPovCharacter: z.boolean(),
    isUnreliableNarrator: z.boolean(),
    isUnreliableNarratorSpoiler: z.boolean(),
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
    speciesOverride: SpeciesSelectionSchema.nullable(),
    speciesOverrideIsSpoiler: z.boolean(),
    status: BookCharacterStatusSchema,
    statusCustomText: cappedText(CHARACTER_TEXT_MAX.shortText),
    statusIsSpoiler: z.boolean(),
  });
}

function firstAppearancePageSchema(messages: CharacterEditMessages, pageCeiling: BookPageCeiling) {
  const ceilingMessage =
    pageCeiling.source === "book"
      ? messages.firstAppearancePageExceedsBook
      : messages.firstAppearancePageInvalid;

  return z
    .number({ error: messages.firstAppearancePageInvalid })
    .int({ error: messages.firstAppearancePageInvalid })
    .positive({ error: messages.firstAppearancePageInvalid })
    .max(pageCeiling.max, { error: ceilingMessage })
    .nullable();
}

function hasRenamedMaskKey(
  payloadKey: string,
): payloadKey is keyof typeof MASKED_KEY_BY_PAYLOAD_KEY {
  return Object.hasOwn(MASKED_KEY_BY_PAYLOAD_KEY, payloadKey);
}

function isSamePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function maskedKeyOf(payloadKey: string): string {
  return hasRenamedMaskKey(payloadKey) ? MASKED_KEY_BY_PAYLOAD_KEY[payloadKey] : payloadKey;
}

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toBookProfileUpdate(
  formValues: CharacterEditValues["book"],
  maskedFields: readonly string[],
): Omit<UpdateBookCharacter, keyof PovUpdate> {
  const values = withoutEmptySpoilerFlags(formValues, maskedFields);
  const maskable = {
    aliases: toAliasPayload(values.aliases),
    appearanceNotes: textOrNull(values.appearanceNotes),
    appearanceNotesIsSpoiler: values.appearanceNotesIsSpoiler,
    attitude: values.attitude,
    description: textOrNull(values.description),
    descriptionIsSpoiler: values.descriptionIsSpoiler,
    displayName: values.displayName === null ? null : textOrNull(values.displayName),
    displayNameIsSpoiler: values.displayNameIsSpoiler,
    personalImpression: textOrNull(values.personalImpression),
    personalImpressionIsSpoiler: values.personalImpressionIsSpoiler,
    portraitIsSpoiler: values.portraitIsSpoiler,
    portraitMediaId: values.portraitMediaId,
    roles: values.roles.map((role, index) => ({
      customRole: role.roleType === BOOK_CHARACTER_ROLE.custom ? textOrNull(role.customRole) : null,
      isSpoiler: role.isSpoiler,
      position: index,
      roleType: role.roleType,
    })),
    speciesOverrideId: values.speciesOverride?.id ?? null,
    speciesOverrideIsSpoiler: values.speciesOverrideIsSpoiler,
    status: values.status,
    statusCustomText:
      values.status === BOOK_CHARACTER_STATUS.custom ? textOrNull(values.statusCustomText) : null,
    statusIsSpoiler: values.statusIsSpoiler,
  };

  return {
    firstAppearanceChapter: textOrNull(values.firstAppearanceChapter),
    firstAppearanceNote: textOrNull(values.firstAppearanceNote),
    firstAppearancePage: values.firstAppearancePage,
    importance: values.importance,
    ...withoutMasked(maskable, maskedFields),
  };
}

function toPovUpdate(
  values: CharacterEditValues["book"],
  maskedFields: readonly string[],
): PovUpdate {
  const isUnreliableNarrator = values.isPovCharacter && values.isUnreliableNarrator;
  return {
    isPovCharacter: values.isPovCharacter,
    narratorType: values.isPovCharacter ? values.narratorType : null,
    ...withoutMasked(
      {
        isUnreliableNarrator,
        isUnreliableNarratorSpoiler: isUnreliableNarrator && values.isUnreliableNarratorSpoiler,
      },
      maskedFields,
    ),
  };
}

function withoutMasked<T extends Record<string, unknown>>(
  values: T,
  maskedFields: readonly string[],
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => !maskedFields.includes(maskedKeyOf(key))),
  ) as Partial<T>;
}
