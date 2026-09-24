import type {
  BookCharacterImportance,
  BookCharacterNarratorType,
  BookCharacterRoleType,
  BookCharacterStatus,
  CharacterAliasType,
  CharacterAttitude,
  CharacterEntityKind,
  CharacterGender,
  Nullable,
} from "@app/shared";
import type { VariantProps } from "class-variance-authority";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";

import { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

type ExplicitImportance = Exclude<
  BookCharacterImportance,
  typeof BOOK_CHARACTER_UNSPECIFIED.importance
>;

type ExplicitStatus = Exclude<BookCharacterStatus, typeof BOOK_CHARACTER_UNSPECIFIED.status>;

export const BOOK_CHARACTER_IMPORTANCE = {
  badgeVariant: {
    central: "default",
    episodic: "outline",
    major: "primary",
    mentioned: "ghost",
    supporting: "secondary",
  },
  options: [
    BOOK_CHARACTER_UNSPECIFIED.importance,
    "central",
    "major",
    "supporting",
    "episodic",
    "mentioned",
  ],
} as const satisfies {
  badgeVariant: Record<ExplicitImportance, BadgeVariant>;
  options: readonly BookCharacterImportance[];
};

export const BOOK_CHARACTER_STATUS = {
  custom: "other",
  options: [
    BOOK_CHARACTER_UNSPECIFIED.status,
    "active",
    "missing",
    "dead",
    "unknown",
    "transformed",
    "other",
  ],
} as const satisfies {
  custom: BookCharacterStatus;
  options: readonly BookCharacterStatus[];
};

export function explicitImportance(
  importance: BookCharacterImportance,
): Nullable<ExplicitImportance> {
  return importance === BOOK_CHARACTER_UNSPECIFIED.importance ? null : importance;
}

export function explicitStatus(status: Nullable<BookCharacterStatus>): Nullable<ExplicitStatus> {
  return status === null || status === BOOK_CHARACTER_UNSPECIFIED.status ? null : status;
}

export const ROLE_TYPE_OPTIONS = [
  "protagonist",
  "deuteragonist",
  "antagonist",
  "love_interest",
  "supporting",
  "episodic",
  "mentioned",
  "custom",
] as const satisfies readonly BookCharacterRoleType[];

export const GENDER_OPTIONS = [
  "female",
  "male",
  "non_binary",
  "agender_or_na",
  "unknown",
  "custom",
] as const satisfies readonly CharacterGender[];

export const ATTITUDE_OPTIONS = [
  "favorite",
  "like",
  "neutral",
  "distrust",
  "dislike",
  "hate",
  "unsure",
] as const satisfies readonly CharacterAttitude[];

export const ENTITY_KIND_OPTIONS = [
  "individual",
  "collective",
  "unknown",
] as const satisfies readonly CharacterEntityKind[];

export const ALIAS_TYPE_OPTIONS = [
  "nickname",
  "title",
  "pseudonym",
  "true_name",
  "former_name",
  "translation",
  "other",
] as const satisfies readonly CharacterAliasType[];

export const NARRATOR_TYPE_OPTIONS = [
  "first_person",
  "third_person_limited",
  "third_person_omniscient",
  "unreliable",
  "other",
] as const satisfies readonly BookCharacterNarratorType[];

export const GENDER_CUSTOM = "custom" satisfies CharacterGender;
export const ROLE_TYPE_CUSTOM = "custom" satisfies BookCharacterRoleType;
