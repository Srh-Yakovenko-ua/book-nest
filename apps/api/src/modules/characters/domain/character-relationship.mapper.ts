import type {
  CharacterRelationshipBookStateView,
  CharacterRelationshipDetailsView,
  CharacterRelationshipDiagnosticView,
  CharacterRelationshipView,
  Nullable,
} from "@app/shared";

import {
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import { isBefore } from "date-fns";

export type RelationshipBookStateSource = {
  bookId: string;
  createdAt: Date;
  description: Nullable<string>;
  endedAudioSeconds: Nullable<number>;
  endedChapter: Nullable<string>;
  endedPage: Nullable<number>;
  hideRelationshipAsSpoiler: boolean;
  id: string;
  intensity: Nullable<string>;
  introducedAudioSeconds: Nullable<number>;
  introducedChapter: Nullable<string>;
  introducedPage: Nullable<number>;
  isDescriptionSpoiler: boolean;
  isTypeSpoiler: boolean;
  relationshipId: string;
  status: string;
  updatedAt: Date;
};

export type RelationshipSource = {
  category: string;
  createdAt: Date;
  customType: Nullable<string>;
  directionality: string;
  id: string;
  isCanonical: boolean;
  sourceCharacter: { name: string };
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacter: { name: string };
  targetCharacterId: string;
  targetLabel: Nullable<string>;
  type: string;
  updatedAt: Date;
};

export function pickEffectiveBookState<State extends { bookId: string; createdAt: Date }>({
  partNumberById,
  states,
}: {
  partNumberById: Map<string, Nullable<number>>;
  states: State[];
}): Nullable<State> {
  let best: Nullable<State> = null;
  for (const state of states) {
    if (best === null || isLaterState({ candidate: state, current: best, partNumberById })) {
      best = state;
    }
  }
  return best;
}

export function toRelationshipBookStateView({
  descriptionHidden,
  state,
}: {
  descriptionHidden: boolean;
  state: RelationshipBookStateSource;
}): CharacterRelationshipBookStateView {
  return {
    bookId: state.bookId,
    createdAt: state.createdAt.toISOString(),
    description: descriptionHidden ? null : state.description,
    descriptionHidden,
    endedAudioSeconds: state.endedAudioSeconds,
    endedChapter: state.endedChapter,
    endedPage: state.endedPage,
    hideRelationshipAsSpoiler: state.hideRelationshipAsSpoiler,
    id: state.id,
    intensity: state.intensity === null ? null : RelationshipIntensitySchema.parse(state.intensity),
    introducedAudioSeconds: state.introducedAudioSeconds,
    introducedChapter: state.introducedChapter,
    introducedPage: state.introducedPage,
    isDescriptionSpoiler: state.isDescriptionSpoiler,
    isTypeSpoiler: state.isTypeSpoiler,
    relationshipId: state.relationshipId,
    status: RelationshipBookStateStatusSchema.parse(state.status),
    updatedAt: state.updatedAt.toISOString(),
  };
}

export function toRelationshipDetailsView({
  bookStates,
  diagnostics,
  relationship,
}: {
  bookStates: RelationshipBookStateSource[];
  diagnostics: CharacterRelationshipDiagnosticView[];
  relationship: RelationshipSource;
}): CharacterRelationshipDetailsView {
  return {
    ...toRelationshipView({ relationship, typeHidden: false }),
    bookStates: bookStates.map((state) =>
      toRelationshipBookStateView({ descriptionHidden: false, state }),
    ),
    diagnostics,
  };
}

export function toRelationshipView({
  relationship,
  typeHidden,
}: {
  relationship: RelationshipSource;
  typeHidden: boolean;
}): CharacterRelationshipView {
  return {
    category: typeHidden ? null : RelationshipCategorySchema.parse(relationship.category),
    createdAt: relationship.createdAt.toISOString(),
    customType: typeHidden ? null : relationship.customType,
    directionality: RelationshipDirectionalitySchema.parse(relationship.directionality),
    id: relationship.id,
    isCanonical: relationship.isCanonical,
    sourceCharacterId: relationship.sourceCharacterId,
    sourceCharacterName: relationship.sourceCharacter.name,
    sourceLabel: typeHidden ? null : relationship.sourceLabel,
    targetCharacterId: relationship.targetCharacterId,
    targetCharacterName: relationship.targetCharacter.name,
    targetLabel: typeHidden ? null : relationship.targetLabel,
    type: typeHidden ? null : RelationshipTypeSchema.parse(relationship.type),
    typeHidden,
    updatedAt: relationship.updatedAt.toISOString(),
  };
}

function isLaterState<State extends { bookId: string; createdAt: Date }>({
  candidate,
  current,
  partNumberById,
}: {
  candidate: State;
  current: State;
  partNumberById: Map<string, Nullable<number>>;
}): boolean {
  const candidatePart = partNumberById.get(candidate.bookId) ?? Number.NEGATIVE_INFINITY;
  const currentPart = partNumberById.get(current.bookId) ?? Number.NEGATIVE_INFINITY;
  if (candidatePart !== currentPart) {
    return candidatePart > currentPart;
  }
  return !isBefore(candidate.createdAt, current.createdAt);
}
