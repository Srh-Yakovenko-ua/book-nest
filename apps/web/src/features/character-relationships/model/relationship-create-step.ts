import type { Nullable } from "@app/shared";

import type { RelationshipCreateBookContext } from "./relationship-book-step";
import type {
  RelationshipBookStateFormInput,
  RelationshipFormField,
  RelationshipParticipant,
} from "./relationship-form-schema";
import type { RelationshipFieldErrorReason } from "./relationship-save-error";

export const CREATE_STEPS = ["edge", "book"] as const;

export const CREATE_SECTIONS = ["positions", "spoilers"] as const;

export const CREATE_STEP1_FIELDS = [
  "bookId",
  "source",
  "target",
  "type",
  "category",
  "customType",
  "directionality",
] as const satisfies readonly RelationshipFormField[];

export type RelationshipCreateBookContextKind = RelationshipCreateBookContext["kind"];

export type RelationshipCreateErrorReveal = {
  focus: RelationshipCreateFocusTarget;
  sections: readonly RelationshipCreateSection[];
  step: RelationshipCreateStep;
};

export type RelationshipCreateFocusTarget =
  | { field: RelationshipFormField; kind: "field" }
  | { kind: "book-step" }
  | { kind: "edge-step" }
  | { kind: "pair" }
  | { kind: "root" };

export type RelationshipCreateSection = (typeof CREATE_SECTIONS)[number];

export type RelationshipCreateStep = (typeof CREATE_STEPS)[number];

const CREATE_SECTION_FIELDS = {
  positions: [
    "bookState.introducedChapter",
    "bookState.introducedPage",
    "bookState.introducedAudio",
    "bookState.endedChapter",
    "bookState.endedPage",
    "bookState.endedAudio",
  ],
  spoilers: [
    "bookState.isTypeSpoiler",
    "bookState.isDescriptionSpoiler",
    "bookState.hideRelationshipAsSpoiler",
  ],
} as const satisfies Record<RelationshipCreateSection, readonly RelationshipFormField[]>;

const CREATE_FIELD_ORDER = [
  ...CREATE_STEP1_FIELDS,
  "bookState.status",
  "bookState.intensity",
  "bookState.description",
  ...CREATE_SECTION_FIELDS.positions,
  ...CREATE_SECTION_FIELDS.spoilers,
] as const satisfies readonly RelationshipFormField[];

const CREATE_STEP1_FIELD_NAMES: ReadonlySet<RelationshipFormField> = new Set(CREATE_STEP1_FIELDS);

const CREATE_PAIR_ERROR_REASONS: ReadonlySet<RelationshipFieldErrorReason> = new Set([
  "bookContextInvalid",
  "characterNotFound",
  "selfReference",
] as const);

export function hasCreatePositionValues(state: RelationshipBookStateFormInput): boolean {
  const texts = [
    state.introducedChapter,
    state.introducedAudio,
    state.endedChapter,
    state.endedAudio,
  ];
  return (
    texts.some((text) => text.trim() !== "") ||
    state.introducedPage !== null ||
    state.endedPage !== null
  );
}

export function hasCreateSpoilerFlags(state: RelationshipBookStateFormInput): boolean {
  return state.isTypeSpoiler || state.isDescriptionSpoiler || state.hideRelationshipAsSpoiler;
}

export function isCreatePairError({
  bookContextKind,
  field,
  reason,
}: {
  bookContextKind: RelationshipCreateBookContextKind;
  field: RelationshipFormField;
  reason: RelationshipFieldErrorReason;
}): boolean {
  if (CREATE_PAIR_ERROR_REASONS.has(reason)) return true;
  return field === "bookId" && bookContextKind !== "choice";
}

export function isCreateStep1Field(field: RelationshipFormField): boolean {
  return CREATE_STEP1_FIELD_NAMES.has(field);
}

export function keepFocusParticipant({
  focusId,
  participant,
}: {
  focusId: Nullable<string>;
  participant: Nullable<RelationshipParticipant>;
}): Nullable<RelationshipParticipant> {
  return participant !== null && participant.id === focusId ? participant : null;
}

export function planCreateErrorReveal({
  bookContextKind,
  fields,
}: {
  bookContextKind: RelationshipCreateBookContextKind;
  fields: readonly RelationshipFormField[];
}): Nullable<RelationshipCreateErrorReveal> {
  const orderedFields = CREATE_FIELD_ORDER.filter((field) => fields.includes(field));
  const [firstField] = orderedFields;
  if (firstField === undefined) return null;
  const step = stepOfCreateField(firstField);
  const fieldsOnStep = orderedFields.filter((field) => stepOfCreateField(field) === step);
  return {
    focus: toCreateFocusTarget({ bookContextKind, field: firstField }),
    sections: CREATE_SECTIONS.filter((section) =>
      fieldsOnStep.some((field) => sectionOfCreateField(field) === section),
    ),
    step,
  };
}

export function sectionOfCreateField(
  field: RelationshipFormField,
): Nullable<RelationshipCreateSection> {
  return (
    CREATE_SECTIONS.find((section) =>
      CREATE_SECTION_FIELDS[section].some((sectionField) => sectionField === field),
    ) ?? null
  );
}

export function stepOfCreateField(field: RelationshipFormField): RelationshipCreateStep {
  return isCreateStep1Field(field) ? "edge" : "book";
}

export function toCreateErrorFields(
  hasError: (field: RelationshipFormField) => boolean,
): RelationshipFormField[] {
  return CREATE_FIELD_ORDER.filter(hasError);
}

function toCreateFocusTarget({
  bookContextKind,
  field,
}: {
  bookContextKind: RelationshipCreateBookContextKind;
  field: RelationshipFormField;
}): RelationshipCreateFocusTarget {
  switch (field) {
    case "bookId":
      return bookContextKind === "choice" ? { field, kind: "field" } : { kind: "pair" };
    case "bookState.intensity":
    case "bookState.status":
      return { kind: "book-step" };
    case "category":
    case "directionality":
      return { field: "type", kind: "field" };
    default:
      return { field, kind: "field" };
  }
}
