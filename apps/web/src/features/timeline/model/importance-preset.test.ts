import { describe, expect, it } from "vitest";

import {
  detectImportancePreset,
  IMPORTANCE_PRESET_VALUES,
  importancePresetValues,
} from "./importance-preset";

describe("detectImportancePreset", () => {
  it("recognizes the important-events preset from high and key", () => {
    expect(detectImportancePreset(["high", "key"])).toBe("importantEvents");
  });

  it("ignores the order of the selected levels", () => {
    expect(detectImportancePreset(["key", "high"])).toBe("importantEvents");
  });

  it("recognizes the key-only preset from a single key level", () => {
    expect(detectImportancePreset(["key"])).toBe("keyOnly");
  });

  it("returns null for an empty selection", () => {
    expect(detectImportancePreset([])).toBeNull();
  });

  it("returns null when the selection is only a subset of a preset", () => {
    expect(detectImportancePreset(["high"])).toBeNull();
  });

  it("returns null when the selection is a superset of a preset", () => {
    expect(detectImportancePreset(["high", "key", "low"])).toBeNull();
  });

  it("returns null for a level that belongs to no preset", () => {
    expect(detectImportancePreset(["low"])).toBeNull();
  });
});

describe("importancePresetValues", () => {
  it("maps the important-events preset to high and key", () => {
    expect(importancePresetValues("importantEvents")).toEqual(["high", "key"]);
  });

  it("maps the key-only preset to key", () => {
    expect(importancePresetValues("keyOnly")).toEqual(["key"]);
  });

  it("returns the same reference exposed by the preset table", () => {
    expect(importancePresetValues("keyOnly")).toBe(IMPORTANCE_PRESET_VALUES.keyOnly);
  });
});
