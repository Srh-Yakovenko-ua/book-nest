import type { NoteCategory, Nullable } from "@app/shared";

export function emptyToNull(value: Nullable<string> | undefined): Nullable<string> {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function resolveCustomCategory({
  category,
  customCategory,
}: {
  category: Nullable<NoteCategory>;
  customCategory: Nullable<string> | undefined;
}): Nullable<string> {
  if (category !== "other") {
    return null;
  }
  return emptyToNull(customCategory);
}
