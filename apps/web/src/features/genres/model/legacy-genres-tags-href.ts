type SearchParamsRecord = Record<string, string | string[] | undefined>;

const LEGACY_GENRES_TAGS = {
  fallback: "/genres",
  tabParam: "tab",
  targets: { genres: "/genres", tags: "/tags" },
} as const;

export function legacyGenresTagsHref(source: SearchParamsRecord): string {
  const tab = source[LEGACY_GENRES_TAGS.tabParam];
  if (tab === "tags") return LEGACY_GENRES_TAGS.targets.tags;
  if (tab === "genres") return LEGACY_GENRES_TAGS.targets.genres;
  return LEGACY_GENRES_TAGS.fallback;
}
