import type {
  CharacterRelationshipBookStateView,
  CharacterRelationshipDetailsView,
  Nullable,
  RelationshipDirectionality,
  RelationshipType,
  UpdateCharacterRelationship,
  UpsertRelationshipBookState,
} from "@app/shared";

import {
  getRelationshipTypeDirectionality,
  isCatalogRelationshipType,
  UpdateCharacterRelationshipSchema,
  UpsertRelationshipBookStateSchema,
} from "@app/shared";

import type {
  RelationshipBookStateFormInput,
  RelationshipFormInput,
  RelationshipFormValues,
  RelationshipParticipant,
} from "./relationship-form-schema";

import { formatAudioPosition, parseAudioPosition } from "./relationship-audio-position";

type RelationshipBookStateChange = {
  bookId: string;
  input: UpsertRelationshipBookState;
};

type RelationshipEdgeSignatureSource = Pick<
  RelationshipFormInput,
  "category" | "customType" | "source" | "target" | "type"
>;

export function findRelationshipBookState({
  bookId,
  relationship,
}: {
  bookId: Nullable<string>;
  relationship: CharacterRelationshipDetailsView;
}): Nullable<CharacterRelationshipBookStateView> {
  if (bookId === null) return null;
  return relationship.bookStates.find((state) => state.bookId === bookId) ?? null;
}

export function relationshipBookStateDefaults(
  state: Nullable<CharacterRelationshipBookStateView>,
): RelationshipBookStateFormInput {
  return {
    description: state?.description ?? "",
    endedAudio: toAudioText(state?.endedAudioSeconds ?? null),
    endedChapter: state?.endedChapter ?? "",
    endedPage: state?.endedPage ?? null,
    hideRelationshipAsSpoiler: state?.hideRelationshipAsSpoiler ?? false,
    intensity: state?.intensity ?? null,
    introducedAudio: toAudioText(state?.introducedAudioSeconds ?? null),
    introducedChapter: state?.introducedChapter ?? "",
    introducedPage: state?.introducedPage ?? null,
    isDescriptionSpoiler: state?.isDescriptionSpoiler ?? false,
    isTypeSpoiler: state?.isTypeSpoiler ?? false,
    status: state?.status ?? "active",
  };
}

export function relationshipCreateDefaults({
  bookId,
  focusCharacter,
}: {
  bookId: Nullable<string>;
  focusCharacter: Nullable<RelationshipParticipant>;
}): RelationshipFormInput {
  return {
    bookId,
    bookState: relationshipBookStateDefaults(null),
    category: "family",
    customType: "",
    directionality: "symmetric",
    isCanonical: false,
    source: focusCharacter,
    sourceLabel: "",
    target: null,
    targetLabel: "",
    type: null,
  };
}

export function relationshipEditDefaults({
  bookId,
  relationship,
}: {
  bookId: Nullable<string>;
  relationship: CharacterRelationshipDetailsView;
}): RelationshipFormInput {
  return {
    bookId,
    bookState: relationshipBookStateDefaults(findRelationshipBookState({ bookId, relationship })),
    category: relationship.category ?? "custom",
    customType: relationship.customType ?? "",
    directionality: relationship.directionality,
    isCanonical: relationship.isCanonical,
    source: null,
    sourceLabel: relationship.sourceLabel ?? "",
    target: null,
    targetLabel: relationship.targetLabel ?? "",
    type: relationship.type,
  };
}

export function resolveRelationshipDirectionality({
  directionality,
  type,
}: {
  directionality: RelationshipDirectionality;
  type: Nullable<RelationshipType>;
}): RelationshipDirectionality {
  if (type === null || !isCatalogRelationshipType(type)) return directionality;
  return getRelationshipTypeDirectionality(type);
}

export function toRelationshipBookStateChange({
  relationship,
  values,
}: {
  relationship: CharacterRelationshipDetailsView;
  values: RelationshipFormValues;
}): Nullable<RelationshipBookStateChange> {
  if (values.bookId === null) return null;
  const input = toRelationshipBookStateInput(values.bookState);
  const stored = toRelationshipBookStateInput(
    relationshipBookStateDefaults(
      findRelationshipBookState({ bookId: values.bookId, relationship }),
    ),
  );
  return JSON.stringify(input) === JSON.stringify(stored) ? null : { bookId: values.bookId, input };
}

export function toRelationshipBookStateInput(
  state: RelationshipBookStateFormInput,
): UpsertRelationshipBookState {
  return UpsertRelationshipBookStateSchema.parse({
    description: toOptionalText(state.description),
    endedAudioSeconds: parseAudioPosition(state.endedAudio),
    endedChapter: toOptionalText(state.endedChapter),
    endedPage: state.endedPage,
    hideRelationshipAsSpoiler: state.hideRelationshipAsSpoiler,
    intensity: state.intensity,
    introducedAudioSeconds: parseAudioPosition(state.introducedAudio),
    introducedChapter: toOptionalText(state.introducedChapter),
    introducedPage: state.introducedPage,
    isDescriptionSpoiler: state.isDescriptionSpoiler,
    isTypeSpoiler: state.isTypeSpoiler,
    status: state.status,
  });
}

export function toRelationshipEdgeSignature({
  category,
  customType,
  source,
  target,
  type,
}: RelationshipEdgeSignatureSource): string {
  return JSON.stringify([
    source?.id ?? null,
    target?.id ?? null,
    category,
    type,
    customType.trim(),
  ]);
}

export function toUpdateRelationshipInput({
  allowFamilyCycle,
  relationship,
  values,
}: {
  allowFamilyCycle: boolean;
  relationship: CharacterRelationshipDetailsView;
  values: RelationshipFormValues;
}): Nullable<UpdateCharacterRelationship> {
  const customType = values.type === "custom" ? values.customType : null;
  const sourceLabel = toOptionalText(values.sourceLabel);
  const targetLabel = toOptionalText(values.targetLabel);
  const isTypeChanged =
    values.category !== relationship.category ||
    values.type !== relationship.type ||
    customType !== relationship.customType;
  const changes = {
    ...(isTypeChanged ? { category: values.category, customType, type: values.type } : {}),
    ...(values.isCanonical === relationship.isCanonical ? {} : { isCanonical: values.isCanonical }),
    ...(sourceLabel === relationship.sourceLabel ? {} : { sourceLabel }),
    ...(targetLabel === relationship.targetLabel ? {} : { targetLabel }),
  };
  if (Object.keys(changes).length === 0) return null;
  return UpdateCharacterRelationshipSchema.parse({ ...changes, allowFamilyCycle });
}

function toAudioText(seconds: Nullable<number>): string {
  return seconds === null ? "" : formatAudioPosition(seconds);
}

function toOptionalText(value: string): Nullable<string> {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
