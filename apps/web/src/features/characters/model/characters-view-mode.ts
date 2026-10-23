import { parseAsStringLiteral } from "nuqs/server";

const CHARACTERS_VIEW_MODES = ["list", "relationships", "graph"] as const;

export type CharactersViewMode = (typeof CHARACTERS_VIEW_MODES)[number];

export const CHARACTERS_VIEW = {
  bookModes: ["list", "relationships"],
  modes: CHARACTERS_VIEW_MODES,
  parser: parseAsStringLiteral(CHARACTERS_VIEW_MODES).withDefault("list"),
  urlKey: "charactersView",
} as const;

export function toCharactersViewMode(value: string): CharactersViewMode | undefined {
  return CHARACTERS_VIEW_MODES.find((mode) => mode === value);
}
