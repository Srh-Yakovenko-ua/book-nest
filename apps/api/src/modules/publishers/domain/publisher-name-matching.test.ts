import { describe, expect, it } from "vitest";

import {
  buildPublisherMatchVariants,
  comparePublisherCandidates,
  PUBLISHER_MATCH_TUNING,
  scoreStrongMatch,
  stripPublisherWrappers,
  toStrongMatchKey,
  transliterateToCyrillic,
  transliterateToLatin,
  trigramSimilarity,
} from "./publisher-name-matching.js";

function isStrong(name: string, candidateNames: string[]): boolean {
  return strongScore(name, candidateNames) >= PUBLISHER_MATCH_TUNING.minimumStrongSimilarity;
}

function strongScore(name: string, candidateNames: string[]): number {
  return scoreStrongMatch({ candidateNames, variants: buildPublisherMatchVariants(name) });
}

describe("toStrongMatchKey", () => {
  it("lowercases, folds compatibility forms and collapses whitespace", () => {
    expect(toStrongMatchKey("  ＶＩＶＡＴ   Books  ")).toBe("vivat books");
  });

  it("drops quotation marks without splitting the word they hug", () => {
    expect(toStrongMatchKey("Видавництво «Лабораторія»")).toBe("видавництво лабораторія");
    expect(toStrongMatchKey("Зв'язок")).toBe("звязок");
  });

  it("turns remaining punctuation into a single separator", () => {
    expect(toStrongMatchKey("Laboratory (publishing)")).toBe("laboratory publishing");
    expect(toStrongMatchKey("Ranok - NT")).toBe("ranok nt");
  });
});

describe("stripPublisherWrappers", () => {
  it("removes a wrapper used as a prefix", () => {
    expect(stripPublisherWrappers("видавництво лабораторія")).toBe("лабораторія");
    expect(stripPublisherWrappers("видавничий дім простір")).toBe("простір");
    expect(stripPublisherWrappers("publishing house ranok")).toBe("ranok");
    expect(stripPublisherWrappers("publisher ranok")).toBe("ranok");
  });

  it("removes a wrapper used as a suffix", () => {
    expect(stripPublisherWrappers("лабораторія видавництво")).toBe("лабораторія");
    expect(stripPublisherWrappers("laboratory publishing")).toBe("laboratory");
  });

  it("keeps stripping until the name is free of wrappers", () => {
    expect(stripPublisherWrappers("видавництво лабораторія видавництво")).toBe("лабораторія");
  });

  it("never strips a wrapper word from inside the name", () => {
    expect(stripPublisherWrappers("наше видавництво старого лева")).toBe(
      "наше видавництво старого лева",
    );
  });

  it("leaves a name that is nothing but a wrapper alone", () => {
    expect(stripPublisherWrappers("видавництво")).toBe("видавництво");
  });
});

describe("transliteration", () => {
  it("maps Ukrainian to Latin deterministically", () => {
    expect(transliterateToLatin("віват")).toBe("vivat");
    expect(transliterateToLatin("лабораторія")).toBe("laboratoriia");
  });

  it("maps Latin back to Ukrainian deterministically", () => {
    expect(transliterateToCyrillic("vivat")).toBe("віват");
  });

  it("leaves characters it has no rule for untouched", () => {
    expect(transliterateToLatin("vivat 2000")).toBe("vivat 2000");
  });
});

describe("buildPublisherMatchVariants", () => {
  it("adds a Latin variant for a Cyrillic input", () => {
    expect(buildPublisherMatchVariants("Віват")).toEqual(["віват", "vivat"]);
  });

  it("adds a Cyrillic variant for a Latin input", () => {
    expect(buildPublisherMatchVariants("Vivat")).toEqual(["vivat", "віват"]);
  });

  it("keeps the raw, wrapper-stripped and transliterated forms of a wrapped name", () => {
    expect(buildPublisherMatchVariants("Видавництво «Лабораторія»")).toEqual([
      "видавництво «лабораторія»",
      "видавництво лабораторія",
      "лабораторія",
      "laboratoriia",
    ]);
  });

  it("drops variants shorter than the tuned minimum", () => {
    expect(buildPublisherMatchVariants("ь")).toEqual([]);
  });
});

