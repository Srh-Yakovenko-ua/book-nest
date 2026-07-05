import type { FieldErrors } from "react-hook-form";

import type { CreateBookFormValues } from "./create-book-form";

export type SectionFieldConfig = {
  defaultValue?: unknown;
  kind: "multiselect" | "text" | "toggleDefault";
  name: keyof CreateBookFormValues;
  required: boolean;
};

export const BASIC_INFO_FIELDS = [
  { kind: "text", name: "title", required: true },
  { kind: "multiselect", name: "authors", required: true },
] as const satisfies readonly SectionFieldConfig[];

export const BOOK_TYPE_FIELDS = [
  { defaultValue: "solo", kind: "toggleDefault", name: "bookType", required: false },
] as const satisfies readonly SectionFieldConfig[];

export const CLASSIFICATION_FIELDS = [
  { kind: "multiselect", name: "genres", required: false },
  { kind: "multiselect", name: "tags", required: false },
  { defaultValue: "not_specified", kind: "toggleDefault", name: "ageCategory", required: false },
  { defaultValue: "ukrainian", kind: "toggleDefault", name: "language", required: false },
] as const satisfies readonly SectionFieldConfig[];

export const READING_STATUS_FIELDS = [
  { defaultValue: "not_started", kind: "toggleDefault", name: "readingStatus", required: false },
] as const satisfies readonly SectionFieldConfig[];

export const OWNERSHIP_FIELDS = [
  { defaultValue: "none", kind: "toggleDefault", name: "ownershipStatus", required: false },
] as const satisfies readonly SectionFieldConfig[];

export const FORMAT_FIELDS = [
  { defaultValue: ["paper"], kind: "toggleDefault", name: "formats", required: false },
] as const satisfies readonly SectionFieldConfig[];

export const EDITION_DETAILS_FIELDS = [
  { kind: "text", name: "pagesCount", required: false },
  { kind: "text", name: "publicationYear", required: false },
  { kind: "text", name: "isbn", required: false },
  { kind: "text", name: "translator", required: false },
  { kind: "text", name: "illustrator", required: false },
] as const satisfies readonly SectionFieldConfig[];

export const LIBRARY_ORGANIZATION_FIELDS = [
  { defaultValue: false, kind: "toggleDefault", name: "isFavorite", required: false },
  { defaultValue: false, kind: "toggleDefault", name: "addToReadingQueue", required: false },
  { kind: "multiselect", name: "listIds", required: false },
  { kind: "multiselect", name: "newLists", required: false },
] as const satisfies readonly SectionFieldConfig[];

export function computeSectionComplete(
  fields: readonly SectionFieldConfig[],
  valuesByName: Record<string, unknown>,
  errors: FieldErrors<CreateBookFormValues>,
): boolean {
  const required = fields.filter((field) => field.required);
  if (required.length > 0) {
    return required.every(
      (field) => isFilled(field, valuesByName[field.name]) && errors[field.name] == null,
    );
  }
  return fields.some((field) => isFilled(field, valuesByName[field.name]));
}

function assertNever(value: never): never {
  throw new Error(`Unhandled section field kind: ${String(value)}`);
}

function isChangedFromDefault(value: unknown, defaultValue: unknown): boolean {
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    return !sameSet(value, defaultValue);
  }
  return value !== defaultValue;
}

function isFilled(field: SectionFieldConfig, value: unknown): boolean {
  switch (field.kind) {
    case "multiselect":
      return Array.isArray(value) && value.length > 0;
    case "text":
      return isTextFilled(value);
    case "toggleDefault":
      return isChangedFromDefault(value, field.defaultValue);
    default:
      return assertNever(field.kind);
  }
}

function isTextFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

function sameSet(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((item) => setB.has(item));
}
