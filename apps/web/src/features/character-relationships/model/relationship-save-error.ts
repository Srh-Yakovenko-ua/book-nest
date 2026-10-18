import type { Nullable } from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  RelationshipDiagnosticSeveritySchema,
} from "@app/shared";
import { z } from "zod";

import { ApiError } from "@/lib/http-client";

import type { RelationshipFormField } from "./relationship-form-schema";

const NOT_FOUND_STATUS = 404;

const INITIAL_BOOK_STATE_PATH = /^initialBookStates\.\d+\./;

const FamilyCycleDetailsSchema = z.object({ severity: RelationshipDiagnosticSeveritySchema });

const SERVER_FIELD_TO_FORM_FIELD = {
  bookId: "bookId",
  category: "category",
  customType: "customType",
  description: "bookState.description",
  directionality: "directionality",
  endedAudioSeconds: "bookState.endedAudio",
  endedChapter: "bookState.endedChapter",
  endedPage: "bookState.endedPage",
  hideRelationshipAsSpoiler: "bookState.hideRelationshipAsSpoiler",
  intensity: "bookState.intensity",
  introducedAudioSeconds: "bookState.introducedAudio",
  introducedChapter: "bookState.introducedChapter",
  introducedPage: "bookState.introducedPage",
  isCanonical: "isCanonical",
  isDescriptionSpoiler: "bookState.isDescriptionSpoiler",
  isTypeSpoiler: "bookState.isTypeSpoiler",
  sourceCharacterId: "source",
  sourceLabel: "sourceLabel",
  status: "bookState.status",
  targetCharacterId: "target",
  targetLabel: "targetLabel",
  type: "type",
} as const satisfies Record<string, RelationshipFormField>;

export type RelationshipFieldErrorReason =
  "bookNotFound" | "characterNotFound" | "directionMismatch" | "duplicate" | "selfReference";

export type RelationshipSaveError =
  | { field: RelationshipFormField; kind: "field"; reason: RelationshipFieldErrorReason }
  | { fields: readonly RelationshipFormField[]; kind: "invalid" }
  | { kind: "familyCycle"; overridable: boolean }
  | { kind: "gone" }
  | { kind: "unknown" };

type ServerField = keyof typeof SERVER_FIELD_TO_FORM_FIELD;

export function isRelationshipGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === NOT_FOUND_STATUS;
}

export function toRelationshipSaveError(error: unknown): RelationshipSaveError {
  if (!(error instanceof ApiError)) return { kind: "unknown" };

  switch (error.code) {
    case CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid:
    case CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound:
      return { field: "bookId", kind: "field", reason: "bookNotFound" };
    case CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound:
      return { field: "target", kind: "field", reason: "characterNotFound" };
    case CHARACTER_RELATIONSHIP_ERROR_CODES.directionMismatch:
      return { field: "type", kind: "field", reason: "directionMismatch" };
    case CHARACTER_RELATIONSHIP_ERROR_CODES.duplicate:
      return { field: "type", kind: "field", reason: "duplicate" };
    case CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected:
      return { kind: "familyCycle", overridable: isOverridableFamilyCycle(error.details) };
    case CHARACTER_RELATIONSHIP_ERROR_CODES.selfReference:
      return { field: "target", kind: "field", reason: "selfReference" };
    default:
      break;
  }

  if (error.fieldErrors !== undefined && error.fieldErrors.length > 0) {
    return {
      fields: error.fieldErrors.flatMap((fieldError) => {
        const field = toRelationshipFormField(fieldError.field);
        return field === null ? [] : [field];
      }),
      kind: "invalid",
    };
  }
  if (error.status === NOT_FOUND_STATUS) return { kind: "gone" };
  return { kind: "unknown" };
}

function isOverridableFamilyCycle(details: Record<string, unknown> | undefined): boolean {
  return FamilyCycleDetailsSchema.safeParse(details).data?.severity === "warning";
}

function isServerField(field: string): field is ServerField {
  return Object.hasOwn(SERVER_FIELD_TO_FORM_FIELD, field);
}

function toRelationshipFormField(serverField: string): Nullable<RelationshipFormField> {
  const field = serverField.replace(INITIAL_BOOK_STATE_PATH, "");
  return isServerField(field) ? SERVER_FIELD_TO_FORM_FIELD[field] : null;
}
