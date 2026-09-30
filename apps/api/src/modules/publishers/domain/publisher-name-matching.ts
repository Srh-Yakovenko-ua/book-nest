import type { PublisherMatchKind } from "@app/shared";

import { normalizeName } from "@app/shared";

export const PUBLISHER_MATCH_TUNING = {
  minimumStrongSimilarity: 0.62,
  minimumVariantLength: 2,
  retrievalCandidateLimit: 40,
  strongSuggestionLimit: 5,
  wordSimilarityThreshold: 0.5,
} as const;

const PUBLISHER_WRAPPER_PHRASES = [
  "видавничий дім",
  "publishing house",
  "видавництво",
  "publishers",
  "publishing",
  "publisher",
];

const APOSTROPHE_AND_QUOTE_CHARACTERS = /['"`´«»„‟‹›‘’‚“”„′″ʼ]/gu;

const NON_ALPHANUMERIC_RUN = /[^\p{L}\p{N}]+/gu;

const CYRILLIC_LETTER = /\p{Script=Cyrillic}/u;

const LATIN_LETTER = /\p{Script=Latin}/u;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  ё: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "iu",
  я: "ia",
};

const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: "а",
  b: "б",
  c: "к",
  ch: "ч",
  d: "д",
  e: "е",
  f: "ф",
  g: "ґ",
  h: "г",
  i: "і",
  ia: "я",
  ie: "є",
  iu: "ю",
  j: "й",
  k: "к",
  kh: "х",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  sh: "ш",
  shch: "щ",
  t: "т",
  ts: "ц",
  u: "у",
  v: "в",
  w: "в",
  x: "кс",
  y: "и",
  ya: "я",
  ye: "є",
  yi: "ї",
  yu: "ю",
  z: "з",
  zh: "ж",
};

const LATIN_TO_CYRILLIC_KEYS = Object.keys(LATIN_TO_CYRILLIC).sort(
  (left, right) => right.length - left.length,
);

const MATCH_KIND_RANK: Record<PublisherMatchKind, number> = {
  alias: 1,
  exact: 0,
  strong: 2,
};

const TRIGRAM_SIZE = 3;
const TRIGRAM_LEADING_PAD = "  ";
const TRIGRAM_TRAILING_PAD = " ";

export type PublisherCandidateOrder = {
  id: string;
  matchKind: PublisherMatchKind;
  name: string;
  score: number;
};

export function buildPublisherMatchVariants(name: string): string[] {
  const safeKey = normalizeName(name);
  const strongKey = toStrongMatchKey(name);
  const strippedKey = stripPublisherWrappers(strongKey);

  const variants = [safeKey, strongKey, strippedKey];

  if (CYRILLIC_LETTER.test(strippedKey)) {
    variants.push(transliterateToLatin(strippedKey));
  }
  if (LATIN_LETTER.test(strippedKey)) {
    variants.push(transliterateToCyrillic(strippedKey));
  }

  return [...new Set(variants)].filter(
    (variant) => variant.length >= PUBLISHER_MATCH_TUNING.minimumVariantLength,
  );
}

export function comparePublisherCandidates(
  left: PublisherCandidateOrder,
  right: PublisherCandidateOrder,
): number {
  const byKind = MATCH_KIND_RANK[left.matchKind] - MATCH_KIND_RANK[right.matchKind];
  if (byKind !== 0) {
    return byKind;
  }
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.name !== right.name) {
    return left.name < right.name ? -1 : 1;
  }
  return left.id < right.id ? -1 : 1;
}

export function scoreStrongMatch({
  candidateNames,
  variants,
}: {
  candidateNames: string[];
  variants: string[];
}): number {
  const candidateKeys = new Set(
    candidateNames.map((candidateName) => stripPublisherWrappers(toStrongMatchKey(candidateName))),
  );

  let best = 0;
  for (const variant of variants) {
    for (const candidateKey of candidateKeys) {
      best = Math.max(best, trigramSimilarity(variant, candidateKey));
    }
  }
  return best;
}

export function stripPublisherWrappers(key: string): string {
  let current = key;

  for (;;) {
    const stripped = stripOneWrapper(current);
    if (stripped === current) {
      return current;
    }
    current = stripped;
  }
}

export function toStrongMatchKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(APOSTROPHE_AND_QUOTE_CHARACTERS, "")
    .replace(NON_ALPHANUMERIC_RUN, " ")
    .trim();
}

export function transliterateToCyrillic(value: string): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const matched = LATIN_TO_CYRILLIC_KEYS.find((key) => value.startsWith(key, index));
    if (matched === undefined) {
      result += value[index];
      index += 1;
      continue;
    }
    result += LATIN_TO_CYRILLIC[matched];
    index += matched.length;
  }

  return result;
}

export function transliterateToLatin(value: string): string {
  let result = "";
  for (const character of value) {
    result += CYRILLIC_TO_LATIN[character] ?? character;
  }
  return result;
}

export function trigramSimilarity(left: string, right: string): number {
  const leftTrigrams = toTrigrams(left);
  const rightTrigrams = toTrigrams(right);
  if (leftTrigrams.size === 0 || rightTrigrams.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const trigram of leftTrigrams) {
    if (rightTrigrams.has(trigram)) {
      shared += 1;
    }
  }

  return shared / (leftTrigrams.size + rightTrigrams.size - shared);
}

function stripOneWrapper(key: string): string {
  for (const phrase of PUBLISHER_WRAPPER_PHRASES) {
    const prefix = `${phrase} `;
    if (key.startsWith(prefix) && key.length > prefix.length) {
      return key.slice(prefix.length);
    }
    const suffix = ` ${phrase}`;
    if (key.endsWith(suffix) && key.length > suffix.length) {
      return key.slice(0, key.length - suffix.length);
    }
  }
  return key;
}

function toTrigrams(value: string): Set<string> {
  const trigrams = new Set<string>();

  for (const word of value.split(NON_ALPHANUMERIC_RUN)) {
    if (word.length === 0) {
      continue;
    }
    const padded = `${TRIGRAM_LEADING_PAD}${word}${TRIGRAM_TRAILING_PAD}`;
    for (let start = 0; start + TRIGRAM_SIZE <= padded.length; start += 1) {
      trigrams.add(padded.slice(start, start + TRIGRAM_SIZE));
    }
  }

  return trigrams;
}
