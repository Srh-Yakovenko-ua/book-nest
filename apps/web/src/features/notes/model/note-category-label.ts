import type { NoteCategory, NoteView, Nullable } from "@app/shared";

import { NOTE_CUSTOM_CATEGORY } from "./note-categories";

export function noteCategoryLabel(
  { category, customCategory }: Pick<NoteView, "category" | "customCategory">,
  labelOf: (category: NoteCategory) => string,
): Nullable<string> {
  if (category === null) return null;
  if (category !== NOTE_CUSTOM_CATEGORY) return labelOf(category);

  const custom = customCategory?.trim() ?? "";
  return custom.length === 0 ? labelOf(category) : custom;
}
