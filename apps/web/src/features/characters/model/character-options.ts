import type {
  BookCharacterImportance,
  BookCharacterNarratorType,
  BookCharacterRoleType,
  BookCharacterStatus,
  CharacterAliasType,
  CharacterAttitude,
  CharacterEntityKind,
  CharacterGender,
} from "@app/shared";
import type { VariantProps } from "class-variance-authority";

import { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const IMPORTANCE_OPTIONS = [
  "central",
  "major",
  "supporting",
  "episodic",
  "mentioned",
] as const satisfies readonly BookCharacterImportance[];

export const STATUS_OPTIONS = [
  "active",
  "missing",
  "dead",
  "unknown",
  "transformed",
  "other",
] as const satisfies readonly BookCharacterStatus[];

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
export const STATUS_CUSTOM = "other" satisfies BookCharacterStatus;

const IMPORTANCE_RANK: Record<BookCharacterImportance, number> = {
  central: 0,
  episodic: 3,
  major: 1,
  mentioned: 4,
  supporting: 2,
};

export function importanceRank(importance: BookCharacterImportance): number {
  return IMPORTANCE_RANK[importance];
}

export const IMPORTANCE_BADGE_VARIANT: Record<BookCharacterImportance, BadgeVariant> = {
  central: "default",
  episodic: "outline",
  major: "primary",
  mentioned: "ghost",
  supporting: "secondary",
};
