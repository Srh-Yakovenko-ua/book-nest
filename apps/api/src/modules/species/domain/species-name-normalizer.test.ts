import { normalizeName } from "@app/shared";
import { describe, expect, it } from "vitest";

import { normalizeSpeciesName } from "./species-name-normalizer.js";

describe("normalizeSpeciesName", () => {
  it("lowercases, trims and collapses inner whitespace", () => {
    expect(normalizeSpeciesName("  Dark \t  Elf \n")).toBe("dark elf");
  });

  it("lowercases Cyrillic", () => {
    expect(normalizeSpeciesName("Темний ЕЛЬФ")).toBe("темний ельф");
  });

  it.each(["’", "ʼ", "‘", "`", "´", "＇"])(
    "folds the apostrophe variant %s to a plain apostrophe",
    (apostrophe) => {
      expect(normalizeSpeciesName(`Сім${apostrophe}я`)).toBe("сім'я");
    },
  );

  it.each(["‐", "‑", "‒", "–", "—", "﹣", "－"])(
    "folds the dash variant %s to a hyphen-minus",
    (dash) => {
      expect(normalizeSpeciesName(`Half${dash}Elf`)).toBe("half-elf");
    },
  );

  it("applies compatibility normalization to fullwidth letters and ligatures", () => {
    expect(normalizeSpeciesName("ＥＬＦ")).toBe("elf");
    expect(normalizeSpeciesName("ﬁre giant")).toBe("fire giant");
  });

  it("composes decomposed Cyrillic so both spellings of ї compare equal", () => {
    expect(normalizeSpeciesName("Kï")).toBe(normalizeSpeciesName("Kï"));
    expect(normalizeSpeciesName("їжак")).toBe("їжак");
  });

  it("turns a non-breaking space into a plain space", () => {
    expect(normalizeSpeciesName("Sea elf")).toBe("sea elf");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeSpeciesName(" \t\n ")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeSpeciesName(" Напів–Ельф’s ");
    expect(normalizeSpeciesName(once)).toBe(once);
  });

  it("leaves the global normalizeName untouched", () => {
    expect(normalizeName("Half–Elf")).toBe("half–elf");
  });
});
