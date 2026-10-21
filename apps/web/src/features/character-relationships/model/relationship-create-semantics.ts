import type {
  CreateCharacterRelationship,
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS,
  collapseSpaces,
  CreateCharacterRelationshipSchema,
  getRelationshipTypeCategory,
  getRelationshipTypeDirectionality,
  isCatalogRelationshipType,
  normalizeName,
} from "@app/shared";

import type {
  RelationshipBookStateFormInput,
  RelationshipFormField,
  RelationshipFormInput,
  RelationshipParticipant,
} from "./relationship-form-schema";

import { toRelationshipBookStateInput } from "./relationship-form-input";

export const CREATE_ORIENTATIONS = ["forward", "reverse"] as const;

export type CreateOrientation = (typeof CREATE_ORIENTATIONS)[number];

export type RelationshipCreateDraft = Pick<
  RelationshipFormInput,
  "bookId" | "customType" | "directionality" | "source" | "target" | "type"
>;

export type RelationshipCreateSemantics = {
  bookId: string;
  category: RelationshipCategory;
  customName: Nullable<string>;
  directionality: RelationshipDirectionality;
  orientation: CreateOrientation;
  participantA: RelationshipParticipant;
  participantB: RelationshipParticipant;
  type: RelationshipType;
};

type EffectiveCreateEndpoints<TParticipant> = {
  source: TParticipant;
  target: TParticipant;
};

type ParticipantSlot = Extract<RelationshipFormField, "source" | "target">;

export function invertCreateOrientation(orientation: CreateOrientation): CreateOrientation {
  return orientation === "forward" ? "reverse" : "forward";
}

export function toCreateOrientation(value: string): Nullable<CreateOrientation> {
  return CREATE_ORIENTATIONS.find((orientation) => orientation === value) ?? null;
}

export function toCreateRelationshipRequest({
  allowFamilyCycle,
  bookState,
  semantics,
}: {
  allowFamilyCycle: boolean;
  bookState: RelationshipBookStateFormInput;
  semantics: RelationshipCreateSemantics;
}): CreateCharacterRelationship {
  const { source, target } = toEffectiveCreateEndpoints(semantics);
  return CreateCharacterRelationshipSchema.parse({
    allowFamilyCycle,
    category: semantics.category,
    customType: semantics.customName,
    directionality: semantics.directionality,
    initialBookStates: [{ ...toRelationshipBookStateInput(bookState), bookId: semantics.bookId }],
    isCanonical: false,
    sourceCharacterId: source.id,
    sourceLabel: null,
    targetCharacterId: target.id,
    targetLabel: null,
    type: semantics.type,
  });
}

export function toEffectiveCreateEdgeSignature(
  semantics: Nullable<RelationshipCreateSemantics>,
): string {
  if (semantics === null) return "";
  const { source, target } = toEffectiveCreateEndpoints(semantics);
  const endpointIds =
    semantics.directionality === "symmetric"
      ? [source.id, target.id].sort((left, right) => left.localeCompare(right))
      : [source.id, target.id];
  return JSON.stringify([
    ...endpointIds,
    semantics.directionality,
    semantics.category,
    semantics.type,
    semantics.customName === null ? null : normalizeName(semantics.customName),
    semantics.bookId,
  ]);
}

export function toEffectiveCreateEndpoints<TParticipant>({
  directionality,
  orientation,
  participantA,
  participantB,
}: {
  directionality: RelationshipDirectionality;
  orientation: CreateOrientation;
  participantA: TParticipant;
  participantB: TParticipant;
}): EffectiveCreateEndpoints<TParticipant> {
  return directionality === "directed" && orientation === "reverse"
    ? { source: participantB, target: participantA }
    : { source: participantA, target: participantB };
}

export function toRelationshipCreateSemantics({
  draft,
  orientation,
}: {
  draft: RelationshipCreateDraft;
  orientation: CreateOrientation;
}): Nullable<RelationshipCreateSemantics> {
  const { bookId, source: participantA, target: participantB, type } = draft;
  if (bookId === null || participantA === null || participantB === null || type === null) {
    return null;
  }
  if (participantA.id === participantB.id) return null;
  const pair = { bookId, orientation, participantA, participantB };
  if (isCatalogRelationshipType(type)) {
    return {
      ...pair,
      category: getRelationshipTypeCategory(type),
      customName: null,
      directionality: getRelationshipTypeDirectionality(type),
      type,
    };
  }
  const customName = collapseSpaces(draft.customType);
  if (
    customName.length === 0 ||
    customName.length > CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS.nameMax
  ) {
    return null;
  }
  return { ...pair, category: "custom", customName, directionality: draft.directionality, type };
}

export function toVisibleCreateParticipantField({
  directionality,
  field,
  orientation,
}: {
  directionality: RelationshipDirectionality;
  field: RelationshipFormField;
  orientation: CreateOrientation;
}): RelationshipFormField {
  if (field !== "source" && field !== "target") return field;
  const visibleSlots = toEffectiveCreateEndpoints<ParticipantSlot>({
    directionality,
    orientation,
    participantA: "source",
    participantB: "target",
  });
  return field === "source" ? visibleSlots.source : visibleSlots.target;
}
