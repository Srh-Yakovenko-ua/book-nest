import { describe, expect, it } from "vitest";

import { passwordChecklist, passwordStrength } from "./password";

describe("passwordStrength", () => {
  it("returns weak score 0 for empty input", () => {
    expect(passwordStrength("")).toEqual({ level: "weak", score: 0 });
  });

  it("scores a short lowercase-only password as weak", () => {
    expect(passwordStrength("abc")).toEqual({ level: "weak", score: 0 });
  });

  it("gives one point for length only", () => {
    expect(passwordStrength("abcdefgh")).toEqual({ level: "weak", score: 1 });
  });

  it("gives two points for length and mixed case", () => {
    expect(passwordStrength("Abcdefgh")).toEqual({ level: "medium", score: 2 });
  });

  it("gives three points for length, case and digit", () => {
    expect(passwordStrength("Abcdefg1")).toEqual({ level: "medium", score: 3 });
  });

  it("gives four points and strong for a full policy password", () => {
    expect(passwordStrength("Abcdefg1!")).toEqual({ level: "strong", score: 4 });
  });

  it("bumps the level up when the password is at least 12 chars", () => {
    expect(passwordStrength("Abcdefghijkl")).toEqual({ level: "strong", score: 2 });
  });

  it("does not bump a single-point password past medium", () => {
    expect(passwordStrength("abcdefghijkl")).toEqual({ level: "medium", score: 1 });
  });
});

describe("passwordChecklist", () => {
  it("reports all rules unmet for an empty password", () => {
    expect(passwordChecklist("")).toEqual([
      { id: "length", met: false },
      { id: "case", met: false },
      { id: "digit", met: false },
      { id: "special", met: false },
    ]);
  });

  it("reports all rules met for a strong password", () => {
    expect(passwordChecklist("Abcdefg1!")).toEqual([
      { id: "length", met: true },
      { id: "case", met: true },
      { id: "digit", met: true },
      { id: "special", met: true },
    ]);
  });

  it("reports only the case rule met for a short mixed-case password", () => {
    expect(passwordChecklist("aB")).toEqual([
      { id: "length", met: false },
      { id: "case", met: true },
      { id: "digit", met: false },
      { id: "special", met: false },
    ]);
  });
});