describe("trigramSimilarity", () => {
  it("reproduces the PostgreSQL pg_trgm similarity of identical strings", () => {
    expect(trigramSimilarity("лабораторія", "лабораторія")).toBe(1);
  });

  it("reproduces the PostgreSQL pg_trgm similarity of near misses", () => {
    expect(trigramSimilarity("основи", "основа")).toBeCloseTo(0.556, 3);
    expect(trigramSimilarity("penguin books", "penguin random house")).toBeCloseTo(0.296, 3);
    expect(trigramSimilarity("ранок", "ранок нт")).toBeCloseTo(0.667, 3);
  });

  it("scores unrelated strings at zero", () => {
    expect(trigramSimilarity("vivat", "ranok")).toBe(0);
  });
});

describe("scoreStrongMatch on the cases the product cares about", () => {
  it("links a bare name to the same name carrying a wrapper", () => {
    expect(isStrong("Лабораторія", ["Лабораторія (видавництво)"])).toBe(true);
  });

  it("links a wrapped, quoted name to the bare one", () => {
    expect(isStrong("Видавництво «Лабораторія»", ["Лабораторія"])).toBe(true);
  });

  it("links a transliterated name in both directions", () => {
    expect(isStrong("Віват", ["Vivat"])).toBe(true);
    expect(isStrong("Vivat", ["Віват"])).toBe(true);
  });

  it("reaches the catalog row through any of its stored names", () => {
    expect(isStrong("Vivat", ["Видавництво Vivat", "Віват", "Виват"])).toBe(true);
  });
});

describe("scoreStrongMatch on names that only look alike", () => {
  it("keeps two Ukrainian publishers that differ by one letter apart", () => {
    expect(strongScore("Основи", ["Основа"])).toBeCloseTo(0.556, 3);
    expect(isStrong("Основи", ["Основа"])).toBe(false);
  });

  it("keeps two publishers sharing a brand word apart", () => {
    expect(strongScore("Penguin Books", ["Penguin Random House"])).toBeCloseTo(0.296, 3);
    expect(isStrong("Penguin Books", ["Penguin Random House"])).toBe(false);
  });

  it("keeps two publishers sharing a leading word apart", () => {
    expect(isStrong("Наш Формат", ["Наш час"])).toBe(false);
  });

  it("does not match a generic word against every catalog entry that contains it", () => {
    expect(isStrong("Books", ["Penguin Books"])).toBe(false);
  });
});

describe("comparePublisherCandidates", () => {
  const candidate = (overrides: Partial<Parameters<typeof comparePublisherCandidates>[0]>) => ({
    id: "id-a",
    matchKind: "strong" as const,
    name: "name",
    score: 1,
    ...overrides,
  });

  it("puts exact before alias before strong", () => {
    const sorted = [
      candidate({ id: "c", matchKind: "strong" }),
      candidate({ id: "a", matchKind: "alias" }),
      candidate({ id: "e", matchKind: "exact" }),
    ].sort(comparePublisherCandidates);

    expect(sorted.map((entry) => entry.matchKind)).toEqual(["exact", "alias", "strong"]);
  });

  it("orders same-kind candidates by descending score", () => {
    const sorted = [
      candidate({ id: "low", score: 0.7 }),
      candidate({ id: "high", score: 0.9 }),
    ].sort(comparePublisherCandidates);

    expect(sorted.map((entry) => entry.id)).toEqual(["high", "low"]);
  });

  it("falls back to name then id so the order never depends on the query plan", () => {
    const sorted = [
      candidate({ id: "id-b", name: "Zeta" }),
      candidate({ id: "id-c", name: "Alpha" }),
      candidate({ id: "id-a", name: "Alpha" }),
    ].sort(comparePublisherCandidates);

    expect(sorted.map((entry) => entry.id)).toEqual(["id-a", "id-c", "id-b"]);
  });
});

describe("PUBLISHER_MATCH_TUNING", () => {
  it("retrieves more rows than it is willing to suggest", () => {
    expect(PUBLISHER_MATCH_TUNING.retrievalCandidateLimit).toBeGreaterThan(
      PUBLISHER_MATCH_TUNING.strongSuggestionLimit,
    );
  });

  it("sits the strong threshold above the closest false positive and below the wrapper case", () => {
    expect(trigramSimilarity("основи", "основа")).toBeLessThan(
      PUBLISHER_MATCH_TUNING.minimumStrongSimilarity,
    );
    expect(strongScore("Лабораторія", ["Лабораторія (видавництво)"])).toBeGreaterThanOrEqual(
      PUBLISHER_MATCH_TUNING.minimumStrongSimilarity,
    );
  });

  it("retrieves with a looser word-similarity gate than the score it finally demands", () => {
    expect(PUBLISHER_MATCH_TUNING.wordSimilarityThreshold).toBeLessThan(
      PUBLISHER_MATCH_TUNING.minimumStrongSimilarity,
    );
  });
});
