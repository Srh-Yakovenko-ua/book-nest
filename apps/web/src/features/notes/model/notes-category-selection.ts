import type { NoteCategory } from "@app/shared";

import { NoteCategorySchema } from "@app/shared";

import type { NotesAdvancedValues } from "./notes-archive-query";

type NotesCategorySelection = Pick<NotesAdvancedValues, "category" | "customCategory">;

const CATEGORY_VALUE_PREFIX = {
  custom: "custom:",
  standard: "standard:",
} as const;

export function customCategorySelectionValue(value: string): string {
  return `${CATEGORY_VALUE_PREFIX.custom}${value}`;
}

export function fromCategorySelectionValues(values: readonly string[]): NotesCategorySelection {
  const category: NoteCategory[] = [];
  const customCategory: string[] = [];

  for (const value of values) {
    if (value.startsWith(CATEGORY_VALUE_PREFIX.custom)) {
      customCategory.push(value.slice(CATEGORY_VALUE_PREFIX.custom.length));
      continue;
    }
    const parsed = NoteCategorySchema.safeParse(value.slice(CATEGORY_VALUE_PREFIX.standard.length));
    if (parsed.success) category.push(parsed.data);
  }

  return { category, customCategory };
}

export function standardCategorySelectionValue(value: NoteCategory): string {
  return `${CATEGORY_VALUE_PREFIX.standard}${value}`;
}

export function toCategorySelectionValues(selection: NotesCategorySelection): string[] {
  return [
    ...selection.category.map(standardCategorySelectionValue),
    ...selection.customCategory.map(customCategorySelectionValue),
  ];
}
