import type { Nullable } from "@app/shared";

export const INHERITABLE_BOOK_FIELDS = {
  attitude: "attitude",
  displayName: "displayName",
  portrait: "portrait",
  species: "speciesOverride",
} as const satisfies Record<string, string>;

export type InheritableBookField = ValueOfInheritable;

type ValueOfInheritable = (typeof INHERITABLE_BOOK_FIELDS)[keyof typeof INHERITABLE_BOOK_FIELDS];

export function isBookFieldMasked(
  maskedFields: readonly string[],
  field: InheritableBookField,
): boolean {
  return maskedFields.includes(field);
}

export function resolveInherited<T>({
  bookValue,
  globalValue,
}: {
  bookValue: Nullable<T>;
  globalValue: Nullable<T>;
}): { effective: Nullable<T>; isInherited: boolean } {
  if (bookValue === null) return { effective: globalValue, isInherited: true };
  return { effective: bookValue, isInherited: false };
}
