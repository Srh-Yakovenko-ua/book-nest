import type { NoteCategory } from "@app/shared";

import { describe, expect, it } from "vitest";

import { noteCategoryLabel } from "./note-category-label";

const LABELS = {
  atmosphere: "Атмосфера",
  author_style: "Стиль автора",
  characters: "Персонажі",
  for_review: "Для рецензії",
  general_impression: "Загальне враження",
  other: "Інше",
  plot: "Сюжет",
  question: "Питання",
  theme_idea: "Тема / ідея",
  worldbuilding: "Світобудова",
} as const satisfies Record<NoteCategory, string>;

function labelOf(category: NoteCategory): string {
  return LABELS[category];
}

describe("noteCategoryLabel", () => {
  it("is null for an uncategorised note", () => {
    expect(noteCategoryLabel({ category: null, customCategory: null }, labelOf)).toBeNull();
  });

  it("uses the translated label for a built-in category", () => {
    expect(noteCategoryLabel({ category: "plot", customCategory: null }, labelOf)).toBe("Сюжет");
  });

  it("ignores a stray custom name on a built-in category", () => {
    expect(noteCategoryLabel({ category: "plot", customCategory: "Пророцтва" }, labelOf)).toBe(
      "Сюжет",
    );
  });

  it("uses the trimmed custom name for the other category", () => {
    expect(noteCategoryLabel({ category: "other", customCategory: "  Пророцтва  " }, labelOf)).toBe(
      "Пророцтва",
    );
  });

  it("falls back to the other label when the custom name is blank", () => {
    expect(noteCategoryLabel({ category: "other", customCategory: "   " }, labelOf)).toBe("Інше");
  });

  it("falls back to the other label when there is no custom name", () => {
    expect(noteCategoryLabel({ category: "other", customCategory: null }, labelOf)).toBe("Інше");
  });
});
