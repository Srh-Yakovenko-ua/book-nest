import type { CharacterInput, Nullable, UpdateCharacter } from "@app/shared";

import { CHARACTER_ERROR_CODES, normalizeName } from "@app/shared";

import type {
  CreateAliasData,
  CreateCharacterData,
  UpdateCharacterData,
} from "../infrastructure/characters.repository.js";

import { ValidationError } from "../../../core/exceptions/errors.js";
import { emptyToNull } from "./character-fields.js";

export function buildCharacterData({
  input,
  userId,
}: {
  input: CharacterInput;
  userId: string;
}): CreateCharacterData {
  return {
    aliases: dedupeAliases(
      input.aliases.map((alias) => ({
        bookId: alias.bookId ?? null,
        isSpoiler: alias.isSpoiler,
        name: alias.name,
        normalizedName: normalizeName(alias.name),
        position: alias.position ?? 0,
        type: alias.type,
      })),
    ),
    avatarMediaId: input.avatarMediaId ?? null,
    customGender: input.gender === "custom" ? emptyToNull(input.customGender) : null,
    entityKind: input.entityKind,
    gender: input.gender,
    globalAttitude: input.globalAttitude ?? null,
    hideProfileAsSpoiler: input.hideProfileAsSpoiler,
    isFavorite: input.isFavorite,
    name: input.name,
    neutralDescription: emptyToNull(input.neutralDescription),
    normalizedName: normalizeName(input.name),
    pronouns: emptyToNull(input.pronouns),
    species: emptyToNull(input.species),
    userId,
  };
}

export function buildCharacterUpdateData({
  input,
  storedGender,
}: {
  input: UpdateCharacter;
  storedGender: string;
}): UpdateCharacterData {
  const data: UpdateCharacterData = {};
  if (input.name !== undefined) {
    data.name = input.name;
    data.normalizedName = normalizeName(input.name);
  }
  if (input.entityKind !== undefined) {
    data.entityKind = input.entityKind;
  }
  if (input.species !== undefined) {
    data.species = emptyToNull(input.species);
  }
  const effectiveGender = input.gender ?? storedGender;
  if (input.gender !== undefined) {
    data.gender = input.gender;
  }
  if (effectiveGender === "custom") {
    if (input.customGender !== undefined) {
      const customGender = emptyToNull(input.customGender);
      if (customGender === null) {
        throw new ValidationError("customGender is required when gender is custom", {
          code: CHARACTER_ERROR_CODES.validationFailed,
        });
      }
      data.customGender = customGender;
    }
  } else if (input.gender !== undefined || input.customGender !== undefined) {
    data.customGender = null;
  }
  if (input.pronouns !== undefined) {
    data.pronouns = emptyToNull(input.pronouns);
  }
  if (input.neutralDescription !== undefined) {
    data.neutralDescription = emptyToNull(input.neutralDescription);
  }
  if (input.avatarMediaId !== undefined) {
    data.avatarMediaId = input.avatarMediaId ?? null;
  }
  if (input.isFavorite !== undefined) {
    data.isFavorite = input.isFavorite;
  }
  if (input.globalAttitude !== undefined) {
    data.globalAttitude = input.globalAttitude ?? null;
  }
  if (input.hideProfileAsSpoiler !== undefined) {
    data.hideProfileAsSpoiler = input.hideProfileAsSpoiler;
  }
  return data;
}

export function buildReplaceAliases({
  aliases,
  bookId,
}: {
  aliases: NonNullable<UpdateCharacter["aliases"]>;
  bookId: Nullable<string>;
}): CreateAliasData[] {
  return dedupeAliases(
    aliases.map((alias) => ({
      bookId,
      isSpoiler: alias.isSpoiler,
      name: alias.name,
      normalizedName: normalizeName(alias.name),
      position: alias.position ?? 0,
      type: alias.type,
    })),
  );
}

function dedupeAliases(aliases: CreateAliasData[]): CreateAliasData[] {
  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const key = `${alias.normalizedName}::${alias.type}::${alias.bookId ?? "global"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
