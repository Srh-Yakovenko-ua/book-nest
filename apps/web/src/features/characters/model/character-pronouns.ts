import { normalizeName } from "@app/shared";

export const CHARACTER_PRONOUNS = {
  custom: "custom",
  knownSpellings: {
    any: ["Будь-які", "Any pronouns"],
    he: ["він/його", "he/him"],
    it: ["воно/його", "it/its"],
    she: ["вона/її", "she/her"],
    they: ["вони/їх", "they/them"],
    unknown: ["Невідомо", "Unknown"],
  },
  none: "none",
  presets: ["he", "she", "they", "it", "any", "unknown"],
} as const satisfies {
  custom: string;
  knownSpellings: Record<string, readonly string[]>;
  none: string;
  presets: readonly string[];
};

export type PronounPreset = (typeof CHARACTER_PRONOUNS.presets)[number];

export type PronounsOption =
  PronounPreset | typeof CHARACTER_PRONOUNS.custom | typeof CHARACTER_PRONOUNS.none;

export function pronounsOptionOf(
  text: string,
  localizedLabel: (preset: PronounPreset) => string,
): PronounsOption {
  const key = pronounsKey(text);
  if (key.length === 0) return CHARACTER_PRONOUNS.none;
  const preset = CHARACTER_PRONOUNS.presets.find((candidate) =>
    [...CHARACTER_PRONOUNS.knownSpellings[candidate], localizedLabel(candidate)].some(
      (spelling) => pronounsKey(spelling) === key,
    ),
  );
  return preset ?? CHARACTER_PRONOUNS.custom;
}

function pronounsKey(text: string) {
  return normalizeName(text).replaceAll(/\s*\/\s*/g, "/");
}
