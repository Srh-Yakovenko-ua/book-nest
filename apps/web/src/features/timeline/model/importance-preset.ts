import type { Nullable, TimelineImportance } from "@app/shared";

export type ImportancePreset = "importantEvents" | "keyOnly";

export const IMPORTANCE_PRESET_VALUES = {
  importantEvents: ["high", "key"],
  keyOnly: ["key"],
} as const satisfies Record<ImportancePreset, readonly TimelineImportance[]>;

export function detectImportancePreset(
  importance: readonly TimelineImportance[],
): Nullable<ImportancePreset> {
  const selected = new Set(importance);
  for (const preset of ["importantEvents", "keyOnly"] as const) {
    const values = IMPORTANCE_PRESET_VALUES[preset];
    if (values.length === selected.size && values.every((value) => selected.has(value))) {
      return preset;
    }
  }
  return null;
}

export function importancePresetValues(preset: ImportancePreset): readonly TimelineImportance[] {
  return IMPORTANCE_PRESET_VALUES[preset];
}
