type CharacterFacetEntry = {
  count: number;
  value: string;
};

export function characterFacetCount(
  entries: readonly CharacterFacetEntry[] | undefined,
  value: string,
): number | undefined {
  if (entries === undefined) return undefined;
  return entries.find((entry) => entry.value === value)?.count ?? 0;
}
