const SPECIES_NAME_FOLDS = [
  { pattern: /[‘’ʼ`´]/g, replacement: "'" },
  { pattern: /[‐-—]/g, replacement: "-" },
] as const;

const WHITESPACE_RUN = /\s+/g;

export function normalizeSpeciesName(name: string): string {
  return foldAroundCompatibilityNormalization(name)
    .replace(WHITESPACE_RUN, " ")
    .trim()
    .toLowerCase();
}

function foldAroundCompatibilityNormalization(name: string): string {
  return foldPunctuationVariants(foldPunctuationVariants(name).normalize("NFKC"));
}

function foldPunctuationVariants(name: string): string {
  return SPECIES_NAME_FOLDS.reduce(
    (folded, fold) => folded.replace(fold.pattern, fold.replacement),
    name,
  );
}
