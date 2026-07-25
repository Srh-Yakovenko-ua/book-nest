import type {
  InitialRelationshipBookState,
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
  UpdateCharacterRelationship,
  UpsertRelationshipBookState,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  getRelationshipTypeCategory,
  getRelationshipTypeDirectionality,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipTypeSchema,
} from "@app/shared";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { emptyToNull } from "./character-fields.js";

export type UpdateBookStateData = {
  description: Nullable<string>;
  endedAudioSeconds: Nullable<number>;
  endedChapter: Nullable<string>;
  endedPage: Nullable<number>;
  hideRelationshipAsSpoiler: boolean;
  intensity: Nullable<string>;
  introducedAudioSeconds: Nullable<number>;
  introducedChapter: Nullable<string>;
  introducedPage: Nullable<number>;
  isDescriptionSpoiler: boolean;
  isTypeSpoiler: boolean;
  status: string;
};

export type UpdateRelationshipData = {
  category?: string;
  customType?: Nullable<string>;
  directionality?: string;
  isCanonical?: boolean;
  sourceCharacterId?: string;
  sourceLabel?: Nullable<string>;
  targetCharacterId?: string;
  targetLabel?: Nullable<string>;
  type?: string;
};

export function buildBookStateData(
  input: InitialRelationshipBookState | UpsertRelationshipBookState,
): UpdateBookStateData {
  return {
    description: emptyToNull(input.description),
    endedAudioSeconds: input.endedAudioSeconds ?? null,
    endedChapter: emptyToNull(input.endedChapter),
    endedPage: input.endedPage ?? null,
    hideRelationshipAsSpoiler: input.hideRelationshipAsSpoiler,
    intensity: input.intensity ?? null,
    introducedAudioSeconds: input.introducedAudioSeconds ?? null,
    introducedChapter: emptyToNull(input.introducedChapter),
    introducedPage: input.introducedPage ?? null,
    isDescriptionSpoiler: input.isDescriptionSpoiler,
    isTypeSpoiler: input.isTypeSpoiler,
    status: input.status,
  };
}

export function buildUpdateData({
  existing,
  input,
}: {
  existing: {
    category: string;
    customType: Nullable<string>;
    directionality: string;
    type: string;
  };
  input: UpdateCharacterRelationship;
}): {
  data: UpdateRelationshipData;
  effectiveCategory: RelationshipCategory;
  effectiveCustomType: Nullable<string>;
  effectiveDirectionality: RelationshipDirectionality;
  effectiveType: RelationshipType;
} {
  const storedType = RelationshipTypeSchema.parse(existing.type);
  const storedCategory = RelationshipCategorySchema.parse(existing.category);
  const effectiveType = input.type ?? storedType;
  const data: UpdateRelationshipData = {};

  if (input.type !== undefined) {
    data.type = input.type;
  }
  if (input.sourceLabel !== undefined) {
    data.sourceLabel = emptyToNull(input.sourceLabel);
  }
  if (input.targetLabel !== undefined) {
    data.targetLabel = emptyToNull(input.targetLabel);
  }
  if (input.isCanonical !== undefined) {
    data.isCanonical = input.isCanonical;
  }

  if (effectiveType === "custom") {
    const effectiveCategory = applyCustomUpdate({ data, input, storedCategory });
    return {
      data,
      effectiveCategory,
      effectiveCustomType:
        input.customType === undefined ? existing.customType : emptyToNull(input.customType),
      effectiveDirectionality: RelationshipDirectionalitySchema.parse(existing.directionality),
      effectiveType,
    };
  }

  const catalogCategory = getRelationshipTypeCategory(effectiveType);
  if (input.category !== undefined && input.category !== catalogCategory) {
    throw new BadRequestError("type does not belong to the given category", {
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
    });
  }
  const catalogDirectionality = getRelationshipTypeDirectionality(effectiveType);
  data.directionality = catalogDirectionality;
  if (input.type !== undefined || input.category !== undefined) {
    data.category = catalogCategory;
  }
  if (input.type !== undefined) {
    data.customType = null;
  }
  return {
    data,
    effectiveCategory: catalogCategory,
    effectiveCustomType: null,
    effectiveDirectionality: catalogDirectionality,
    effectiveType,
  };
}

export function dedupeBookStates(
  states: InitialRelationshipBookState[],
): InitialRelationshipBookState[] {
  const seen = new Set<string>();
  return states.filter((state) => {
    if (seen.has(state.bookId)) {
      return false;
    }
    seen.add(state.bookId);
    return true;
  });
}

export function resolveDirectionality({
  directionality,
  type,
}: {
  directionality: RelationshipDirectionality;
  type: RelationshipType;
}): RelationshipDirectionality {
  if (type === "custom") {
    return directionality;
  }
  const expected = getRelationshipTypeDirectionality(type);
  if (directionality !== expected) {
    throw new BadRequestError("directionality does not match the relationship type", {
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.directionMismatch,
    });
  }
  return expected;
}

function applyCustomUpdate({
  data,
  input,
  storedCategory,
}: {
  data: UpdateRelationshipData;
  input: UpdateCharacterRelationship;
  storedCategory: RelationshipCategory;
}): RelationshipCategory {
  if (input.category !== undefined && input.category !== "custom") {
    throw new BadRequestError("category must be custom when type is custom", {
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
    });
  }
  if (input.type !== undefined || input.category !== undefined) {
    data.category = "custom";
  }
  if (input.customType !== undefined) {
    const customType = emptyToNull(input.customType);
    if (customType === null) {
      throw new BadRequestError("customType is required when type is custom", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
      });
    }
    data.customType = customType;
  } else if (input.type === "custom" && storedCategory !== "custom") {
    throw new BadRequestError("customType is required when type is custom", {
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
    });
  }
  return "custom";
}
