import type { NoteCategory, Nullable, UpdateNoteInput } from "@app/shared";

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

export function touchesNoteContent(input: UpdateNoteInput): boolean {
  const contentChangeByField: Record<keyof UpdateNoteInput, boolean> = {
    category: input.category !== undefined,
    chapter: input.chapter !== undefined,
    customCategory: input.customCategory !== undefined,
    isFavorite: false,
    isPinned: false,
    isSpoiler: input.isSpoiler !== undefined,
    page: input.page !== undefined,
    text: input.text !== undefined,
  };
  return Object.values(contentChangeByField).some(Boolean);
}
