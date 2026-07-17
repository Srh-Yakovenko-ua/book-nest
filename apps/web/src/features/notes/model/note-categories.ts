import type { NoteCategory } from "@app/shared";

export const NOTE_CATEGORY_OPTIONS = [
  "general_impression",
  "characters",
  "plot",
  "atmosphere",
  "worldbuilding",
  "theme_idea",
  "author_style",
  "for_review",
  "question",
  "other",
] as const satisfies readonly NoteCategory[];

export const NOTE_CUSTOM_CATEGORY = "other" satisfies NoteCategory;
