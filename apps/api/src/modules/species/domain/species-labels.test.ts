import { describe, expect, it } from "vitest";

import { resolveSpeciesLabels } from "./species-labels.js";

describe("resolveSpeciesLabels", () => {
  it("returns each canonical label for its own locale", () => {
    expect(
      resolveSpeciesLabels({
        name: "Elf",
        names: [
          { kind: "label", locale: "uk", name: "Ельф" },
          { kind: "label", locale: "en", name: "Elf" },
        ],
      }),
    ).toEqual({ en: "Elf", uk: "Ельф" });
  });

  it("falls back to the other canonical label when a locale is missing", () => {
    expect(
      resolveSpeciesLabels({ name: "Elf", names: [{ kind: "label", locale: "en", name: "Elf" }] }),
    ).toEqual({ en: "Elf", uk: "Elf" });
  });

  it("never shows an alias as the label", () => {
    expect(
      resolveSpeciesLabels({
        name: "Elf",
        names: [
          { kind: "alias", locale: "uk", name: "Ельфійка" },
          { kind: "label", locale: "en", name: "Elf" },
        ],
      }),
    ).toEqual({ en: "Elf", uk: "Elf" });
  });

  it("shows a custom species under its entered name in both locales", () => {
    expect(resolveSpeciesLabels({ name: "Скельник", names: [] })).toEqual({
      en: "Скельник",
      uk: "Скельник",
    });
  });
});
